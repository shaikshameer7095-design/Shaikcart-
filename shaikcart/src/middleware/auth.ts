import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { hasPermission, isAdminRole, verifySessionToken } from '../server/security.ts';

// Primary platform owner email automatically recognized as Super Admin on Firebase Auth sign-in
export const INITIAL_SUPER_ADMIN_EMAIL = 'shaikshameer7095@gmail.com';

export interface AuthenticatedDbUser {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: string;
  emailVerified: boolean;
  status: string;
}

export interface AuthRequest extends Request {
  dbUser?: AuthenticatedDbUser;
  authSource?: 'firebase' | 'session';
}

async function resolveUserFromToken(token: string): Promise<{
  user: AuthenticatedDbUser;
  source: 'firebase' | 'session';
} | null> {
  // 1. Check SHAIKCART signed session token first (prefixed with sc_)
  if (token.startsWith('sc_')) {
    const payload = verifySessionToken(token);
    if (!payload) return null;
    const rows = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
    const dbUser = rows[0];
    if (!dbUser || dbUser.status !== 'active') return null;
    return {
      user: {
        id: dbUser.id,
        uid: dbUser.uid,
        email: dbUser.email,
        fullName: dbUser.fullName,
        phone: dbUser.phone,
        avatarUrl: dbUser.avatarUrl,
        role: dbUser.role,
        emailVerified: dbUser.emailVerified,
        status: dbUser.status,
      },
      source: 'session',
    };
  }

  // 2. Otherwise verify Firebase Auth ID Token
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = (decoded.email || '').toLowerCase();
    if (!email) return null;

    const existingByUid = await db.select().from(users).where(eq(users.uid, decoded.uid)).limit(1);
    let dbUser = existingByUid[0];

    if (!dbUser) {
      const existingByEmail = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingByEmail[0]) {
        const shouldUpgrade =
          email === INITIAL_SUPER_ADMIN_EMAIL && existingByEmail[0].role === 'customer';
        const updated = await db
          .update(users)
          .set({
            uid: decoded.uid,
            emailVerified: decoded.email_verified ?? existingByEmail[0].emailVerified,
            avatarUrl: decoded.picture || existingByEmail[0].avatarUrl,
            fullName: existingByEmail[0].fullName || decoded.name || email.split('@')[0],
            role: shouldUpgrade ? 'super_admin' : existingByEmail[0].role,
            lastLoginAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingByEmail[0].id))
          .returning();
        dbUser = updated[0];
      } else {
        const assignedRole = email === INITIAL_SUPER_ADMIN_EMAIL ? 'super_admin' : 'customer';
        const inserted = await db
          .insert(users)
          .values({
            uid: decoded.uid,
            email,
            fullName: decoded.name || email.split('@')[0],
            avatarUrl: decoded.picture || '',
            role: assignedRole,
            emailVerified: Boolean(decoded.email_verified),
            status: 'active',
            lastLoginAt: new Date(),
          })
          .onConflictDoUpdate({
            target: users.uid,
            set: {
              email,
              lastLoginAt: new Date(),
              updatedAt: new Date(),
            },
          })
          .returning();
        dbUser = inserted[0];
      }
    } else {
      const shouldUpgrade = email === INITIAL_SUPER_ADMIN_EMAIL && dbUser.role === 'customer';
      if (shouldUpgrade) {
        const updated = await db
          .update(users)
          .set({ role: 'super_admin', lastLoginAt: new Date(), updatedAt: new Date() })
          .where(eq(users.id, dbUser.id))
          .returning();
        dbUser = updated[0];
      }
    }

    if (!dbUser || dbUser.status !== 'active') return null;

    return {
      user: {
        id: dbUser.id,
        uid: dbUser.uid,
        email: dbUser.email,
        fullName: dbUser.fullName,
        phone: dbUser.phone,
        avatarUrl: dbUser.avatarUrl,
        role: dbUser.role,
        emailVerified: dbUser.emailVerified,
        status: dbUser.status,
      },
      source: 'firebase',
    };
  } catch {
    return null;
  }
}

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        const resolved = await resolveUserFromToken(token);
        if (resolved) {
          req.dbUser = resolved.user;
          req.authSource = resolved.source;
        }
      } catch (err) {
        console.error('Optional auth resolution error:', err);
      }
    }
  }
  next();
};

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Authentication token is missing.' });
  }
  try {
    const resolved = await resolveUserFromToken(token);
    if (!resolved) {
      return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    }
    req.dbUser = resolved.user;
    req.authSource = resolved.source;
    next();
  } catch (error) {
    console.error('Auth verification failed:', error);
    return res.status(401).json({ error: 'Unable to verify credentials.' });
  }
};

export const requireAdmin = (permission?: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    await requireAuth(req, res, () => {
      if (!req.dbUser || !isAdminRole(req.dbUser.role)) {
        return res.status(403).json({ error: 'Administrator privileges required.' });
      }
      if (permission && !hasPermission(req.dbUser.role, permission)) {
        return res.status(403).json({ error: `Insufficient permissions (${permission}).` });
      }
      next();
    });
  };
};

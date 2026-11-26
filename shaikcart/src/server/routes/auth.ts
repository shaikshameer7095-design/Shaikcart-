import crypto from 'crypto';
import { Router } from 'express';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import { adminActivityLogs, notifications, users } from '../../db/schema.ts';
import { ensureDatabaseSeeded } from '../../db/seed.ts';
import { INITIAL_SUPER_ADMIN_EMAIL, requireAuth, AuthRequest } from '../../middleware/auth.ts';
import {
  ADMIN_ROLES,
  hashPassword,
  isAdminRole,
  ROLE_PERMISSIONS,
  signSessionToken,
  UserRole,
  verifyPassword,
} from '../security.ts';
import { sendTransactionalEmail } from '../email.ts';

const router = Router();

router.use(async (_req, res, next) => {
  try {
    await ensureDatabaseSeeded();
    next();
  } catch (error) {
    console.error('Seed check error:', error);
    res.status(503).json({ error: 'Service temporarily unavailable.' });
  }
});

function serializeUser(u: {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: string;
  emailVerified: boolean;
  status: string;
}) {
  return {
    id: u.id,
    uid: u.uid,
    email: u.email,
    fullName: u.fullName,
    phone: u.phone || '',
    avatarUrl: u.avatarUrl || '',
    role: u.role,
    isAdmin: isAdminRole(u.role),
    permissions: ROLE_PERMISSIONS[u.role as UserRole] || ['account:self'],
    emailVerified: u.emailVerified,
    status: u.status,
  };
}

// 1. Customer Sign Up (always assigns 'customer' role; never permits admin self-registration)
const registerSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(24).optional(),
  password: z.string().min(8).max(128),
});

router.post('/auth/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Please provide a valid name, email, and password (minimum 8 characters).' });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing[0]) {
      return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
    }

    const uid = `local_${crypto.randomBytes(12).toString('hex')}`;
    const verificationToken = crypto.randomBytes(20).toString('hex');
    const passwordHash = hashPassword(parsed.data.password);

    const [created] = await db
      .insert(users)
      .values({
        uid,
        email,
        passwordHash,
        fullName: parsed.data.fullName.trim(),
        phone: parsed.data.phone?.trim() || '',
        role: 'customer', // Strictly enforce customer role
        emailVerified: false,
        verificationToken,
        status: 'active',
        lastLoginAt: new Date(),
      })
      .returning();

    await db.insert(notifications).values({
      userId: created.id,
      audience: 'customer',
      type: 'account',
      title: 'Welcome to SHAIKCART',
      message: 'Your customer account is active. Use code WELCOME10 on your first order above ₹999.',
      linkUrl: '/shop',
    });

    const appUrl = process.env.APP_URL || '';
    const verifyUrl = `${appUrl}/verify-email?token=${verificationToken}`;
    const emailResult = await sendTransactionalEmail({
      to: created.email,
      subject: 'Verify your SHAIKCART account',
      template: 'email_verification',
      html: `<p>Welcome to SHAIKCART, ${created.fullName}!</p><p>Verify your email using token: <strong>${verificationToken}</strong>${appUrl ? ` or visit <a href="${verifyUrl}">${verifyUrl}</a>` : ''}.</p>`,
    });

    const token = signSessionToken({
      userId: created.id,
      uid: created.uid,
      email: created.email,
      role: created.role,
    });

    res.status(201).json({
      token,
      user: serializeUser(created),
      emailDelivery: emailResult,
      verificationHint: emailResult.sent
        ? 'Verification link sent to your email.'
        : 'Account created. Transactional email provider is not configured yet — you can verify directly inside Verify Email or continue shopping.',
    });
  } catch (error) {
    console.error('Customer register error:', error);
    res.status(500).json({ error: 'Unable to create account right now.' });
  }
});

// 2. Customer Email/Password Login
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/auth/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Please enter a valid email and password.' });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const [found] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!found || !found.passwordHash || !verifyPassword(parsed.data.password, found.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (found.status !== 'active') {
      return res.status(403).json({ error: 'This account has been suspended. Please contact customer support.' });
    }

    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, found.id));

    const token = signSessionToken({
      userId: found.id,
      uid: found.uid,
      email: found.email,
      role: found.role,
    });

    res.json({ token, user: serializeUser(found) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Unable to sign in right now.' });
  }
});

// 3. Firebase Auth Sync (Google Sign-In)
router.post('/auth/firebase-sync', requireAuth, async (req: AuthRequest, res) => {
  if (!req.dbUser) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  res.json({ user: serializeUser(req.dbUser) });
});

// 4. Current Authenticated User Profile
router.get('/auth/me', requireAuth, async (req: AuthRequest, res) => {
  if (!req.dbUser) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  res.json({ user: serializeUser(req.dbUser) });
});

// 5. Email Verification
router.post('/auth/verify-email', async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    if (!token) {
      return res.status(400).json({ error: 'Verification token is required.' });
    }
    const [found] = await db
      .select()
      .from(users)
      .where(eq(users.verificationToken, token))
      .limit(1);

    if (!found) {
      return res.status(400).json({ error: 'Invalid or already used verification token.' });
    }

    await db
      .update(users)
      .set({ emailVerified: true, verificationToken: null, updatedAt: new Date() })
      .where(eq(users.id, found.id));

    res.json({ verified: true, message: 'Your email address has been verified.' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Unable to verify email.' });
  }
});

// 6. Forgot Password
router.post('/auth/forgot-password', async (req, res) => {
  try {
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const [found] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!found) {
      // Do not leak account existence
      return res.json({
        requested: true,
        emailSent: false,
        message: 'If an account matches this email, password reset instructions have been prepared.',
      });
    }

    const resetToken = crypto.randomBytes(20).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db
      .update(users)
      .set({ resetToken, resetTokenExpiresAt: expiresAt, updatedAt: new Date() })
      .where(eq(users.id, found.id));

    const emailResult = await sendTransactionalEmail({
      to: found.email,
      subject: 'SHAIKCART Password Reset Request',
      template: 'password_reset',
      html: `<p>Hello ${found.fullName || 'Customer'},</p><p>Use this reset token within 60 minutes to reset your SHAIKCART password: <strong>${resetToken}</strong></p>`,
    });

    res.json({
      requested: true,
      emailSent: emailResult.sent,
      emailStatus: emailResult.status,
      message: emailResult.sent
        ? 'A password reset link has been sent to your registered email address.'
        : 'Password reset token generated, but no email provider (RESEND_API_KEY) is configured yet. Configure RESEND_API_KEY in environment secrets to send live reset emails.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Unable to process password reset request.' });
  }
});

// 7. Reset Password with Token
router.post('/auth/reset-password', async (req, res) => {
  try {
    const schema = z.object({
      token: z.string().min(10),
      newPassword: z.string().min(8).max(128),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Valid reset token and new password (min 8 chars) are required.' });
    }

    const [found] = await db
      .select()
      .from(users)
      .where(eq(users.resetToken, parsed.data.token.trim()))
      .limit(1);

    if (!found || !found.resetTokenExpiresAt || new Date(found.resetTokenExpiresAt) < new Date()) {
      return res.status(400).json({ error: 'Reset token is invalid or has expired.' });
    }

    await db
      .update(users)
      .set({
        passwordHash: hashPassword(parsed.data.newPassword),
        resetToken: null,
        resetTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, found.id));

    res.json({ reset: true, message: 'Password updated successfully. You may now sign in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Unable to reset password.' });
  }
});

// 8. Change Password (Authenticated)
router.post('/auth/change-password', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      currentPassword: z.string().optional(),
      newPassword: z.string().min(8).max(128),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success || !req.dbUser) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    const [dbRow] = await db.select().from(users).where(eq(users.id, req.dbUser.id)).limit(1);
    if (!dbRow) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    if (dbRow.passwordHash) {
      if (!parsed.data.currentPassword || !verifyPassword(parsed.data.currentPassword, dbRow.passwordHash)) {
        return res.status(400).json({ error: 'Current password is incorrect.' });
      }
    }

    await db
      .update(users)
      .set({ passwordHash: hashPassword(parsed.data.newPassword), updatedAt: new Date() })
      .where(eq(users.id, dbRow.id));

    res.json({ updated: true, message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Unable to change password.' });
  }
});

// 9. Admin Bootstrap Status (First-Run Claim Form Check)
router.get('/admin/auth/bootstrap-status', async (_req, res) => {
  try {
    const passcodeConfigured = Boolean(process.env.ADMIN_BOOTSTRAP_PASSCODE?.trim());
    const adminUsers = await db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(inArray(users.role, [...ADMIN_ROLES]));

    const hasClaimedAdminPassword = adminUsers.some((u) => Boolean(u.passwordHash));

    res.json({
      passcodeConfigured,
      needsFirstRunSetup: !passcodeConfigured && !hasClaimedAdminPassword,
      googleAdminEmailHint: INITIAL_SUPER_ADMIN_EMAIL,
    });
  } catch (error) {
    console.error('Admin bootstrap status error:', error);
    res.status(500).json({ error: 'Unable to check admin setup status.' });
  }
});

// 10. One-Time First-Run Super Admin Claim Route (locks immediately once claimed or when env passcode exists)
const claimAdminSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(10).max(128),
});

router.post('/admin/auth/claim', async (req, res) => {
  try {
    if (process.env.ADMIN_BOOTSTRAP_PASSCODE?.trim()) {
      return res.status(403).json({
        error: 'Admin passcode is managed via server environment secrets. Please sign in directly.',
      });
    }

    const existingAdmins = await db
      .select({ id: users.id, passwordHash: users.passwordHash })
      .from(users)
      .where(inArray(users.role, [...ADMIN_ROLES]));

    if (existingAdmins.some((u) => Boolean(u.passwordHash))) {
      return res.status(403).json({
        error: 'Initial Super Admin account has already been claimed. Please sign in at Admin Login.',
      });
    }

    const parsed = claimAdminSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Provide full name, valid email, and a strong password (minimum 10 characters).',
      });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const passwordHash = hashPassword(parsed.data.password);

    const [existingByEmail] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    let adminUser;
    if (existingByEmail) {
      const [updated] = await db
        .update(users)
        .set({
          fullName: parsed.data.fullName.trim(),
          passwordHash,
          role: 'super_admin',
          emailVerified: true,
          status: 'active',
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingByEmail.id))
        .returning();
      adminUser = updated;
    } else {
      const [inserted] = await db
        .insert(users)
        .values({
          uid: `admin_${crypto.randomBytes(12).toString('hex')}`,
          email,
          fullName: parsed.data.fullName.trim(),
          passwordHash,
          role: 'super_admin',
          emailVerified: true,
          status: 'active',
          lastLoginAt: new Date(),
        })
        .returning();
      adminUser = inserted;
    }

    await db.insert(adminActivityLogs).values({
      actorUserId: adminUser.id,
      actorEmail: adminUser.email,
      action: 'admin_setup_claimed',
      entityType: 'user',
      entityId: String(adminUser.id),
      details: { role: 'super_admin' },
      ipAddress: req.ip || '',
    });

    const token = signSessionToken({
      userId: adminUser.id,
      uid: adminUser.uid,
      email: adminUser.email,
      role: adminUser.role,
    });

    res.status(201).json({ token, user: serializeUser(adminUser) });
  } catch (error) {
    console.error('Admin claim error:', error);
    res.status(500).json({ error: 'Unable to complete initial admin setup.' });
  }
});

// 11. Dedicated Admin Login Route (enforces admin RBAC and logs every login attempt)
router.post('/admin/auth/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Please enter admin email and password.' });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const envPasscode = process.env.ADMIN_BOOTSTRAP_PASSCODE?.trim();

    // If ADMIN_BOOTSTRAP_PASSCODE is configured in secrets, it overrides fallback hashes for initial super admin
    if (envPasscode && email === INITIAL_SUPER_ADMIN_EMAIL) {
      const a = Buffer.from(parsed.data.password);
      const b = Buffer.from(envPasscode);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        let adminRow = existing;
        if (!adminRow) {
          const [created] = await db
            .insert(users)
            .values({
              uid: `admin_${crypto.randomBytes(12).toString('hex')}`,
              email,
              fullName: 'SHAIKCART Super Admin',
              role: 'super_admin',
              emailVerified: true,
              status: 'active',
              lastLoginAt: new Date(),
            })
            .returning();
          adminRow = created;
        } else if (!isAdminRole(adminRow.role)) {
          const [upgraded] = await db
            .update(users)
            .set({ role: 'super_admin', lastLoginAt: new Date(), updatedAt: new Date() })
            .where(eq(users.id, adminRow.id))
            .returning();
          adminRow = upgraded;
        }
        await db.insert(adminActivityLogs).values({
          actorUserId: adminRow.id,
          actorEmail: adminRow.email,
          action: 'admin_login_passcode',
          entityType: 'session',
          entityId: String(adminRow.id),
          ipAddress: req.ip || '',
        });
        const token = signSessionToken({
          userId: adminRow.id,
          uid: adminRow.uid,
          email: adminRow.email,
          role: adminRow.role,
        });
        return res.json({ token, user: serializeUser(adminRow) });
      }
    }

    const [found] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!found || !isAdminRole(found.role)) {
      return res.status(403).json({ error: 'Authorized administrator credentials required.' });
    }
    if (found.status !== 'active') {
      return res.status(403).json({ error: 'This administrator account is suspended.' });
    }
    if (!found.passwordHash || !verifyPassword(parsed.data.password, found.passwordHash)) {
      return res.status(401).json({ error: 'Invalid administrator credentials.' });
    }

    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, found.id));

    await db.insert(adminActivityLogs).values({
      actorUserId: found.id,
      actorEmail: found.email,
      action: 'admin_login',
      entityType: 'session',
      entityId: String(found.id),
      details: { role: found.role },
      ipAddress: req.ip || '',
    });

    const token = signSessionToken({
      userId: found.id,
      uid: found.uid,
      email: found.email,
      role: found.role,
    });

    res.json({ token, user: serializeUser(found) });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Unable to authenticate administrator.' });
  }
});

export default router;

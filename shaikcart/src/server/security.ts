import crypto from 'crypto';

// Ephemeral in-memory fallback signing key if SESSION_SECRET is not provided in env
const SESSION_SIGNING_KEY =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

export const ADMIN_ROLES = [
  'super_admin',
  'admin',
  'manager',
  'inventory_manager',
  'order_manager',
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];
export type UserRole = AdminRole | 'customer';

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  super_admin: ['*'],
  admin: [
    'dashboard:view',
    'products:manage',
    'categories:manage',
    'orders:manage',
    'customers:manage',
    'coupons:manage',
    'shipping:manage',
    'payments:manage',
    'cms:manage',
    'reviews:manage',
    'support:manage',
    'analytics:view',
    'logs:view',
  ],
  manager: [
    'dashboard:view',
    'products:manage',
    'categories:manage',
    'orders:manage',
    'customers:view',
    'coupons:manage',
    'reviews:manage',
    'support:manage',
    'analytics:view',
  ],
  inventory_manager: [
    'dashboard:view',
    'products:manage',
    'categories:manage',
  ],
  order_manager: [
    'dashboard:view',
    'orders:manage',
    'shipping:manage',
    'support:manage',
  ],
  customer: ['account:self'],
};

export function isAdminRole(role: string): role is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}

export function hasPermission(role: string, permission?: string): boolean {
  if (!isAdminRole(role)) return false;
  if (!permission) return true;
  const perms = ROLE_PERMISSIONS[role] || [];
  return perms.includes('*') || perms.includes(permission);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export interface SessionPayload {
  userId: number;
  uid: string;
  email: string;
  role: string;
  exp: number;
}

export function signSessionToken(payload: Omit<SessionPayload, 'exp'>, ttlSeconds = 60 * 60 * 24 * 7): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SIGNING_KEY).update(encoded).digest('base64url');
  return `sc_${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!token.startsWith('sc_')) return null;
  const raw = token.slice(3);
  const parts = raw.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SIGNING_KEY).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function verifyRazorpaySignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
  secret: string
): boolean {
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function verifyRazorpayWebhookSignature(
  rawBody: Buffer | string,
  signature: string,
  webhookSecret: string
): boolean {
  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function sanitizeUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('/')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

export function escapeCsvCell(value: unknown): string {
  let str = value === null || value === undefined ? '' : String(value);
  // Neutralize spreadsheet formula injection
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateOrderNumber(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `SC${y}${m}${d}-${rand}`;
}

export function generateTicketNumber(): string {
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `TKT-${rand}`;
}

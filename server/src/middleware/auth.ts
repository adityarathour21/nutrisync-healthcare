import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { dbStore, UserRecord, UserRole } from '../config/store.js';

const JWT_SECRET = process.env.JWT_SECRET || 'nutrisync_dev_jwt_secret_change_in_prod_2026';

export interface AuthenticatedRequest extends Request {
  user?: Omit<UserRecord, 'passwordHash'>;
}

export function signAuthToken(user: UserRecord): string {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function setAuthCookie(res: Response, token: string): void {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.APP_URL?.startsWith('https'));
  res.cookie('nutrisync_token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res: Response): void {
  const isProd = process.env.NODE_ENV === 'production' || Boolean(process.env.APP_URL?.startsWith('https'));
  res.clearCookie('nutrisync_token', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  });
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    const cookieToken = req.cookies?.nutrisync_token;
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const token = cookieToken || bearerToken;

    if (!token) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; email: string; role: UserRole };
    const found = dbStore.data.users.find((u) => u.id === decoded.sub);

    if (!found || !found.isActive) {
      res.status(401).json({ error: 'Account inactive or session invalid.' });
      return;
    }

    const { passwordHash: _pw, ...safeUser } = found;
    req.user = safeUser;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}.`,
      });
      return;
    }
    next();
  };
}

// Sanitize request payloads against XSS script tags and NoSQL $ operator injection
export function sanitizePayload(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').trim();
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizePayload);
  }
  if (obj !== null && typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (k.startsWith('$') || k.includes('.')) continue;
      cleaned[k] = sanitizePayload(v);
    }
    return cleaned;
  }
  return obj;
}

export function securitySanitizer(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizePayload(req.body);
  }
  next();
}

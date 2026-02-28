import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '../types.js';

// Support both JWT_SECRET and JWT-SECRET (some platforms use hyphen)
const raw =
  process.env.JWT_SECRET ??
  (process.env as Record<string, string | undefined>)['JWT-SECRET'];
if (!raw || typeof raw !== 'string' || raw.length < 32) {
  throw new Error(
    'JWT_SECRET must be set and at least 32 characters. Add it in your app environment variables (name: JWT_SECRET or JWT-SECRET).'
  );
}
const secret: string = raw;

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const decoded = jwt.verify(token, secret) as unknown as JwtPayload;
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

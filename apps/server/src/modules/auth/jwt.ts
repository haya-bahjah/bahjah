import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

export interface AuthTokenPayload {
  sub: string;
}

export function signAuthToken(userId: string): string {
  const payload: AuthTokenPayload = { sub: userId };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '30d' });
}

// Guests get a short-lived token instead of the 30-day one real accounts
// get, so a QR/code join naturally "resets" (re-prompts for name + avatar)
// after 6 hours instead of staying signed in indefinitely.
export function signGuestToken(userId: string): string {
  const payload: AuthTokenPayload = { sub: userId };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '6h' });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
}

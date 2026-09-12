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

// A session for somebody who opened the admin pages with the shared
// passphrase rather than with a Bahjah account.
//
// Carries no `sub`, and a scope of its own, so it can never be mistaken for a
// user: requireAuth reads `sub` and would reject it, and nothing that expects
// a signed-in person can be fooled by one. It is short-lived on purpose --
// hours, not the thirty days a real account gets -- because a shared secret's
// blast radius is however long the tokens it minted stay valid.
const ADMIN_PORTAL_SCOPE = 'admin_portal';
const ADMIN_PORTAL_TTL = '12h';

export function signAdminPortalToken(): string {
  return jwt.sign({ scope: ADMIN_PORTAL_SCOPE }, env.jwtSecret, { expiresIn: ADMIN_PORTAL_TTL });
}

// True only for a live, correctly-signed portal token. Anything else --
// expired, tampered with, or simply a normal user token -- is false rather
// than an exception, because the caller's next move is to try the account
// path instead.
export function isAdminPortalToken(token: string): boolean {
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { scope?: string };
    return payload.scope === ADMIN_PORTAL_SCOPE;
  } catch {
    return false;
  }
}

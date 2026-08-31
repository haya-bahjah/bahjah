import type { RequestHandler } from 'express';
import { prisma } from '../../db/prisma';

const TRIAL_MS = 6 * 60 * 60 * 1000;

// Internal QA accounts: exempt from the trial clock and from paid access, so
// the games and the platform stay reachable indefinitely for testing. This is
// deliberately an email allowlist rather than a database column -- it needs no
// migration, cannot be granted by anything a user does, and is visible in the
// diff.
//
// TEST_ACCOUNT_EMAILS *replaces* this list rather than adding to it, so an
// environment that sets it has to name every exempt account, not just the new
// one. Set it to an empty string to disable the exemption entirely.
const DEFAULT_TEST_ACCOUNT_EMAILS = 'latifa@bahjah.com,altwaimhaya@gmail.com,z.shiki.9700@gmail.com';

const TEST_ACCOUNT_EMAILS = new Set(
  (process.env.TEST_ACCOUNT_EMAILS ?? DEFAULT_TEST_ACCOUNT_EMAILS)
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

export function isTestAccount(email: string | null | undefined): boolean {
  return Boolean(email && TEST_ACCOUNT_EMAILS.has(email.trim().toLowerCase()));
}

export interface AccessState {
  hasAccess: boolean;
  isTrialing: boolean;
  isUnlimited: boolean;
  trialEndsAt: Date;
  paidUntil: Date | null;
}

// Guests (isGuest) are never subject to this at all -- they're anonymous
// QR/code joiners riding on the room they joined, not a billable account.
// This is only ever evaluated for real accounts.
export function computeAccess(user: {
  email?: string | null;
  createdAt: Date;
  paidUntil: Date | null;
}): AccessState {
  const now = Date.now();
  const trialEndsAt = new Date(user.createdAt.getTime() + TRIAL_MS);
  const isTrialing = now < trialEndsAt.getTime();
  const isPaid = Boolean(user.paidUntil && user.paidUntil.getTime() > now);
  const isUnlimited = isTestAccount(user.email);
  return {
    hasAccess: isUnlimited || isTrialing || isPaid,
    // A test account is never "trialing" -- there is no clock to run down.
    isTrialing: !isUnlimited && isTrialing,
    isUnlimited,
    trialEndsAt,
    paidUntil: user.paidUntil,
  };
}

// Gates real gameplay (creating or joining a room as a signed-in account)
// behind the free trial / paid access window. Runs after requireAuth.
// Guests never hit this middleware -- guest-join has no requireAuth at all.
export const requireActiveAccess: RequestHandler = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { isGuest: true, email: true, createdAt: true, paidUntil: true },
    });
    if (!user) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
      return;
    }
    if (user.isGuest) {
      next();
      return;
    }
    const access = computeAccess(user);
    if (!access.hasAccess) {
      res.status(402).json({
        error: {
          code: 'TRIAL_EXPIRED',
          message: 'Your free trial has ended. Choose a plan in Settings to keep playing.',
        },
      });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
};

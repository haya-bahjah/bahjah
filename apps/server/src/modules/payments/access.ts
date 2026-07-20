import type { RequestHandler } from 'express';
import { prisma } from '../../db/prisma';

const TRIAL_MS = 6 * 60 * 60 * 1000;

export interface AccessState {
  hasAccess: boolean;
  isTrialing: boolean;
  trialEndsAt: Date;
  paidUntil: Date | null;
}

// Guests (isGuest) are never subject to this at all -- they're anonymous
// QR/code joiners riding on the room they joined, not a billable account.
// This is only ever evaluated for real accounts.
export function computeAccess(user: { createdAt: Date; paidUntil: Date | null }): AccessState {
  const now = Date.now();
  const trialEndsAt = new Date(user.createdAt.getTime() + TRIAL_MS);
  const isTrialing = now < trialEndsAt.getTime();
  const isPaid = Boolean(user.paidUntil && user.paidUntil.getTime() > now);
  return { hasAccess: isTrialing || isPaid, isTrialing, trialEndsAt, paidUntil: user.paidUntil };
}

// Gates real gameplay (creating or joining a room as a signed-in account)
// behind the free trial / paid access window. Runs after requireAuth.
// Guests never hit this middleware -- guest-join has no requireAuth at all.
export const requireActiveAccess: RequestHandler = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { isGuest: true, createdAt: true, paidUntil: true },
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

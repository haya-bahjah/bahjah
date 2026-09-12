import type { RequestHandler } from 'express';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { isAdminPortalToken, verifyAuthToken } from '../auth/jwt';
import '../auth/types';

// Gates the admin routes. Two ways in, checked in this order:
//
//   1. A portal session -- somebody who entered the shared passphrase into
//      the form on the admin page itself. Short-lived, carries no user.
//   2. A signed-in Bahjah account whose email is listed in ADMIN_EMAILS.
//
// The account path is the better one and stays the default: it says who
// looked, and removing someone is one list change rather than a new secret
// for everybody. The portal exists so that being locked out of your own
// dashboard does not require a deploy, and is off entirely unless
// ADMIN_PASSWORD is set.
//
// Deliberately not a secret URL token: a token in a link is the credential,
// so it leaks through browser history, screenshots and forwarded messages,
// and revoking it means revoking it for everyone at once. Both paths here
// put the credential in a request the browser makes, not in something a
// person can paste into a chat by accident.
//
// A guest account can never pass: guests have no email at all.
export const requireAdmin: RequestHandler = async (req, res, next) => {
  const deny = () => {
    // 404, not 403 -- an admin-only route should not confirm it exists to
    // someone who cannot use it.
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
  };

  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    deny();
    return;
  }

  // 1. The portal. Checked first because it is cheap and needs no database.
  if (env.adminPassword && isAdminPortalToken(token)) {
    req.adminVia = 'portal';
    next();
    return;
  }

  // 2. An account on the list.
  if (env.adminEmails.length === 0) {
    deny();
    return;
  }
  let userId: string;
  try {
    userId = verifyAuthToken(token).sub;
  } catch {
    deny();
    return;
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, isGuest: true },
    });
    if (!user || user.isGuest || !user.email) {
      deny();
      return;
    }
    if (!env.adminEmails.includes(user.email.trim().toLowerCase())) {
      deny();
      return;
    }
    req.userId = userId;
    req.adminVia = 'account';
    next();
  } catch (err) {
    next(err);
  }
};

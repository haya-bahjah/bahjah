import type { RequestHandler } from 'express';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import '../auth/types';

// Gates the admin routes on the signed-in account's email being listed in
// ADMIN_EMAILS. Runs after requireAuth, so req.userId is already populated
// and the caller has proved they hold a valid session -- this only decides
// whether that account is allowed through.
//
// Deliberately not a secret URL token: a token in a link is the credential,
// so it leaks through browser history, screenshots and forwarded messages,
// and revoking it means revoking it for everyone at once. Tying access to
// an account instead means the page is private because of who is signed in,
// and removing someone is a secrets change.
//
// A guest account can never pass: guests have no email at all.
export const requireAdmin: RequestHandler = async (req, res, next) => {
  const deny = () => {
    // 404, not 403 -- an admin-only route should not confirm it exists to
    // someone who cannot use it.
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
  };

  if (env.adminEmails.length === 0) {
    deny();
    return;
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
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
    next();
  } catch (err) {
    next(err);
  }
};

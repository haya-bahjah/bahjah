import rateLimit from 'express-rate-limit';

function tooManyRequestsHandler(_req: unknown, res: import('express').Response) {
  res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests — please slow down and try again shortly.' } });
}

// Signup/signin: generous enough for a real user mistyping a password a
// few times, tight enough to blunt brute-force/spam scripts.
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequestsHandler,
});

// Room creation: a real host might make a few rooms a night; this stops a
// script from flooding the rooms table.
export const createRoomRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequestsHandler,
});

// Contact form: unauthenticated and it sends real email, so it is the most
// attractive endpoint on the server to abuse. A person with a genuine
// question sends one message, maybe two; anything past a handful an hour
// from one address is a script.
export const contactRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequestsHandler,
});

// Forgotten passwords. Each request sends a real email to an address the
// requester chose, so an unthrottled endpoint is a way to use this server to
// spam a stranger's inbox. Tighter than signin because nobody legitimately
// asks for more than one or two reset links in an hour.
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequestsHandler,
});

// Promo redemption: the one endpoint where guessing a short string is worth
// something, so it is the one worth guessing at. A person redeeming a code
// they were given types it once, maybe twice after a typo -- anything past a
// handful an hour is somebody working through a wordlist.
export const promoRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequestsHandler,
});

// Guest join: same abuse profile as signup (anonymous, creates a User row
// and issues a JWT) so it gets the same limits.
export const guestJoinRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequestsHandler,
});

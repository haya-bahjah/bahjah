import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
// Brings the `userId` augmentation on Express.Request into scope for the
// promo limiter's key.
import '../modules/auth/types';

function tooManyRequestsHandler(_req: unknown, res: import('express').Response) {
  res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests — please slow down and try again shortly.' } });
}

// A note that applies to everything in this file.
//
// These limits are keyed on the client IP (express-rate-limit's default, and
// correct here because index.ts sets `trust proxy`, so req.ip is the real
// client rather than Render's load balancer). For a party game that makes one
// IP mean something unusual: **everybody in the room is behind it**. Twenty
// friends at a house, or fifty at a venue, share a single public address, and
// a limit written for "one person" throttles the whole party.
//
// So the limits below are split by what they are actually protecting:
//
//   * Guessing a secret (a password, a promo code) is limited per ACCOUNT,
//     because that is the thing being attacked, and a crowd on one WiFi is
//     not an attack.
//   * Burning server resources is limited per IP, generously enough that a
//     full room never trips it.
//
// Room caps are 50 players for trivia and mafia (packages/shared/src/games.ts),
// so "a full room" means fifty phones, plus their reconnects.

// Signing up or signing in, per address. This one exists to stop a script
// burning CPU: every attempt costs a bcrypt comparison, which is deliberately
// expensive, so an unbounded endpoint is a cheap way to exhaust a small
// instance. Set well above a venue full of people arriving at once.
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequestsHandler,
});

// Brute force, per account. Stacked on top of authRateLimit for the sign-in
// route only: twenty wrong passwords for one email in fifteen minutes is an
// attack whatever address they come from, while thirty different people
// signing in from one house is a Friday night.
//
// Keyed on the email in the body rather than the IP, so there is no address
// in the key and nothing for IPv6 normalisation to get wrong. A request with
// no email in it falls into one shared bucket, which is fine -- it cannot
// succeed anyway.
export const signinAccountRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequestsHandler,
  keyGenerator: (req: Request) => {
    const email = (req.body as { email?: unknown } | undefined)?.email;
    return typeof email === 'string' && email.trim() ? `email:${email.trim().toLowerCase()}` : 'email:none';
  },
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
// from one address is a script. Left per-IP and tight: nobody is at a party
// filling in the contact form.
export const contactRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequestsHandler,
});

// Forgotten passwords. Each request sends a real email to an address the
// requester chose, so an unthrottled endpoint is a way to use this server to
// spam a stranger's inbox. Per-IP and tight on purpose: a room full of people
// does not forget its passwords simultaneously.
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequestsHandler,
});

// Promo redemption. This is the one endpoint where guessing a short string
// pays, so it needs a limit -- but keyed per ACCOUNT, not per address. Keyed
// per IP it meant only ten people at a party could ever redeem a code the
// party was given, and the eleventh was told to slow down for an hour.
//
// requireAuth runs before this on the route, so req.userId is always set by
// the time the key is built.
export const promoRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequestsHandler,
  keyGenerator: (req: Request) => `user:${req.userId ?? 'anon'}`,
});

// Guest join: anonymous, creates a User row and issues a short-lived token.
//
// This was twenty per fifteen minutes per address, which is smaller than a
// single room. A twenty-five person party on one WiFi hit the wall at person
// twenty-one and the rest simply could not join -- the exact scenario the
// product is for. Sized instead for a full fifty-player room plus the
// reconnects a room that size really produces.
//
// The cost of the higher ceiling is that one address can create more junk
// guest accounts per hour. That is the right trade for a party game, but it
// does mean guest rows accumulate; a sweep of guest accounts with no recent
// membership is worth adding before this matters.
export const guestJoinRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 150,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequestsHandler,
});

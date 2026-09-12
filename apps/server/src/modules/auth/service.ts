import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { prisma } from '../../db/prisma';
import { isTestAccount } from '../payments/access';
// One mail client for the whole server. It lives under contact/ because that
// was the first thing to need it, not because it belongs to the contact form.
import { sendMail } from '../contact/mailClient';
import type { ChangePasswordInput, SigninInput, SignupInput, UpdateProfileInput } from './validation';

export class AuthError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const PUBLIC_USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  countryCode: true,
  phone: true,
  dob: true,
  avatar: true,
  isGuest: true,
  marketingOptIn: true,
  createdAt: true,
  plan: true,
  subscriptionStatus: true,
  paidUntil: true,
  cancelAtPeriodEnd: true,
  cardBrand: true,
  cardLast4: true,
} as const;

type PublicUser = { email: string | null };

// Every route that returns a user runs it through here so the client learns,
// in one place, that an account is exempt from the trial clock. Settings reads
// it to show "unlimited access" instead of a countdown that would otherwise
// read as expired while the server happily keeps letting the account in.
function withAccessFlags<T extends PublicUser>(user: T): T & { unlimitedAccess: boolean };
function withAccessFlags<T extends PublicUser>(user: T | null): (T & { unlimitedAccess: boolean }) | null;
function withAccessFlags<T extends PublicUser>(user: T | null) {
  if (!user) return null;
  return { ...user, unlimitedAccess: isTestAccount(user.email) };
}

export async function signup(input: SignupInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AuthError('EMAIL_TAKEN', 'That email is already registered.', 409);
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  return withAccessFlags(
    await prisma.user.create({
      data: {
        fullName: input.fullName,
        email: input.email,
        countryCode: input.countryCode,
        phone: input.phone,
        dob: input.dob,
        passwordHash,
        marketingOptIn: input.marketingOptIn,
      },
      select: PUBLIC_USER_SELECT,
    }),
  );
}

export async function createGuestUser(nickname: string, avatar: string | null) {
  return withAccessFlags(
    await prisma.user.create({
      data: { fullName: nickname, avatar, isGuest: true },
      select: PUBLIC_USER_SELECT,
    }),
  );
}

export async function signin(input: SigninInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.passwordHash || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AuthError('INVALID_CREDENTIALS', 'Incorrect email or password.', 401);
  }
  return { id: user.id, fullName: user.fullName, email: user.email };
}

export async function getUserById(id: string) {
  return withAccessFlags(await prisma.user.findUnique({ where: { id }, select: PUBLIC_USER_SELECT }));
}

export async function updateAvatar(id: string, avatar: string | null) {
  return withAccessFlags(
    await prisma.user.update({ where: { id }, data: { avatar }, select: PUBLIC_USER_SELECT }),
  );
}

export async function updateProfile(id: string, input: UpdateProfileInput) {
  if (input.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing && existing.id !== id) {
      throw new AuthError('EMAIL_TAKEN', 'That email is already registered.', 409);
    }
  }
  return withAccessFlags(
    await prisma.user.update({ where: { id }, data: input, select: PUBLIC_USER_SELECT }),
  );
}

export async function changePassword(id: string, input: ChangePasswordInput) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AuthError('NOT_FOUND', 'User not found.', 404);
  }
  if (!user.passwordHash) {
    throw new AuthError('NO_PASSWORD', 'This account has no password to change.', 400);
  }
  const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!valid) {
    throw new AuthError('INVALID_CREDENTIALS', 'Current password is incorrect.', 401);
  }
  const passwordHash = await bcrypt.hash(input.newPassword, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
}

// Verifies the password (same check as changePassword) then hard-deletes
// the User row. The schema's onDelete rules do the rest: rooms hosted,
// room memberships, pinned games, and saved packs cascade-delete with it;
// GameHistoryEntry/Payment rows are kept but have hostId/userId set to
// null (anonymized, not erased -- see schema.prisma's comments on those
// two models for why).
export async function deleteAccount(id: string, password: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AuthError('NOT_FOUND', 'User not found.', 404);
  }
  if (user.passwordHash) {
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AuthError('INVALID_CREDENTIALS', 'Password is incorrect.', 401);
    }
  }
  await prisma.user.delete({ where: { id } });
}


// ---------------------------------------------------------------------------
// Forgotten passwords
// ---------------------------------------------------------------------------

// Long enough that guessing is hopeless (256 bits) and short-lived enough that
// a link left in an inbox is not a standing key to the account.
const RESET_TOKEN_BYTES = 32;
const RESET_TTL_MS = 60 * 60 * 1000;

// The token is the credential, so only its hash is ever written down. SHA-256
// rather than bcrypt on purpose: bcrypt's slowness buys nothing against a
// 256-bit random value that has no pattern to guess, and the verify path
// looks the row up BY the hash, so a slow hash would mean scanning the table.
function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface PasswordResetRequestResult {
  // Whether an email actually went out. Never sent to the client -- the
  // response is deliberately identical either way (see the route) -- but the
  // caller logs it.
  sent: boolean;
}

// Starts a reset. Deliberately says nothing about whether the address is
// registered: answering that turns this endpoint into a way to find out who
// has an account, which is worth more to an attacker than it is to anyone
// else. Every outcome below returns quietly.
export async function requestPasswordReset(email: string, origin: string): Promise<PasswordResetRequestResult> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, fullName: true, isGuest: true, passwordHash: true },
  });

  // No account, a guest (no email, nothing to sign in with), or an account
  // with no password to reset -- nothing to do, and nothing to say.
  if (!user || user.isGuest || !user.email || !user.passwordHash) {
    return { sent: false };
  }

  const token = randomBytes(RESET_TOKEN_BYTES).toString('base64url');
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  // Asking again invalidates the link you were sent before, so there is only
  // ever one live link per account -- a forwarded or screenshotted older
  // email stops working the moment a new one is requested.
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } }),
  ]);

  const link = `${origin}/reset-password.html?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: user.email,
    subject: 'Reset your Bahjah password',
    text: [
      `Hi ${user.fullName},`,
      '',
      'Someone asked to reset the password on your Bahjah account. If that was you,',
      'open this link within the next hour:',
      '',
      link,
      '',
      'The link works once, and only for the next hour.',
      '',
      "If it wasn't you, you can ignore this email -- your password has not changed",
      'and nobody can get in without this link.',
      '',
      '— Bahjah',
    ].join('\n'),
  });

  return { sent: true };
}

// Finishes a reset. A token is good for exactly one use, inside its window,
// and using it retires every other live link for that account.
export async function resetPassword(token: string, newPassword: string) {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  // One message for "no such token", "already used" and "too old". Telling
  // them apart would say whether a token was ever real, which is the one
  // thing somebody guessing at links wants to know.
  const invalid = () => new AuthError('INVALID_RESET_TOKEN', 'That reset link is invalid or has expired.', 400);
  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    throw invalid();
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Anything else outstanding for this account dies with it.
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId, usedAt: null } }),
  ]);

  const user = await prisma.user.findUnique({ where: { id: record.userId }, select: PUBLIC_USER_SELECT });
  return withAccessFlags(user);
}

// Housekeeping: spent and expired links are of no use to anyone and should
// not accumulate. Called on boot; cheap enough to need no schedule of its own.
export async function purgeExpiredResetTokens(): Promise<number> {
  const { count } = await prisma.passwordResetToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] },
  });
  return count;
}

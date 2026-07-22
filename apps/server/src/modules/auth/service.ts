import bcrypt from 'bcryptjs';
import { prisma } from '../../db/prisma';
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

export async function signup(input: SignupInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AuthError('EMAIL_TAKEN', 'That email is already registered.', 409);
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  return prisma.user.create({
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
  });
}

export async function createGuestUser(nickname: string, avatar: string | null) {
  return prisma.user.create({
    data: { fullName: nickname, avatar, isGuest: true },
    select: PUBLIC_USER_SELECT,
  });
}

export async function signin(input: SigninInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.passwordHash || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AuthError('INVALID_CREDENTIALS', 'Incorrect email or password.', 401);
  }
  return { id: user.id, fullName: user.fullName, email: user.email };
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id }, select: PUBLIC_USER_SELECT });
}

export async function updateAvatar(id: string, avatar: string | null) {
  return prisma.user.update({ where: { id }, data: { avatar }, select: PUBLIC_USER_SELECT });
}

export async function updateProfile(id: string, input: UpdateProfileInput) {
  if (input.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing && existing.id !== id) {
      throw new AuthError('EMAIL_TAKEN', 'That email is already registered.', 409);
    }
  }
  return prisma.user.update({ where: { id }, data: input, select: PUBLIC_USER_SELECT });
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

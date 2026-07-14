import bcrypt from 'bcryptjs';
import { prisma } from '../../db/prisma';
import type { SigninInput, SignupInput } from './validation';

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
  avatar: true,
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

export async function signin(input: SigninInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
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

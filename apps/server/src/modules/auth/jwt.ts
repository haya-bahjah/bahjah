import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

export interface AuthTokenPayload {
  sub: string;
}

export function signAuthToken(userId: string): string {
  const payload: AuthTokenPayload = { sub: userId };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: '30d' });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.jwtSecret) as AuthTokenPayload;
}

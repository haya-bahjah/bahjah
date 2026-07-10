import type { RequestHandler } from 'express';
import { verifyAuthToken } from './jwt';
import './types';

export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required.' } });
    return;
  }
  try {
    req.userId = verifyAuthToken(token).sub;
    next();
  } catch {
    res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Session expired, sign in again.' } });
  }
};

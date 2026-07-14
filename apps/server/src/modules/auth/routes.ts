import { Router } from 'express';
import { authRateLimit } from '../../middleware/rateLimit';
import { signAuthToken } from './jwt';
import { requireAuth } from './middleware';
import { AuthError, getUserById, signin, signup, updateAvatar } from './service';
import { avatarSchema, signinSchema, signupSchema } from './validation';

export const authRouter = Router();

authRouter.post('/signup', authRateLimit, async (req, res, next) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' },
    });
    return;
  }
  try {
    const user = await signup(parsed.data);
    const token = signAuthToken(user.id);
    res.status(201).json({ token, user });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    next(err);
  }
});

authRouter.post('/signin', authRateLimit, async (req, res, next) => {
  const parsed = signinSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' },
    });
    return;
  }
  try {
    const user = await signin(parsed.data);
    const token = signAuthToken(user.id);
    res.json({ token, user });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    next(err);
  }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await getUserById(req.userId!);
    if (!user) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
      return;
    }
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

authRouter.patch('/me/avatar', requireAuth, async (req, res, next) => {
  const parsed = avatarSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' },
    });
    return;
  }
  try {
    const user = await updateAvatar(req.userId!, parsed.data.avatar);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

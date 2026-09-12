import { Router } from 'express';
import { authRateLimit, passwordResetRateLimit, signinAccountRateLimit } from '../../middleware/rateLimit';
import { signAuthToken } from './jwt';
import { requireAuth } from './middleware';
import {
  AuthError,
  changePassword,
  deleteAccount,
  getUserById,
  requestPasswordReset,
  resetPassword,
  signin,
  signup,
  updateAvatar,
  updateProfile,
} from './service';
import {
  avatarSchema,
  changePasswordSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  signinSchema,
  signupSchema,
  updateProfileSchema,
} from './validation';

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

// Two limiters, deliberately. authRateLimit is per address and generous
// enough that a house full of people signing in at once is not throttled;
// signinAccountRateLimit is per email and tight, because twenty wrong
// passwords for one account is an attack wherever it comes from.
authRouter.post('/signin', authRateLimit, signinAccountRateLimit, async (req, res, next) => {
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

// Step one of a reset: send the link.
//
// Answers exactly the same way whether or not the address is registered, and
// whether or not the mail actually went out. Anything else turns this into a
// way to ask the server which addresses have accounts -- and a reset form
// that says "no such user" is the cheapest account-enumeration tool there is.
// Failures are logged server-side instead, which is where somebody who can
// fix them will look.
authRouter.post('/forgot-password', passwordResetRateLimit, async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  const same = () =>
    res.json({
      ok: true,
      message: 'If that email has an account, a reset link is on its way.',
    });
  if (!parsed.success) {
    // Even a malformed address gets the same answer: "that is not an email"
    // is fine to say, but it should not be said by a different code path
    // with different timing.
    same();
    return;
  }
  try {
    const origin = `${req.protocol}://${req.get('host')}`;
    const { sent } = await requestPasswordReset(parsed.data.email, origin);
    if (!sent) {
      console.log(`Password reset requested for an address with no resettable account.`);
    }
  } catch (err) {
    // A mail provider being down must not tell the caller whether the
    // address exists either.
    console.error('Password reset email failed', err);
  }
  same();
});

// Step two: spend the link. Returns a session, so following the link and
// choosing a password leaves you signed in rather than at a login form.
authRouter.post('/reset-password', passwordResetRateLimit, async (req, res, next) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' },
    });
    return;
  }
  try {
    const user = await resetPassword(parsed.data.token, parsed.data.password);
    if (!user) {
      res.status(400).json({ error: { code: 'INVALID_RESET_TOKEN', message: 'That reset link is invalid or has expired.' } });
      return;
    }
    res.json({ token: signAuthToken(user.id), user });
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

authRouter.patch('/me/profile', requireAuth, async (req, res, next) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' },
    });
    return;
  }
  try {
    const user = await updateProfile(req.userId!, parsed.data);
    res.json({ user });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    next(err);
  }
});

authRouter.patch('/me/password', requireAuth, async (req, res, next) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' },
    });
    return;
  }
  try {
    await changePassword(req.userId!, parsed.data);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    next(err);
  }
});

authRouter.delete('/me', requireAuth, async (req, res, next) => {
  const parsed = deleteAccountSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' },
    });
    return;
  }
  try {
    await deleteAccount(req.userId!, parsed.data.password);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    next(err);
  }
});

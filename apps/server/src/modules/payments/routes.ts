import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { getUserById } from '../auth/service';
import { PLANS } from './plans';
import { buildCheckoutConfig, cancelSubscription, PaymentError, reconcilePayment } from './service';
import { verifyWebhookSignature } from './moyasarClient';
import { checkoutSchema, confirmSchema } from './validation';
import './types';

export const paymentsRouter = Router();

paymentsRouter.get('/plans', (_req, res) => {
  res.json({ plans: Object.values(PLANS) });
});

paymentsRouter.post('/checkout', requireAuth, async (req, res, next) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' },
    });
    return;
  }
  try {
    const origin = `${req.protocol}://${req.get('host')}`;
    const config = buildCheckoutConfig(req.userId!, parsed.data.plan, origin);
    res.json(config);
  } catch (err) {
    if (err instanceof PaymentError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    next(err);
  }
});

// Called by billing-callback.html (after a 3DS redirect) and, as a
// belt-and-suspenders measure, right after the embedded widget's
// on_completed fires for the common non-3DS case -- the webhook is the
// real source of truth, but in local/dev environments Moyasar can't reach
// localhost to deliver it, so this keeps the UI in sync either way. Only
// ever trusts a fresh fetch of the payment by id, never the caller's say-so.
paymentsRouter.post('/confirm', requireAuth, async (req, res, next) => {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' },
    });
    return;
  }
  try {
    const payment = await reconcilePayment(parsed.data.paymentId);
    const user = await getUserById(req.userId!);
    res.json({ status: payment.status, user });
  } catch (err) {
    next(err);
  }
});

paymentsRouter.post('/cancel', requireAuth, async (req, res, next) => {
  try {
    await cancelSubscription(req.userId!);
    const user = await getUserById(req.userId!);
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

// Public: Moyasar calls this directly, authenticated by HMAC signature
// rather than a bearer token. express.json()'s verify hook (see index.ts)
// stashes the exact raw bytes on req.rawBody so the signature check is
// against what was actually sent, not a re-serialized copy.
paymentsRouter.post('/webhook', async (req, res, next) => {
  try {
    const signature = req.header('x-moyasar-signature');
    if (!req.rawBody || !verifyWebhookSignature(req.rawBody, signature)) {
      res.status(401).json({ error: { code: 'INVALID_SIGNATURE', message: 'Signature verification failed.' } });
      return;
    }
    const paymentId = req.body?.data?.id ?? req.body?.id;
    if (typeof paymentId !== 'string') {
      res.status(400).json({ error: { code: 'MALFORMED_WEBHOOK', message: 'No payment id in webhook body.' } });
      return;
    }
    await reconcilePayment(paymentId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

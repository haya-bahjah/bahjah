import { env } from '../../config/env';
import { prisma } from '../../db/prisma';
import { chargeToken, fetchPayment, MoyasarError, type MoyasarPayment } from './moyasarClient';
import { getPlan, type PlanId } from './plans';

export class PaymentError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RENEWAL_ATTEMPTS = 3;
const RENEWAL_RETRY_DELAY_MS = DAY_MS;

// The DB's BillingPlan enum only knows day_pass/monthly. test_1sar is a
// staging-only plan (same duration/recurring semantics as day_pass, just a
// smaller charge to verify a live-key payment end to end) -- record it as
// day_pass rather than widening the persisted enum for a test artifact.
function toBillingPlan(planId: PlanId): 'day_pass' | 'monthly' {
  return planId === 'monthly' ? 'monthly' : 'day_pass';
}

// Everything the moyasar.js widget needs to render the embedded form and
// create the payment itself, client-side, using the publishable key. The
// server decides the amount (via PLANS) -- the client only ever picks a
// plan id, never an amount.
export function buildCheckoutConfig(userId: string, planId: string, origin: string) {
  const plan = getPlan(planId);
  if (!plan) {
    throw new PaymentError('INVALID_PLAN', 'Unknown plan.', 400);
  }
  if (!env.moyasarPublishableKey) {
    throw new PaymentError('PAYMENTS_NOT_CONFIGURED', 'Payments are not set up yet.', 503);
  }
  return {
    amount: plan.amount,
    currency: plan.currency,
    description: `Bahjah ${plan.label.en}`,
    publishableKey: env.moyasarPublishableKey,
    callbackUrl: `${origin}/billing-callback.html`,
    saveCard: plan.recurring,
    metadata: { userId, plan: plan.id, kind: 'purchase' },
  };
}

// Authoritative reconciliation: always re-fetches the payment from Moyasar
// by id using the secret key rather than trusting a status handed to us by
// the browser (redirect query params) or even the webhook body -- one code
// path for both entry points, and neither has to be trusted on its own.
export async function reconcilePayment(paymentId: string): Promise<MoyasarPayment> {
  const payment = await fetchPayment(paymentId);
  await applyPaymentResult(payment);
  return payment;
}

async function applyPaymentResult(payment: MoyasarPayment): Promise<void> {
  const userId = payment.metadata?.userId;
  const planId = payment.metadata?.plan as PlanId | undefined;
  const kind = payment.metadata?.kind === 'renewal' ? 'renewal' : 'purchase';
  if (!userId || !planId) return; // not one of ours (or malformed metadata) -- ignore
  const plan = getPlan(planId);
  if (!plan) return;

  await prisma.payment.upsert({
    where: { moyasarId: payment.id },
    create: {
      moyasarId: payment.id,
      userId,
      plan: toBillingPlan(planId),
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      kind,
    },
    update: { status: payment.status },
  });

  if (payment.status === 'paid') {
    await handlePaid(userId, planId, kind, payment);
  } else if (kind === 'renewal' && (payment.status === 'failed' || payment.status === 'voided')) {
    await handleRenewalFailure(userId);
  }
}

async function handlePaid(
  userId: string,
  planId: PlanId,
  kind: 'purchase' | 'renewal',
  payment: MoyasarPayment
): Promise<void> {
  const plan = getPlan(planId)!;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { paidUntil: true } });
  const base = user?.paidUntil && user.paidUntil.getTime() > Date.now() ? user.paidUntil.getTime() : Date.now();
  const paidUntil = new Date(base + plan.durationDays * DAY_MS);

  await prisma.user.update({
    where: { id: userId },
    data: {
      plan: toBillingPlan(planId),
      paidUntil,
      subscriptionStatus: plan.recurring ? 'active' : 'none',
      nextBillingAt: plan.recurring ? paidUntil : null,
      cancelAtPeriodEnd: false,
      renewalAttempts: 0,
      ...(plan.recurring && payment.source.token
        ? {
            cardToken: payment.source.token,
            cardBrand: payment.source.company ?? null,
            cardLast4: payment.source.last_four ?? null,
          }
        : {}),
    },
  });
  void kind; // logged via Payment row above; nothing kind-specific to do here
}

async function handleRenewalFailure(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { renewalAttempts: true } });
  const attempts = (user?.renewalAttempts ?? 0) + 1;
  if (attempts >= MAX_RENEWAL_ATTEMPTS) {
    // Give up: stop trying to charge this card. Access itself just lapses
    // naturally once paidUntil passes (computeAccess checks that live) --
    // nothing else to revoke here.
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: 'past_due',
        nextBillingAt: null,
        cardToken: null,
        cardBrand: null,
        cardLast4: null,
        renewalAttempts: attempts,
      },
    });
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: 'past_due',
        nextBillingAt: new Date(Date.now() + RENEWAL_RETRY_DELAY_MS),
        renewalAttempts: attempts,
      },
    });
  }
}

// Stops future auto-renewal without revoking whatever's already been paid
// for -- access keeps working until the existing paidUntil passes.
export async function cancelSubscription(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      cancelAtPeriodEnd: true,
      subscriptionStatus: 'canceled',
      nextBillingAt: null,
      cardToken: null,
      cardBrand: null,
      cardLast4: null,
    },
  });
}

// Called by the renewal scheduler for each Monthly subscriber whose
// nextBillingAt has arrived. Best-effort: a hard network/API failure here
// (as opposed to a card decline, which Moyasar reports as a normal 'failed'
// payment) is logged and left for the next sweep to retry.
export async function chargeRenewal(user: {
  id: string;
  cardToken: string | null;
}): Promise<void> {
  const plan = getPlan('monthly')!;
  if (!user.cardToken) {
    await handleRenewalFailure(user.id);
    return;
  }
  try {
    const payment = await chargeToken({
      amount: plan.amount,
      currency: plan.currency,
      description: `Bahjah ${plan.label.en} renewal`,
      token: user.cardToken,
      metadata: { userId: user.id, plan: plan.id, kind: 'renewal' },
    });
    await applyPaymentResult(payment);
  } catch (err) {
    if (err instanceof MoyasarError && err.body && typeof err.body === 'object' && 'id' in (err.body as object)) {
      // Moyasar still returned a payment resource (e.g. declined card) --
      // reconcile it like any other outcome.
      await applyPaymentResult(err.body as MoyasarPayment);
    } else {
      console.error(`renewal charge failed for user ${user.id}`, err);
      await handleRenewalFailure(user.id);
    }
  }
}

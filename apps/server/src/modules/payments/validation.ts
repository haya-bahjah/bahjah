import { z } from 'zod';

// Purchasable plan ids only. 'monthly' is deliberately absent: it is still a
// real plan server-side (existing subscribers renew against it), but it is
// withdrawn from sale, so a checkout can no longer be opened for it. See
// PLANS.monthly.purchasable in ./plans.
export const checkoutSchema = z.object({
  plan: z.enum(['day_pass', 'test_50sar', 'test_150sar']),
});

export const confirmSchema = z.object({
  paymentId: z.string().min(1),
});

// A promo code as typed. Bounded and character-restricted so the handler is
// never asked to look up a novel -- it is normalized (trimmed, upper-cased)
// in promos.ts before anything is matched against it.
export const promoSchema = z.object({
  code: z.string().trim().min(1, 'Enter a code.').max(32).regex(/^[A-Za-z0-9-]+$/, "That code isn't valid."),
});

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

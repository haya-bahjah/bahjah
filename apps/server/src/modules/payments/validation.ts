import { z } from 'zod';

export const checkoutSchema = z.object({
  plan: z.enum(['day_pass', 'monthly', 'test_50sar', 'test_150sar']),
});

export const confirmSchema = z.object({
  paymentId: z.string().min(1),
});

import { z } from 'zod';
import { MAX_ROUNDS, MIN_ROUNDS, WRITE_SECONDS_CHOICES } from './config';

export const fabricationConfigSchema = z.object({
  rounds: z.number().int().min(MIN_ROUNDS).max(MAX_ROUNDS),
  writeSeconds: z
    .number()
    .int()
    .refine((s) => (WRITE_SECONDS_CHOICES as readonly number[]).includes(s), 'The timer is 45, 60 or 90 seconds.')
    .default(60),
  language: z.enum(['en', 'ar']).default('en'),
});

export type FabricationConfigInput = z.infer<typeof fabricationConfigSchema>;

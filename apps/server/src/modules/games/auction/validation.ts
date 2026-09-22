import { z } from 'zod';
import { ANSWER_SECONDS_CHOICES, MAX_ROUNDS, MIN_ROUNDS } from './config';

export const auctionConfigSchema = z.object({
  rounds: z.number().int().min(MIN_ROUNDS).max(MAX_ROUNDS),
  answerSeconds: z.number().int().refine((n) => ANSWER_SECONDS_CHOICES.includes(n), {
    message: `Answer timer must be one of ${ANSWER_SECONDS_CHOICES.join(', ')} seconds.`,
  }),
  categoryIds: z.array(z.string().trim().min(1)).max(100).default([]),
});

export type AuctionConfigInput = z.infer<typeof auctionConfigSchema>;

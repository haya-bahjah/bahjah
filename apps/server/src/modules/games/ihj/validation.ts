import { z } from 'zod';
import { ANSWER_SECONDS_CHOICES, CATEGORY_COUNT, MAX_ROUNDS, MIN_ROUNDS } from './config';

export const ihjConfigSchema = z.object({
  rounds: z.number().int().min(MIN_ROUNDS).max(MAX_ROUNDS),
  answerSeconds: z.number().int().refine((n) => ANSWER_SECONDS_CHOICES.includes(n), {
    message: `Answer timer must be one of ${ANSWER_SECONDS_CHOICES.join(', ')} seconds.`,
  }),
  // Exactly five, or none at all: the board is five columns wide and a room
  // that sent four would be playing a different game.
  categoryIds: z.array(z.string().trim().min(1)).length(CATEGORY_COUNT).or(z.array(z.string()).length(0)).default([]),
});

export type IhjConfigInput = z.infer<typeof ihjConfigSchema>;

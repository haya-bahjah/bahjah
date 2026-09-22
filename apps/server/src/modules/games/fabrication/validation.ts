import { z } from 'zod';
import { MAX_ROUNDS, MIN_ROUNDS } from './config';

export const fabricationConfigSchema = z.object({
  rounds: z.number().int().min(MIN_ROUNDS).max(MAX_ROUNDS),
  difficulty: z.enum(['any', 'easy', 'medium', 'hard']),
  categories: z.array(z.string().trim().min(1)).max(50).default([]),
});

export type FabricationConfigInput = z.infer<typeof fabricationConfigSchema>;

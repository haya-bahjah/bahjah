import { z } from 'zod';
import { KYB_BUILTIN_CATEGORIES } from './promptBank';

export const knowsYouBestConfigSchema = z.object({
  totalRounds: z.number().int().min(3).max(10),
  categories: z
    .array(z.enum(KYB_BUILTIN_CATEGORIES as [string, ...string[]]))
    .min(1, 'Pick a difficulty.')
    .max(KYB_BUILTIN_CATEGORIES.length),
});

export type KnowsYouBestConfigInput = z.infer<typeof knowsYouBestConfigSchema>;

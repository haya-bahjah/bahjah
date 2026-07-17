import { z } from 'zod';
import { KYB_BUILTIN_CATEGORIES } from './promptBank';

const customPromptSchema = z.object({
  text: z.string().trim().min(1).max(300),
  textAr: z.string().trim().min(1).max(300).nullable().optional(),
});

export const knowsYouBestConfigSchema = z
  .object({
    totalRounds: z.number().int().min(3).max(10),
    hostPlays: z.boolean(),
    categories: z.array(z.enum(KYB_BUILTIN_CATEGORIES as [string, ...string[]])).max(KYB_BUILTIN_CATEGORIES.length),
    useCustomQuestions: z.boolean(),
  })
  .refine((data) => data.categories.length > 0 || data.useCustomQuestions, {
    message: 'Pick at least one category, or enable custom questions.',
    path: ['categories'],
  });

export const knowsYouBestCustomPromptsSchema = z.object({
  prompts: z.array(customPromptSchema).max(20),
});

export type KnowsYouBestConfigInput = z.infer<typeof knowsYouBestConfigSchema>;

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
  // Optional name for this custom set -- when provided (and there are
  // enough prompts), it's auto-saved to the host's "My Games" under that
  // name. Purely a save-time label, never persisted on the room-scoped
  // KnowsYouBestCustomPrompt rows themselves.
  packName: z.string().trim().max(40).optional(),
});

export type KnowsYouBestConfigInput = z.infer<typeof knowsYouBestConfigSchema>;

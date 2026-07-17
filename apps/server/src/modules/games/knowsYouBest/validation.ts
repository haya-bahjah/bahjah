import { z } from 'zod';

const customPromptSchema = z.object({
  text: z.string().trim().min(1).max(300),
  textAr: z.string().trim().min(1).max(300).nullable().optional(),
});

export const knowsYouBestConfigSchema = z.object({
  totalRounds: z.number().int().min(3).max(10),
  hostPlays: z.boolean(),
  useCustomQuestions: z.boolean(),
});

export const knowsYouBestCustomPromptsSchema = z.object({
  prompts: z.array(customPromptSchema).max(20),
});

export type KnowsYouBestConfigInput = z.infer<typeof knowsYouBestConfigSchema>;

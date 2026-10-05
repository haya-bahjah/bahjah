import { z } from 'zod';

const choiceSchema = z.string().trim().min(1).max(120);

const customQuestionSchema = z.object({
  prompt: z.string().trim().min(1).max(300),
  choices: z.tuple([choiceSchema, choiceSchema, choiceSchema, choiceSchema]),
  correctIndex: z.number().int().min(0).max(3),
});

const customCategorySchema = z.object({
  name: z.string().trim().min(1).max(40),
  questions: z.array(customQuestionSchema).min(1).max(30),
});

const difficultySchema = z.enum(['easy', 'medium', 'hard']);

// `difficulties` is the multi-select (any 1-3 of easy/medium/hard). The
// old single `difficulty` field is still accepted so a tab left open on the
// previous lobby script keeps saving until it's refreshed.
export const triviaConfigSchema = z
  .object({
    difficulties: z.array(difficultySchema).min(1, 'Pick at least one difficulty.').max(3).optional(),
    difficulty: difficultySchema.optional(),
    categories: z.array(z.string().trim().min(1)).max(50).default([]),
    customCategories: z.array(customCategorySchema).max(10).default([]),
  })
  .refine((v) => v.difficulties !== undefined || v.difficulty !== undefined, {
    message: 'Pick at least one difficulty.',
    path: ['difficulties'],
  })
  .transform(({ difficulty, difficulties, ...rest }) => ({
    ...rest,
    difficulties: difficulties ?? [difficulty!],
  }));

export type TriviaConfigInput = z.infer<typeof triviaConfigSchema>;

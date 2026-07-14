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

export const triviaConfigSchema = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard']),
  categories: z.array(z.string().trim().min(1)).max(50).default([]),
  customCategories: z.array(customCategorySchema).max(10).default([]),
});

export type TriviaConfigInput = z.infer<typeof triviaConfigSchema>;

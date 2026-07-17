import { prisma } from '../../../db/prisma';

export type TriviaDifficulty = 'easy' | 'medium' | 'hard';

export interface TriviaQuestion {
  id: string;
  category: string;
  difficulty: TriviaDifficulty;
  prompt: string;
  // Arabic translation, only present for seeded bank questions that have
  // one -- host-authored custom questions never get translated, so clients
  // must fall back to prompt/choices when these are missing.
  promptAr?: string;
  choices: string[];
  choicesAr?: string[];
  correctIndex: number;
}

// The bank is tiny (hundreds of rows) and rarely changes, so it's loaded
// once at server startup and read synchronously afterward — the trivia
// engine stays a pure, synchronous function like the rest of the game
// engine framework, with no per-call database round trip.
let cache: TriviaQuestion[] | null = null;

export async function loadQuestionBank(): Promise<void> {
  const rows = await prisma.triviaQuestion.findMany();
  cache = rows.map((row) => ({
    id: row.id,
    category: row.category,
    difficulty: row.difficulty,
    prompt: row.prompt,
    promptAr: row.promptAr ?? undefined,
    choices: row.choices,
    choicesAr: row.choicesAr.length > 0 ? row.choicesAr : undefined,
    correctIndex: row.correctIndex,
  }));
}

export function getQuestionBankSync(): TriviaQuestion[] {
  if (!cache) {
    throw new Error('Trivia question bank not loaded — call loadQuestionBank() at server startup.');
  }
  return cache;
}

export function getBankCategoriesSync(): Array<{ name: string; counts: Record<TriviaDifficulty, number> }> {
  const byCategory = new Map<string, Record<TriviaDifficulty, number>>();
  for (const q of getQuestionBankSync()) {
    const counts = byCategory.get(q.category) ?? { easy: 0, medium: 0, hard: 0 };
    counts[q.difficulty] += 1;
    byCategory.set(q.category, counts);
  }
  return Array.from(byCategory.entries())
    .map(([name, counts]) => ({ name, counts }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

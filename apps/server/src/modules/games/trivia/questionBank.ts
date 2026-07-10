import { prisma } from '../../../db/prisma';

export interface TriviaQuestion {
  id: string;
  category: string;
  prompt: string;
  choices: string[];
  correctIndex: number;
}

// The bank is tiny (tens of rows) and rarely changes, so it's loaded once
// at server startup and read synchronously afterward — the trivia engine
// stays a pure, synchronous function like the rest of the game engine
// framework, with no per-call database round trip.
let cache: TriviaQuestion[] | null = null;

export async function loadQuestionBank(): Promise<void> {
  const rows = await prisma.triviaQuestion.findMany();
  cache = rows.map((row) => ({
    id: row.id,
    category: row.category,
    prompt: row.prompt,
    choices: row.choices,
    correctIndex: row.correctIndex,
  }));
}

export function getQuestionBankSync(): TriviaQuestion[] {
  if (!cache) {
    throw new Error('Trivia question bank not loaded — call loadQuestionBank() at server startup.');
  }
  return cache;
}

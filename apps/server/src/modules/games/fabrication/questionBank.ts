import { prisma } from '../../../db/prisma';

export type FabricationDifficulty = 'easy' | 'medium' | 'hard';

export interface FabricationQuestion {
  id: string;
  category: string;
  difficulty: FabricationDifficulty;
  prompt: string;
  promptAr: string;
  answer: string;
  answerAr: string;
  // Alternative wordings of the same answer. Only ever used to recognise a
  // fabrication that is accidentally the truth -- never shown to a player,
  // and never the text the reveal prints.
  acceptedVariants: string[];
  acceptedVariantsAr: string[];
  source: string;
  sourceUrl?: string;
}

// Same arrangement as the trivia bank: a few hundred rows that change rarely,
// loaded once at startup so the engine stays the synchronous pure function the
// framework expects, with no database round trip inside a round.
let cache: FabricationQuestion[] | null = null;

export async function loadFabricationBank(): Promise<void> {
  const rows = await prisma.fabricationQuestion.findMany({ where: { active: true } });
  cache = rows.map((row) => ({
    id: row.id,
    category: row.category,
    difficulty: row.difficulty,
    prompt: row.prompt,
    promptAr: row.promptAr,
    answer: row.answer,
    answerAr: row.answerAr,
    acceptedVariants: row.acceptedVariants,
    acceptedVariantsAr: row.acceptedVariantsAr,
    source: row.source,
    sourceUrl: row.sourceUrl ?? undefined,
  }));
}

export function getFabricationBankSync(): FabricationQuestion[] {
  if (!cache) {
    throw new Error('Fabrication bank not loaded — call loadFabricationBank() at server startup.');
  }
  return cache;
}

export function getFabricationCategoriesSync(): Array<{ name: string; counts: Record<FabricationDifficulty, number> }> {
  const byCategory = new Map<string, Record<FabricationDifficulty, number>>();
  for (const q of getFabricationBankSync()) {
    const counts = byCategory.get(q.category) ?? { easy: 0, medium: 0, hard: 0 };
    counts[q.difficulty] += 1;
    byCategory.set(q.category, counts);
  }
  return Array.from(byCategory.entries())
    .map(([name, counts]) => ({ name, counts }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

import { prisma } from '../../../db/prisma';

export interface KnowsYouBestPrompt {
  id: string;
  category: string;
  text: string;
}

// Loaded once at server startup, same pattern as the trivia question bank —
// small, rarely-changing dataset, read synchronously afterward.
let cache: KnowsYouBestPrompt[] | null = null;

export async function loadPromptBank(): Promise<void> {
  const rows = await prisma.knowsYouBestPrompt.findMany();
  cache = rows.map((row) => ({ id: row.id, category: row.category, text: row.text }));
}

export function getPromptBankSync(): KnowsYouBestPrompt[] {
  if (!cache) {
    throw new Error('Knows-you-best prompt bank not loaded — call loadPromptBank() at server startup.');
  }
  return cache;
}

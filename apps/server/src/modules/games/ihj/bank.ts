import { prisma } from '../../../db/prisma';

export type IhjDifficulty = 'easy' | 'medium' | 'hard';

export interface IhjLetter {
  id: string;
  letter: string;
  difficulty: IhjDifficulty;
  weight: number;
}

export interface IhjCategory {
  id: string;
  name: string;
  isDefault: boolean;
}

// Both lists are tiny and change rarely, so they are read once at startup and
// held in memory -- the engine stays the synchronous pure function the
// framework expects, with no database round trip inside a round.
let letters: IhjLetter[] | null = null;
let categories: IhjCategory[] | null = null;

export async function loadIhjBank(): Promise<void> {
  const [letterRows, categoryRows] = await Promise.all([
    prisma.ihjLetter.findMany({ where: { active: true } }),
    prisma.ihjCategory.findMany({ where: { active: true }, orderBy: { createdAt: 'asc' } }),
  ]);
  letters = letterRows.map((row) => ({
    id: row.id,
    letter: row.letter,
    difficulty: row.difficulty as IhjDifficulty,
    weight: row.weight,
  }));
  categories = categoryRows.map((row) => ({ id: row.id, name: row.name, isDefault: row.isDefault }));
}

export function getIhjLettersSync(): IhjLetter[] {
  if (!letters) throw new Error('إنسان حيوان جماد letters not loaded — call loadIhjBank() at server startup.');
  return letters;
}

export function getIhjCategoriesSync(): IhjCategory[] {
  if (!categories) throw new Error('إنسان حيوان جماد categories not loaded — call loadIhjBank() at server startup.');
  return categories;
}

// Draws the letters for a whole game up front, weighted and without repeats:
// meeting the same letter twice in five rounds is the one thing that makes a
// short game feel thin. If the pool is smaller than the round count (only
// reachable if somebody deactivates most of it) the draw simply returns what
// there is, and the game is that many rounds long.
export function drawLetters(count: number): IhjLetter[] {
  const pool = [...getIhjLettersSync()];
  const drawn: IhjLetter[] = [];
  while (drawn.length < count && pool.length > 0) {
    const total = pool.reduce((sum, l) => sum + Math.max(1, l.weight), 0);
    let ticket = Math.random() * total;
    let index = 0;
    for (let i = 0; i < pool.length; i += 1) {
      ticket -= Math.max(1, pool[i].weight);
      if (ticket <= 0) {
        index = i;
        break;
      }
    }
    drawn.push(pool[index]);
    pool.splice(index, 1);
  }
  return drawn;
}

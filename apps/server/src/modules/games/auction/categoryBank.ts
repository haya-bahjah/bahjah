import { prisma } from '../../../db/prisma';

export interface AuctionCategory {
  id: string;
  name: string;
  nameAr: string;
  minAnswers: number;
  maxAnswers?: number;
}

// Loaded once at startup, like the other banks, so the engine stays a
// synchronous pure function with no database round trip inside a round.
let cache: AuctionCategory[] | null = null;

export async function loadAuctionCategories(): Promise<void> {
  const rows = await prisma.auctionCategory.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  cache = rows.map((row) => ({
    id: row.id,
    name: row.name,
    nameAr: row.nameAr,
    minAnswers: row.minAnswers,
    maxAnswers: row.maxAnswers ?? undefined,
  }));
}

export function getAuctionCategoriesSync(): AuctionCategory[] {
  if (!cache) {
    throw new Error('Auction categories not loaded — call loadAuctionCategories() at server startup.');
  }
  return cache;
}

import type { Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { toPrismaGameType } from '../rooms/mappers';

// Mirrors the same minimum item counts dashboardRoutes.ts's createPackSchema
// enforces for a manually-created pack (trivia needs >=10 to clear
// MIN_POOL_SIZE once hosted; knows-you-best needs >=3 to clear
// knowsYouBestConfigSchema's totalRounds minimum) -- a custom category/set
// below that is still perfectly fine for the room it was typed into, it
// just doesn't get promoted to a reusable "My Games" pack yet.
const MIN_ITEMS: Record<'trivia' | 'knows-you-best', number> = {
  trivia: 10,
  'knows-you-best': 3,
};

async function isGuestUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isGuest: true } });
  // Fail closed: if the user row can't be found for some reason, skip the
  // sync rather than risk creating a pack under a dangling userId.
  return user?.isGuest ?? true;
}

// Auto-saves a host's custom trivia category or knows-you-best custom
// question set into their "My Games" (QuestionPack), upserted by
// (userId, gameType, name) so re-saving the same named category while still
// setting up the room updates the pack in place instead of duplicating it.
// Silently skipped for guest hosts (no persistent "My Games" to save into)
// and for sets below the pack minimum.
export async function syncCustomSetToPack(
  userId: string,
  gameType: 'trivia' | 'knows-you-best',
  name: string,
  items: unknown[]
): Promise<void> {
  const trimmedName = name.trim();
  if (!trimmedName || items.length < MIN_ITEMS[gameType]) return;
  if (await isGuestUser(userId)) return;

  const prismaGameType = toPrismaGameType(gameType);
  const jsonItems = items as unknown as Prisma.InputJsonValue;
  const existing = await prisma.questionPack.findFirst({
    where: { userId, gameType: prismaGameType, name: trimmedName },
  });
  if (existing) {
    await prisma.questionPack.update({ where: { id: existing.id }, data: { items: jsonItems } });
  } else {
    await prisma.questionPack.create({ data: { userId, gameType: prismaGameType, name: trimmedName, items: jsonItems } });
  }
}

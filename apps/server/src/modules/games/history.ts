import type { GameType } from '@bahjah/shared';
import { prisma } from '../../db/prisma';
import { toPrismaGameType } from '../rooms/mappers';
import { getGameEngine, type GameEngineContext } from './engine';

// Called right when an engine resolves a game to phase 'finished' (see the
// call sites in rooms/socket.ts and games/scheduler.ts) -- never for a room
// a host manually ends mid-game. A persistence hiccup here shouldn't break
// the live game for players already looking at the finished screen, so
// failures are swallowed after logging.
export async function persistGameHistory(
  code: string,
  gameType: GameType,
  ctx: GameEngineContext,
  data: unknown
): Promise<void> {
  const engine = getGameEngine(gameType);
  if (!engine.getFinalResults) return;
  try {
    const host = ctx.members.find((m) => m.isHost);
    if (!host) return;
    const nameOf = (userId: string) => ctx.members.find((m) => m.userId === userId)?.displayName ?? userId;
    const results = engine.getFinalResults(data).map((r) => ({ ...r, displayName: nameOf(r.userId) }));
    await prisma.gameHistoryEntry.create({
      data: { roomCode: code, gameType: toPrismaGameType(gameType), hostId: host.userId, results },
    });
  } catch (err) {
    console.error(`Failed to persist game history for room ${code}:`, err);
  }
}

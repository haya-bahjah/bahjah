import { prisma } from '../../../db/prisma';
import { redis } from '../../../db/redis';
import { ROOMS, FIRST_ROOM, type RoomId } from './content';

// What a Saudi Home game needs to know before it starts, beyond who is in the
// room: which event it belongs to, any rooms the host picked by hand in the
// lobby, and what this host's screen has shown recently.
export interface SaudiHomeConfig {
  eventId: string | null;
  // Up to four rooms, in order, to follow the Majlis. Empty means random.
  rooms: RoomId[];
  // Room keys ('room:<id>') and challenge ids this host has shown lately.
  recent: string[];
}

const PICK_TTL_SECONDS = 60 * 60 * 12;
const pickKey = (code: string) => `bahjah:saudi-home-rooms:${code}`;

export function pickableRooms(): RoomId[] {
  return ROOMS.filter((r) => r.active && r.id !== FIRST_ROOM).map((r) => r.id);
}

export async function saveSaudiHomeRooms(code: string, rooms: RoomId[]): Promise<void> {
  if (rooms.length === 0) {
    await redis.del(pickKey(code));
    return;
  }
  await redis.set(pickKey(code), JSON.stringify(rooms), 'EX', PICK_TTL_SECONDS);
}

export async function getSaudiHomeRooms(code: string): Promise<RoomId[]> {
  const raw = await redis.get(pickKey(code));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is RoomId => pickableRooms().includes(id)) : [];
  } catch {
    return [];
  }
}

// Per-host memory, like the quiz's: an event screen hosting group after group
// draws rooms and questions the last groups have not just seen.
const RECENT_TTL_SECONDS = 60 * 60 * 24 * 7;
const RECENT_MAX = 60;
const recentKey = (hostId: string) => `bahjah:saudi-home-recent:${hostId}`;

export async function recordRecentContent(hostId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const key = recentKey(hostId);
  await redis.multi().lpush(key, ...ids).ltrim(key, 0, RECENT_MAX - 1).expire(key, RECENT_TTL_SECONDS).exec();
}

export async function loadSaudiHomeConfig(code: string): Promise<SaudiHomeConfig> {
  const room = await prisma.room.findUnique({ where: { code }, select: { eventId: true, hostId: true } });
  const [rooms, recent] = await Promise.all([
    getSaudiHomeRooms(code),
    room ? redis.lrange(recentKey(room.hostId), 0, RECENT_MAX - 1) : Promise.resolve([] as string[]),
  ]);
  return { eventId: room?.eventId ?? null, rooms, recent };
}

// The calendar day in Riyadh (UTC+3, no daylight saving), which is what an
// event's "today" means.
export function riyadhDay(at = new Date()): string {
  return new Date(at.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export async function saveSaudiHomeResults(input: {
  code: string;
  eventId: string;
  questionCount: number;
  standings: Array<{
    userId: string;
    name: string;
    score: number;
    rank: number;
    correctCount: number;
    correctTimeMs: number;
    shareToken: string;
  }>;
}): Promise<void> {
  if (input.standings.length === 0) return;
  const day = riyadhDay();
  await prisma.saudiHomeResult.createMany({
    data: input.standings.map((s) => ({
      shareToken: s.shareToken,
      eventId: input.eventId,
      roomCode: input.code,
      displayName: s.name,
      score: s.score,
      rank: s.rank,
      playerCount: input.standings.length,
      correctCount: s.correctCount,
      questionCount: input.questionCount,
      correctTimeMs: s.correctTimeMs,
      day,
    })),
    skipDuplicates: true,
  });
}

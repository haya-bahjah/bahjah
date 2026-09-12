import { prisma } from '../../db/prisma';
import { redis } from '../../db/redis';

// Rooms nobody ever closed.
//
// A room is marked `ended` in exactly one place -- a host deliberately ending
// a game in progress (service.ts). Everything else leaves the row behind:
// closing the tab, losing signal, finishing a game and walking away. Nothing
// expired them, so they accumulated forever, and by September the table held
// 153 open rooms for a product that had not launched. That is a slow leak in
// a table every join reads, and it made the dashboard's "right now" figures
// nonsense.
//
// So: a room with nobody connected to it for ten minutes is gone, along with
// everything scoped to it. Real game history is not touched -- GameHistoryEntry
// stores its own roomCode snapshot precisely so it outlives the room.
//
// Ten minutes of *continuous* emptiness, not one empty reading. Mobile
// browsers suspend sockets when a phone locks or the tab goes to the
// background, so a live game can briefly show zero connections. The first
// sweep that finds a room empty only writes down when it first looked; a
// later sweep deletes it, and any reconnection in between clears the mark.
// Without that, a quiet minute mid-game would delete the room out from under
// the people playing in it.
//
// The emptiness clock lives in Redis rather than a column on Room, for the
// reason this sweep exists at all: a column would mean a write on every
// connect and disconnect -- thousands during a busy game -- to answer a
// question asked twice an hour. This writes one small key per empty room,
// once, and only for rooms that are already idle.

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
// How long a room must stay empty before it is removed.
const EMPTY_GRACE_MS = 10 * 60 * 1000;
// Nothing newly created is ever swept, however empty: a host who has just
// made a room has not connected to it yet.
const MIN_AGE_MS = EMPTY_GRACE_MS;
// A ceiling on one sweep's work, so a backlog is cleared over several passes
// instead of one long transaction holding the table.
const MAX_PER_SWEEP = 200;
// Comfortably longer than the grace period; the key is rewritten whenever a
// room is still empty and deleted the moment somebody connects, so this only
// has to outlive the gap between two sweeps.
const MARK_TTL_SECONDS = 60 * 60;

const emptySinceKey = (code: string) => `bahjah:room-empty:${code}`;

// Everything Redis holds for one room. Deleting the room without these would
// swap a growing Postgres table for a growing Redis keyspace.
const roomKeys = (code: string) => [
  `bahjah:presence:${code}`,
  `bahjah:game-state:${code}`,
  `bahjah:trivia-config:${code}`,
  `bahjah:kyb-config:${code}`,
  `bahjah:mafia-config:${code}`,
  emptySinceKey(code),
];

export async function sweepAbandonedRooms(now = Date.now()): Promise<number> {
  const open = await prisma.room.findMany({
    where: { status: { in: ['lobby', 'in_progress'] } },
    select: { id: true, code: true, createdAt: true },
  });
  if (open.length === 0) return 0;

  // One round trip for every room's connection count, and one for the marks.
  const counts = redis.pipeline();
  for (const room of open) counts.hlen(`bahjah:presence:${room.code}`);
  const marks = redis.pipeline();
  for (const room of open) marks.get(emptySinceKey(room.code));
  const [countResults, markResults] = await Promise.all([counts.exec(), marks.exec()]);

  const value = (results: unknown[] | null, i: number): unknown => {
    const entry = results?.[i] as [Error | null, unknown] | undefined;
    if (!entry || entry[0]) return null;
    return entry[1];
  };

  const doomed: { id: string; code: string }[] = [];
  const toMark: string[] = [];
  const toClear: string[] = [];

  open.forEach((room, i) => {
    const connected = value(countResults, i);
    if (typeof connected === 'number' && connected > 0) {
      // Somebody is in it. Anything we wrote down about it being empty is
      // stale, whether or not a mark exists.
      toClear.push(room.code);
      return;
    }
    if (now - room.createdAt.getTime() < MIN_AGE_MS) return;

    const raw = value(markResults, i);
    const emptySince = typeof raw === 'string' ? Number(raw) : NaN;
    if (!Number.isFinite(emptySince)) {
      // First time we have seen it empty -- start its clock, delete nothing.
      toMark.push(room.code);
      return;
    }
    if (now - emptySince >= EMPTY_GRACE_MS && doomed.length < MAX_PER_SWEEP) {
      doomed.push({ id: room.id, code: room.code });
    }
  });

  if (toMark.length > 0 || toClear.length > 0) {
    const pipeline = redis.pipeline();
    for (const code of toMark) pipeline.set(emptySinceKey(code), String(now), 'EX', MARK_TTL_SECONDS);
    for (const code of toClear) pipeline.del(emptySinceKey(code));
    await pipeline.exec();
  }

  if (doomed.length === 0) return 0;

  const ids = doomed.map((r) => r.id);
  const codes = doomed.map((r) => r.code);

  // Room members go with the room by cascade. The two custom-question tables
  // are keyed by room code rather than by a foreign key, so nothing removes
  // them on our behalf -- they are per-room scratch content and are of no use
  // once the room is gone.
  await prisma.$transaction([
    prisma.triviaCustomQuestion.deleteMany({ where: { roomCode: { in: codes } } }),
    prisma.knowsYouBestCustomPrompt.deleteMany({ where: { roomCode: { in: codes } } }),
    prisma.room.deleteMany({ where: { id: { in: ids } } }),
  ]);

  const cleanup = redis.pipeline();
  for (const code of codes) for (const key of roomKeys(code)) cleanup.del(key);
  await cleanup.exec();

  console.log(`room sweep: removed ${doomed.length} abandoned room(s)`);
  return doomed.length;
}

let timer: NodeJS.Timeout | null = null;

export function startRoomSweeper(): void {
  if (timer) return;
  const run = () => {
    sweepAbandonedRooms().catch((err) => console.error('room sweep failed', err));
  };
  timer = setInterval(run, SWEEP_INTERVAL_MS);
  // Unref'd so a pending sweep can never hold the process open on shutdown.
  timer.unref();
  // Not at the instant of boot: let the question banks and the first
  // connections settle first.
  setTimeout(run, 60_000).unref();
}

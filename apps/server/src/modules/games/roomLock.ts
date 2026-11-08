import { randomUUID } from 'crypto';
import { redis } from '../../db/redis';

// Serializes game-state read-modify-write operations per room code. Both
// rooms/socket.ts's game:action handler and this module's own tick
// scheduler (scheduler.ts) mutate the same Redis-backed game state via
// loadGameState -> (engine logic) -> saveGameState; two such operations on
// the same room landing close together -- e.g. several players submitting
// around the same moment, or a scheduled tick firing right as someone
// acts -- can otherwise interleave: the later save overwrites state read
// before the earlier save landed, silently dropping that update. Awaiting
// withRoomLock around each read-modify-write closes that window. Lives in
// its own module (not rooms/socket.ts) so scheduler.ts can use it too
// without a circular import (socket.ts already imports from scheduler.ts).
//
// The lock is taken twice over, and the two halves do different jobs.
//
// IN THIS PROCESS, a promise chain per room code. Almost all contention is
// local -- the players of one room are usually on one machine -- and this
// settles it with no network at all.
//
// ACROSS MACHINES, a Redis key. The chain above is only a chain within one
// process: a second machine knows nothing about it, and the two would read
// the same state, run the engine on it and both save, with the later save
// erasing the earlier one. Nobody would see an error; a player would simply
// find their answer had not counted. There is one machine in production
// today, which is exactly what makes this worth writing down -- the fault
// does not exist until the day somebody scales out, and then it looks like
// a game losing moves at random.
const locks = new Map<string, Promise<unknown>>();

// Comfortably longer than a read-modify-write (tens of milliseconds) and
// short enough that a machine killed mid-section frees the room quickly.
const LOCK_TTL_MS = 5000;
// How long another machine waits for the holder before going ahead anyway.
const LOCK_WAIT_MS = 5000;
const LOCK_POLL_MS = 25;

const lockKey = (code: string) => `bahjah:room-lock:${code}`;

// Release only our own hold: a section that overran its TTL must not delete
// the lock the next machine has since taken.
const RELEASE = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function acquire(code: string): Promise<string | null> {
  const token = randomUUID();
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    const won = await redis.set(lockKey(code), token, 'PX', LOCK_TTL_MS, 'NX');
    if (won) return token;
    if (Date.now() >= deadline) return null;
    await sleep(LOCK_POLL_MS);
  }
}

async function withRedisLock<T>(code: string, fn: () => Promise<T>): Promise<T> {
  let token: string | null = null;
  try {
    token = await acquire(code);
  } catch {
    // Redis is unreachable. Run anyway rather than freeze the game: the
    // in-process chain still holds, so a single machine is unaffected, and
    // a room whose Redis is down has larger problems than this (the game
    // state itself lives there). Failing open keeps a running game running;
    // failing closed would stop it dead.
    return fn();
  }
  // Waited out the holder. Either a machine died mid-section or something
  // is genuinely slow; going ahead risks the interleave this lock exists to
  // prevent, but hanging a player's tap forever is the worse of the two.
  if (!token) {
    console.warn(`room lock: gave up waiting for ${code} after ${LOCK_WAIT_MS}ms, proceeding`);
    return fn();
  }
  try {
    return await fn();
  } finally {
    try {
      await redis.eval(RELEASE, 1, lockKey(code), token);
    } catch {
      // The key expires on its own; nothing to recover.
    }
  }
}

export function withRoomLock<T>(code: string, fn: () => Promise<T>): Promise<T> {
  const run = () => withRedisLock(code, fn);
  const prior = locks.get(code) ?? Promise.resolve();
  const result = prior.then(run, run);
  locks.set(code, result.catch(() => undefined));
  return result;
}

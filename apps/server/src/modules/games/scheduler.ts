import type { GameStatePayload } from '@bahjah/shared';
import { roomBotIds, settleBots } from './bots';
import { getGameEngine, type GameEngineContext } from './engine';
import { persistGameHistory } from './history';
import { withRoomLock } from './roomLock';
import { loadGameState, saveGameState } from './state';

type Broadcast = (code: string, state: GameStatePayload) => void | Promise<void>;
type GetContext = (code: string) => Promise<GameEngineContext | null>;

let broadcast: Broadcast = () => {};
let getContext: GetContext = async () => null;
const timers = new Map<string, NodeJS.Timeout>();
const botTimers = new Map<string, NodeJS.Timeout>();

// When in a phase the bots commit the actions that end it (see bots.ts).
// Held back to the last stretch of the phase timer so a room full of bots
// doesn't resolve the night the instant it opens -- the humans at the table
// still get most of the phase to talk, scheme and use their own abilities.
// Proportional so a 20-second vote and a 3-minute night both feel right,
// with a floor and a ceiling so neither extreme is silly.
const BOT_HEADROOM_FRACTION = 0.3;
const BOT_HEADROOM_MIN_MS = 2000;
const BOT_HEADROOM_MAX_MS = 20000;

function botCommitDelay(nextTickAt: number): number {
  const remaining = nextTickAt - Date.now();
  if (remaining <= 0) return 0;
  const headroom = Math.min(BOT_HEADROOM_MAX_MS, Math.max(BOT_HEADROOM_MIN_MS, remaining * BOT_HEADROOM_FRACTION));
  return Math.max(0, remaining - headroom);
}

// Wired up once at server startup with the live `io` instance and room
// lookup, so this module doesn't need to import the socket layer directly
// (avoids a circular dependency between rooms/socket.ts and games/*).
export function initScheduler(deps: { broadcast: Broadcast; getContext: GetContext }): void {
  broadcast = deps.broadcast;
  getContext = deps.getContext;
}

export function clearSchedule(code: string): void {
  const timer = timers.get(code);
  if (timer) {
    clearTimeout(timer);
    timers.delete(code);
  }
  const botTimer = botTimers.get(code);
  if (botTimer) {
    clearTimeout(botTimer);
    botTimers.delete(code);
  }
}

export function scheduleIfNeeded(code: string, nextTickAt: number | undefined): void {
  clearSchedule(code);
  if (!nextTickAt) return;
  const delay = Math.max(0, nextTickAt - Date.now());
  timers.set(
    code,
    setTimeout(() => {
      runTick(code).catch((err) => console.error(`game scheduler tick failed for room ${code}`, err));
    }, delay)
  );
  // Every caller that moves a room on already comes through here, so hanging
  // the bots' turn off the same call is what keeps a bot-filled room playing
  // without a second bookkeeping path to forget about. Rooms with no bots
  // pay one no-op timer for it.
  botTimers.set(
    code,
    setTimeout(() => {
      runBotCommit(code).catch((err) => console.error(`bot turn failed for room ${code}`, err));
    }, botCommitDelay(nextTickAt))
  );
}

// The bots' phase-ending turn. Deliberately a separate pass from the chatter
// the socket layer settles inline: this one is allowed to close the night or
// the vote, so it waits until the phase is nearly over.
async function runBotCommit(code: string): Promise<void> {
  botTimers.delete(code);
  await withRoomLock(code, async () => {
    const state = await loadGameState(code);
    if (!state || state.phase === 'finished') return;

    const ctx = await getContext(code);
    if (!ctx || roomBotIds(ctx).length === 0) return;

    const engine = getGameEngine(state.gameType);
    const result = settleBots(engine, ctx, { phase: state.phase, data: state.data }, 'commit');
    // Nothing to say: leave the phase's own tick timer, set by the call that
    // scheduled this pass, exactly where it is.
    if (result.phase === state.phase && result.data === state.data) return;

    const next: GameStatePayload = { ...state, phase: result.phase, data: result.data };
    await saveGameState(next);
    if (state.phase !== 'finished' && next.phase === 'finished') {
      await persistGameHistory(code, state.gameType, ctx, next.data);
    }
    await broadcast(code, next);
    scheduleIfNeeded(code, result.nextTickAt);
  });
}

// Re-examines a room after someone's connection has dropped, for engines
// whose phases end when everyone present has acted (see
// GameEngine.onPresenceChange). Called from the socket layer once the
// disconnect has settled, so a page refresh does not count as leaving.
//
// Saves and broadcasts only when the engine actually moved the room on, so
// the common case -- a disconnect that changes nothing, because the phase
// was still waiting on somebody else anyway -- costs one lock and nothing
// else.
export async function notifyPresenceChange(code: string): Promise<void> {
  await withRoomLock(code, async () => {
    const state = await loadGameState(code);
    if (!state || state.phase === 'finished') return;

    const engine = getGameEngine(state.gameType);
    if (!engine.onPresenceChange) return;

    const ctx = await getContext(code);
    if (!ctx) return;

    const result = engine.onPresenceChange(ctx, state.phase, state.data);
    if (result.phase === state.phase && result.data === state.data) return;

    const next: GameStatePayload = { ...state, phase: result.phase, data: result.data };
    await saveGameState(next);
    if (state.phase !== 'finished' && next.phase === 'finished') {
      await persistGameHistory(code, state.gameType, ctx, next.data);
    }
    await broadcast(code, next);
    scheduleIfNeeded(code, result.nextTickAt);
  });
}

async function runTick(code: string): Promise<void> {
  timers.delete(code);
  await withRoomLock(code, async () => {
    const state = await loadGameState(code);
    if (!state) return;

    const engine = getGameEngine(state.gameType);
    if (!engine.tick) return;

    const ctx = await getContext(code);
    if (!ctx) return;

    const result = settleBots(engine, ctx, engine.tick(ctx, state.phase, state.data), 'chatter');
    const next: GameStatePayload = { ...state, phase: result.phase, data: result.data };
    await saveGameState(next);
    if (state.phase !== 'finished' && next.phase === 'finished') {
      await persistGameHistory(code, state.gameType, ctx, next.data);
    }
    await broadcast(code, next);
    scheduleIfNeeded(code, result.nextTickAt);
  });
}

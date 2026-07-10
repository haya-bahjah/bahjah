import type { GameStatePayload } from '@bahjah/shared';
import { getGameEngine, type GameEngineContext } from './engine';
import { loadGameState, saveGameState } from './state';

type Broadcast = (code: string, state: GameStatePayload) => void | Promise<void>;
type GetContext = (code: string) => Promise<GameEngineContext | null>;

let broadcast: Broadcast = () => {};
let getContext: GetContext = async () => null;
const timers = new Map<string, NodeJS.Timeout>();

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
}

async function runTick(code: string): Promise<void> {
  timers.delete(code);
  const state = await loadGameState(code);
  if (!state) return;

  const engine = getGameEngine(state.gameType);
  if (!engine.tick) return;

  const ctx = await getContext(code);
  if (!ctx) return;

  const result = engine.tick(ctx, state.phase, state.data);
  const next: GameStatePayload = { ...state, phase: result.phase, data: result.data };
  await saveGameState(next);
  await broadcast(code, next);
  scheduleIfNeeded(code, result.nextTickAt);
}

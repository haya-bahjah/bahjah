import type { GameType, RoomMemberSummary } from '@bahjah/shared';

export interface GameEngineContext {
  code: string;
  members: RoomMemberSummary[];
  // Whatever createInitialState needs beyond code/members that can't be
  // computed synchronously (e.g. trivia's host-picked categories/difficulty,
  // loaded from Redis+Postgres). Populated once, right before
  // createInitialState is called -- see GameEngine.loadConfig.
  config?: unknown;
}

export interface GameEngineResult<TData> {
  phase: string;
  data: TData;
  // Epoch ms. If set, the scheduler (games/scheduler.ts) calls tick() at
  // this time — e.g. a question's answer window closing on its own. Every
  // result that should keep the clock running must set this; omitting it
  // stops the timer (used for terminal phases like 'finished').
  nextTickAt?: number;
}

// Each game (trivia/mafia/knows-you-best) implements this on top of the
// generic lobby -> in-progress -> ended room lifecycle. `phase` and `data`
// are opaque to the framework: the engine owns their shape entirely.
export interface GameEngine<TData = unknown, TAction = unknown> {
  gameType: GameType;
  // Optional: called (and awaited) right before createInitialState, with
  // its return value attached to ctx.config. Lets an engine pull in
  // config that was set up asynchronously during the lobby (host-picked
  // categories, etc.) without createInitialState itself needing to be
  // async like the rest of this synchronous framework.
  loadConfig?(code: string): Promise<unknown>;
  createInitialState(ctx: GameEngineContext): GameEngineResult<TData>;
  // Optional: called when a room ends, so an engine can drop any config it
  // squirreled away outside the generic game-state store (e.g. trivia's
  // host-picked categories/custom questions).
  cleanup?(code: string): Promise<void>;
  applyAction(
    ctx: GameEngineContext,
    phase: string,
    data: TData,
    userId: string,
    action: TAction
  ): GameEngineResult<TData>;
  // Optional: called by the scheduler when a previously-returned
  // nextTickAt elapses, e.g. to close an answer window on a timeout.
  tick?(ctx: GameEngineContext, phase: string, data: TData): GameEngineResult<TData>;
  // Optional: redacts the full authoritative `data` down to what one
  // specific player is allowed to see (their own secret role, a private
  // team channel, etc.). If omitted, the raw `data` is broadcast
  // identically to everyone in the room — fine for games with no hidden
  // information (trivia's public-till-reveal answers), not fine for a
  // game like mafia where different players must see different things.
  toClientView?(ctx: GameEngineContext, phase: string, data: TData, viewerUserId: string): unknown;
}

export class GameActionError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const registry = new Map<GameType, GameEngine>();

export function registerGameEngine(engine: GameEngine): void {
  registry.set(engine.gameType, engine);
}

export function getGameEngine(gameType: GameType): GameEngine {
  const engine = registry.get(gameType);
  if (!engine) {
    throw new Error(`No game engine registered for "${gameType}".`);
  }
  return engine;
}

import type { GameType, RoomMemberSummary } from '@bahjah/shared';

export interface GameEngineContext {
  code: string;
  members: RoomMemberSummary[];
}

export interface GameEngineResult<TData> {
  phase: string;
  data: TData;
}

// Each game (trivia/mafia/knows-you-best) implements this on top of the
// generic lobby -> in-progress -> ended room lifecycle. `phase` and `data`
// are opaque to the framework: the engine owns their shape entirely.
export interface GameEngine<TData = unknown, TAction = unknown> {
  gameType: GameType;
  createInitialState(ctx: GameEngineContext): GameEngineResult<TData>;
  applyAction(
    ctx: GameEngineContext,
    phase: string,
    data: TData,
    userId: string,
    action: TAction
  ): GameEngineResult<TData>;
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

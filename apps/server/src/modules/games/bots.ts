import type { GameEngine, GameEngineContext, GameEngineResult } from './engine';
import { GameActionError } from './engine';

// How far a bot gets to think.
//
// 'chatter' is everything a bot can do that never ends a phase -- pressing
// "I'm ready", talking. Safe to run the instant the state changes, because
// no amount of it can cut a phase short for the people in the room.
//
// 'commit' adds the actions that *do* resolve a phase: the kill, the
// protect, the investigation, the vote. Those are deliberately held back
// until near the end of the phase timer (see scheduler.ts), so a night full
// of bots still lasts long enough for the humans to use it.
export type BotStage = 'chatter' | 'commit';

// A bot that keeps proposing an action the engine keeps rejecting would spin
// this loop, so it is bounded. High enough that a full table of bots getting
// through a whole phase never reaches it.
const MAX_BOT_STEPS = 200;

export function roomBotIds(ctx: GameEngineContext): string[] {
  return ctx.members.filter((m) => m.isBot && !m.isHost).map((m) => m.userId);
}

// Plays every bot's turn, in place, on a result the caller is about to save.
// Pure: no I/O, no timers, no broadcasting -- it takes the state the engine
// just produced and hands back the state after the bots have had their go.
//
// Loops rather than doing one round, because a bot's action can move the game
// to a phase the *other* bots then owe an action in (the last night vote
// landing on dawn, a vote resolving into a revote).
export function settleBots<TData>(
  engine: GameEngine<TData, any>,
  ctx: GameEngineContext,
  result: GameEngineResult<TData>,
  stage: BotStage
): GameEngineResult<TData> {
  if (!engine.botAction) return result;
  const bots = roomBotIds(ctx);
  if (bots.length === 0) return result;

  let current = result;
  for (let step = 0; step < MAX_BOT_STEPS; step++) {
    let acted = false;
    for (const botId of bots) {
      const action = engine.botAction(ctx, current.phase, current.data, botId, stage);
      if (action == null) continue;
      try {
        current = engine.applyAction(ctx, current.phase, current.data, botId, action);
        acted = true;
      } catch (err) {
        // A rejected bot action is a bug in botAction, not in the room: the
        // engine's own rules just turned it down. Skip that bot rather than
        // taking the whole room's turn down with it, and say so in the log
        // so it gets fixed.
        if (err instanceof GameActionError) {
          console.warn(`bot action rejected in room ${ctx.code}:`, err.code, err.message);
          continue;
        }
        throw err;
      }
    }
    if (!acted) break;
  }
  return current;
}

import type { GameType } from '@bahjah/shared';
import { GameActionError, registerGameEngine } from './engine';

interface PlaceholderData {
  message: string;
}

// Registered for game types whose real engine hasn't landed yet (mafia and
// knows-you-best, until Phases 5-6). Lets a host start/end a room and
// proves the full state-machine and WS plumbing end to end, without
// pretending to play an actual round.
export function registerPlaceholder(gameType: GameType): void {
  registerGameEngine({
    gameType,
    createInitialState: () => ({
      phase: 'waiting-on-engine',
      data: {
        message: `The ${gameType} engine hasn't been built yet — this room is live and connected, ready for it.`,
      } satisfies PlaceholderData,
    }),
    applyAction: () => {
      throw new GameActionError('NOT_IMPLEMENTED', `The ${gameType} game engine isn't implemented yet.`);
    },
  });
}

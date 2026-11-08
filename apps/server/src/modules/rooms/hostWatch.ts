import type { RoomSummary } from '@bahjah/shared';

// Watches for a room losing the screen it is being played on.
//
// In every game but one the host is not a player: the questions, the reveal
// and the scoreboard are on their display, and "End room" is their button.
// Nothing watched for that screen simply going away -- a closed tab, a laptop
// lid, a host who wandered off -- so the room carried on without it. In
// Trivia that is the most visible, because the between-rounds controls belong
// to a player rather than the host, so the game genuinely keeps running:
// phases keep ticking, players keep answering, and nobody is reading any of
// it. The room only stopped when the sweeper deleted it ten minutes later.
//
// Kept apart from socket.ts, and given its decision as a pure function, so
// the rules can be tested without a database, a socket or a ninety-second
// wait -- the cases that matter here are all about who counts as the screen,
// and they are easy to get subtly wrong.

// The host whose absence should end this room, or null if it should not.
//
// Null, deliberately, when:
//  - the host is one of the players (hostPlays). Then they are not the
//    room's screen, their leaving is an ordinary departure, and the game is
//    still perfectly playable without them.
//  - the room is not running. A lobby with no host is the sweeper's problem,
//    and a room that has already ended cannot end again.
//  - the host is connected, which includes a host who just came back.
export function hostMissingFrom(summary: RoomSummary): string | null {
  if (summary.hostPlays) return null;
  if (summary.status !== 'in-progress') return null;
  const host = summary.members.find((m) => m.isHost);
  if (!host || host.connected) return null;
  return host.userId;
}

export interface HostWatch {
  // Call with any freshly computed summary -- on a disconnect settling and on
  // every join. Arms the countdown when the screen is missing, and calls it
  // off the moment the screen is back.
  review(summary: RoomSummary): void;
  cancel(code: string): void;
  // Test seam: which rooms are currently counting down.
  pending(): string[];
}

export function createHostWatch(options: {
  graceMs: number;
  // Runs when the host has been gone for the whole grace period. It is given
  // the chance to check again itself, because ninety seconds is long enough
  // for anything to have changed.
  onAbsent: (code: string, hostUserId: string) => Promise<void>;
}): HostWatch {
  const timers = new Map<string, NodeJS.Timeout>();

  function cancel(code: string): void {
    const pending = timers.get(code);
    if (pending) {
      clearTimeout(pending);
      timers.delete(code);
    }
  }

  return {
    cancel,
    pending: () => [...timers.keys()],
    review(summary) {
      const hostUserId = hostMissingFrom(summary);
      if (!hostUserId) {
        cancel(summary.code);
        return;
      }
      // Already counting down: leave the original deadline alone rather than
      // pushing it back every time another player's presence changes, which
      // would let a busy room postpone the ending indefinitely.
      if (timers.has(summary.code)) return;

      timers.set(
        summary.code,
        setTimeout(() => {
          timers.delete(summary.code);
          void options.onAbsent(summary.code, hostUserId);
        }, options.graceMs)
      );
    },
  };
}

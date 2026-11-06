import type { GameStatePayload } from '@bahjah/shared';
import type { Server, Socket } from 'socket.io';
import { updateAvatar, updateGuestDisplayName } from '../auth/service';
import { isTokenExpiredError, signGuestToken, verifyAuthTokenWithExpiry } from '../auth/jwt';
import { prisma } from '../../db/prisma';
import { avatarSchema } from '../auth/validation';
import { guestNameSchema } from './validation';
import { settleBots } from '../games/bots';
import { defaultMafiaConfig, getMafiaRoomConfig, saveMafiaRoomConfig } from '../games/mafia/config';
import { GameActionError, getGameEngine, type GameEngineContext } from '../games/engine';
import { persistGameHistory } from '../games/history';
import { withRoomLock } from '../games/roomLock';
import { clearSchedule, initScheduler, notifyPresenceChange, scheduleIfNeeded } from '../games/scheduler';
import { clearGameState, loadGameState, saveGameState } from '../games/state';
import { fromPrismaGameType } from './mappers';
import { getConnectedUserIds, markConnected, markDisconnected } from './presence';
import {
  endRoom,
  getRoomSummary,
  isRoomMember,
  playableRoomMembers,
  removeRoomPlayer,
  restartRoom,
  RoomError,
  setReady,
  startRoom,
} from './service';
import { createHostWatch, hostMissingFrom } from './hostWatch';
import { clearRateLimit, isRateLimited } from './wsRateLimit';

interface SocketData {
  userId: string;
  // When the token this socket handshook with runs out, epoch ms, or null
  // for one without an expiry. Read by renewGuestTokenIfExpiringSoon.
  tokenExpiresAt: number | null;
}

// A guest's token lives six hours so that a QR-code join does not leave
// somebody signed in on a borrowed phone indefinitely. That limit is about
// an IDLE session, but it was being applied to a live one: when a guest's
// token ran out mid-game, the middleware below refused their next handshake
// -- and since socket.io never retries a refused handshake, their phone sat
// on whatever it had last drawn while the rest of the room played on, with
// nothing on screen to say why.
//
// So a guest who is demonstrably still here is handed a fresh token. The
// six-hour rule is unchanged in substance -- the clock only ever restarts
// while they are actually connected, so an abandoned session still lapses
// on time -- but expiring in the middle of a game is now impossible.
const GUEST_TOKEN_RENEW_WITHIN_MS = 2 * 60 * 60 * 1000;

async function renewGuestTokenIfExpiringSoon(socket: Socket, userId: string): Promise<void> {
  const { tokenExpiresAt } = socket.data as SocketData;
  if (tokenExpiresAt === null) return;
  // A real account's token has thirty days on it, so it never gets this far
  // and never costs a lookup; only a guest's six-hour one does.
  if (tokenExpiresAt - Date.now() > GUEST_TOKEN_RENEW_WITHIN_MS) return;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isGuest: true } });
    if (!user?.isGuest) return;
    socket.emit('session:token', { token: signGuestToken(userId) });
  } catch {
    // Best-effort. A failed renewal leaves the player exactly as well off as
    // before this existed, so it must never break the connection itself.
  }
}

// A disconnect can be a real departure or just a page refresh / brief
// network blip. Rather than delay the underlying presence count (which
// risks a leak with multiple tabs — see presence.ts's reference counting),
// the count updates immediately and correctly; only the room:update telling
// everyone else about it is debounced per room code, so a quick reconnect
// self-corrects before anyone sees a flicker.
const DISCONNECT_BROADCAST_DELAY_MS = 3000;
const disconnectBroadcastTimers = new Map<string, NodeJS.Timeout>();

// Telling the room somebody's dot went grey is cosmetic, and three seconds
// is the right wait for it. Acting on their absence is not: five of six
// players having answered means the phase CLOSES the moment the sixth stops
// counting (see each engine's onPresenceChange), and at three seconds that
// was happening to players who had done nothing but walk out of wifi range
// or get a phone call -- their answer thrown away, the round moved on
// without them, which is the other half of the "kicked out for no reason"
// reports.
//
// Fifteen seconds covers socket.io's reconnection backoff and a cellular
// hand-off with room to spare. The cost when somebody really has left is
// bounded and small: the phase has its own timer, which closes it regardless
// -- this only decides how quickly an EARLY close may happen.
const PRESENCE_SETTLE_DELAY_MS = 15000;
const presenceSettleTimers = new Map<string, NodeJS.Timeout>();

// In every game but one the host is the room's screen, not a player: the
// questions, the reveal and the scoreboard are all on their display, and
// "End room" is their button. Nothing watched for that screen simply going
// away -- a closed tab, a laptop lid, a host who wandered off -- so the room
// carried on without it. In Trivia that is most visible, because the
// between-rounds controls belong to a player (PLAYER_CONTROLLED_GAMES), so
// the game genuinely keeps running: phases keep ticking, players keep
// answering, and nobody is reading any of it. The room only stopped when the
// sweeper deleted it ten minutes later.
//
// So a room whose screen has gone waits a while and then ends itself,
// exactly as if the host had pressed End room -- which is a path every game's
// pages already handle.
//
// Ninety seconds, and the length is the whole point. A host's laptop
// sleeping, a reload, or a wifi hiccup must never end a party, and all of
// those are back inside a few seconds; this is deliberately far longer than
// the presence settle above, which only decides when a phase may close early.
// Erring long costs players a minute of a game that was already over; erring
// short would end games that were not.
const HOST_ABSENCE_GRACE_MS = 90_000;

function emitError(socket: Socket, err: unknown): void {
  if (err instanceof RoomError || err instanceof GameActionError) {
    socket.emit('room:error', { code: err.code, message: err.message });
    return;
  }
  socket.emit('room:error', { code: 'INTERNAL_ERROR', message: 'Something went wrong.' });
}

export function registerRoomSocketHandlers(io: Server): void {
  // Broadcasts game:state to everyone in a room. If the engine defines
  // toClientView, each connected socket gets its own redacted view (secret
  // roles, a private team channel, etc.) instead of one identical payload.
  function broadcastGameState(code: string, payload: GameStatePayload, ctx: GameEngineContext): void {
    const engine = getGameEngine(payload.gameType);
    if (!engine.toClientView) {
      io.to(code).emit('game:state', payload);
      return;
    }
    const room = io.sockets.adapter.rooms.get(code);
    if (!room) return;
    for (const socketId of room) {
      const socket = io.sockets.sockets.get(socketId);
      if (!socket) continue;
      const viewerUserId = (socket.data as SocketData).userId;
      const viewData = engine.toClientView(ctx, payload.phase, payload.data, viewerUserId);
      socket.emit('game:state', { ...payload, data: viewData });
    }
  }

  async function contextFor(code: string): Promise<GameEngineContext> {
    const summary = await getRoomSummary(code, await getConnectedUserIds(code));
    return { code, members: summary.members, displayMode: summary.displayMode, controllerId: summary.controllerId };
  }

  // Called the moment anybody (re)joins a room: whoever just arrived may be
  // the very player a pending timer was about to write off, so both the
  // cosmetic broadcast and the phase-affecting settle are called off and
  // recomputed from the presence that actually exists now.
  function cancelPendingDisconnectBroadcast(code: string): void {
    const pending = disconnectBroadcastTimers.get(code);
    if (pending) {
      clearTimeout(pending);
      disconnectBroadcastTimers.delete(code);
    }
    const settling = presenceSettleTimers.get(code);
    if (settling) {
      clearTimeout(settling);
      presenceSettleTimers.delete(code);
    }
  }

  const hostWatch = createHostWatch({
    graceMs: HOST_ABSENCE_GRACE_MS,
    onAbsent: async (code) => {
      try {
        // Re-read rather than trust the ninety-second-old summary: the host
        // may be back, or the room may have ended on its own meanwhile, and
        // ending a room twice would be its own bug.
        const now = await getRoomSummary(code, await getConnectedUserIds(code));
        const hostUserId = hostMissingFrom(now);
        if (!hostUserId) return;

        // A game that has already played itself out is left alone. Nothing
        // marks a room 'ended' when its last round finishes -- that only
        // happens when the host presses End room or Play again -- so a room
        // sitting on its final scoreboard still reads as in-progress. The
        // host closing their tab at that point is the most ordinary thing in
        // the world, and ending the room would snatch the results away from
        // players who are still reading them. The sweeper collects it later.
        const state = await loadGameState(code);
        if (state && state.phase === 'finished') return;

        // Ended the way the host's own End room button ends it, so players
        // land on the ending their game already draws rather than on a
        // screen that has quietly stopped meaning anything. endRoom checks
        // the caller is the host, which is exactly the claim being made
        // here: it is the host's leaving that ends the room.
        const room = await endRoom(hostUserId, code);
        clearSchedule(code);
        await clearGameState(code);
        const engine = getGameEngine(fromPrismaGameType(room.gameType));
        await engine.cleanup?.(code);
        const summary = await getRoomSummary(code, await getConnectedUserIds(code));
        io.to(code).emit('room:update', summary);
      } catch {
        // Room gone, or already ended by the host coming back and pressing
        // the button themselves. Either way there is nothing left to end.
      }
    },
  });

  initScheduler({
    broadcast: async (code, state) => {
      try {
        broadcastGameState(code, state, await contextFor(code));
      } catch {
        // Room may no longer exist; nothing to broadcast.
      }
    },
    getContext: async (code) => {
      try {
        return await contextFor(code);
      } catch {
        return null;
      }
    },
  });

  // socket.io does not retry a handshake its own middleware refused: the
  // client gets one connect_error and the manager goes idle for good. So a
  // refusal here is permanent, and the client has to be told WHY to have any
  // chance of recovering -- a token that merely ran out is worth replacing
  // and retrying, a forged or malformed one never will be. The reason rides
  // on err.data.code, which socket.io passes through to the client.
  function refuse(next: (err: Error) => void, code: 'UNAUTHENTICATED' | 'TOKEN_EXPIRED'): void {
    const err = new Error(code) as Error & { data?: { code: string } };
    err.data = { code };
    next(err);
  }

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || !token) {
      refuse(next, 'UNAUTHENTICATED');
      return;
    }
    try {
      const verified = verifyAuthTokenWithExpiry(token);
      const data = socket.data as SocketData;
      data.userId = verified.sub;
      data.tokenExpiresAt = verified.expiresAt;
      next();
    } catch (err) {
      refuse(next, isTokenExpiredError(err) ? 'TOKEN_EXPIRED' : 'UNAUTHENTICATED');
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket.data as SocketData).userId;
    let joinedCode: string | null = null;

    void renewGuestTokenIfExpiringSoon(socket, userId);

    function withRateLimit(handler: (...args: any[]) => Promise<void>) {
      return async (...args: any[]) => {
        if (isRateLimited(socket.id)) {
          socket.emit('room:error', { code: 'RATE_LIMITED', message: 'Slow down — too many actions too quickly.' });
          return;
        }
        await handler(...args);
      };
    }

    socket.on(
      'room:join',
      withRateLimit(async (payload: { code?: string }) => {
        const code = String(payload?.code ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (!code) {
          socket.emit('room:error', { code: 'INVALID_CODE', message: 'A room code is required.' });
          return;
        }
        try {
          const member = await isRoomMember(code, userId);
          if (!member) {
            socket.emit('room:error', { code: 'NOT_A_MEMBER', message: 'Join this room over the API first.' });
            return;
          }
          joinedCode = code;
          socket.join(code);
          await markConnected(code, userId);
          cancelPendingDisconnectBroadcast(code);
          const summary = await getRoomSummary(code, await getConnectedUserIds(code));
          io.to(code).emit('room:update', summary);
          // The host coming back calls off the countdown started when their
          // screen went away -- a reload must cost the room nothing.
          hostWatch.review(summary);

          // Positive confirmation that this socket is in the room's broadcast
          // set. Everything above can fail transiently -- isRoomMember is a
          // database query, and on a cold or busy database it can throw --
          // and when it did, the socket stayed connected while belonging to
          // no room at all: every room:update and game:state went past it,
          // the page showed no error, and the phone sat on the screen it had
          // when the drop happened. The client re-sends room:join until it
          // sees this, so a join that fails is retried instead of becoming a
          // permanent silent freeze.
          socket.emit('room:joined', { code });

          // Catch a client up on an already-started game (reconnect, or a
          // member who joined after the host started it) with their own view.
          const state = await loadGameState(code);
          if (state) {
            const engine = getGameEngine(state.gameType);
            const viewData = engine.toClientView
              ? engine.toClientView(
                  { code, members: summary.members, displayMode: summary.displayMode, controllerId: summary.controllerId },
                  state.phase,
                  state.data,
                  userId
                )
              : state.data;
            socket.emit('game:state', { ...state, data: viewData });
          }
        } catch (err) {
          emitError(socket, err);
        }
      })
    );

    socket.on(
      'room:start',
      withRateLimit(async () => {
        if (!joinedCode) {
          socket.emit('room:error', { code: 'NOT_IN_ROOM', message: 'Join a room first.' });
          return;
        }
        try {
          await startRoom(userId, joinedCode);
          const summary = await getRoomSummary(joinedCode, await getConnectedUserIds(joinedCode));
          const engine = getGameEngine(summary.gameType);
          const config = engine.loadConfig ? await engine.loadConfig(joinedCode) : undefined;
          const ctx: GameEngineContext = {
            code: joinedCode,
            members: summary.members,
            displayMode: summary.displayMode,
            controllerId: summary.controllerId,
            config,
          };
          // Bots get their turn on the same state everyone else is about to
          // be shown, so the room never renders a moment where they're
          // visibly lagging behind the people at the table.
          const initial = settleBots(engine, ctx, engine.createInitialState(ctx), 'chatter');
          const statePayload: GameStatePayload = {
            code: joinedCode,
            gameType: summary.gameType,
            phase: initial.phase,
            startedAt: Date.now(),
            data: initial.data,
          };
          await saveGameState(statePayload);
          scheduleIfNeeded(joinedCode, initial.nextTickAt);
          io.to(joinedCode).emit('room:update', summary);
          broadcastGameState(joinedCode, statePayload, ctx);
        } catch (err) {
          emitError(socket, err);
        }
      })
    );

    socket.on(
      'room:ready',
      withRateLimit(async (payload: { isReady?: boolean }) => {
        if (!joinedCode) {
          socket.emit('room:error', { code: 'NOT_IN_ROOM', message: 'Join a room first.' });
          return;
        }
        try {
          await setReady(userId, joinedCode, Boolean(payload?.isReady));
          const summary = await getRoomSummary(joinedCode, await getConnectedUserIds(joinedCode));
          io.to(joinedCode).emit('room:update', summary);
        } catch (err) {
          emitError(socket, err);
        }
      })
    );

    socket.on(
      'user:avatar',
      withRateLimit(async (payload: { avatar?: string | null }) => {
        const parsed = avatarSchema.safeParse({ avatar: payload?.avatar ?? null });
        if (!parsed.success) {
          socket.emit('room:error', { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid avatar.' });
          return;
        }
        try {
          await updateAvatar(userId, parsed.data.avatar);
          if (joinedCode) {
            const summary = await getRoomSummary(joinedCode, await getConnectedUserIds(joinedCode));
            io.to(joinedCode).emit('room:update', summary);
          }
        } catch (err) {
          emitError(socket, err);
        }
      })
    );

    socket.on(
      'user:name',
      withRateLimit(async (payload: { name?: string }) => {
        const parsed = guestNameSchema.safeParse({ name: payload?.name ?? '' });
        if (!parsed.success) {
          socket.emit('room:error', { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid name.' });
          return;
        }
        try {
          await updateGuestDisplayName(userId, parsed.data.name);
          if (joinedCode) {
            const summary = await getRoomSummary(joinedCode, await getConnectedUserIds(joinedCode));
            io.to(joinedCode).emit('room:update', summary);
          }
        } catch (err) {
          emitError(socket, err);
        }
      })
    );

    socket.on(
      'room:end',
      withRateLimit(async () => {
        if (!joinedCode) {
          socket.emit('room:error', { code: 'NOT_IN_ROOM', message: 'Join a room first.' });
          return;
        }
        try {
          const room = await endRoom(userId, joinedCode);
          clearSchedule(joinedCode);
          await clearGameState(joinedCode);
          const engine = getGameEngine(fromPrismaGameType(room.gameType));
          await engine.cleanup?.(joinedCode);
          const summary = await getRoomSummary(joinedCode, await getConnectedUserIds(joinedCode));
          io.to(joinedCode).emit('room:update', summary);
        } catch (err) {
          emitError(socket, err);
        }
      })
    );

    socket.on(
      'room:restart',
      withRateLimit(async () => {
        if (!joinedCode) {
          socket.emit('room:error', { code: 'NOT_IN_ROOM', message: 'Join a room first.' });
          return;
        }
        try {
          await restartRoom(userId, joinedCode);
          clearSchedule(joinedCode);
          await clearGameState(joinedCode);
          // No engine.cleanup() here on purpose -- that would wipe trivia's
          // saved category/difficulty/custom-question config, which a
          // replay should keep. Only the ephemeral game state clears.
          const summary = await getRoomSummary(joinedCode, await getConnectedUserIds(joinedCode));
          io.to(joinedCode).emit('room:update', summary);
        } catch (err) {
          emitError(socket, err);
        }
      })
    );

    // The host taking a player out of the room (Saudi Home only; see
    // removeRoomPlayer). Their phones are told and dropped from the room's
    // broadcasts; a running game keeps going without them.
    socket.on(
      'room:remove-player',
      withRateLimit(async (payload: { userId?: string }) => {
        if (!joinedCode) {
          socket.emit('room:error', { code: 'NOT_IN_ROOM', message: 'Join a room first.' });
          return;
        }
        const code = joinedCode;
        const targetUserId = String(payload?.userId ?? '');
        try {
          await removeRoomPlayer(userId, code, targetUserId);
          const room = io.sockets.adapter.rooms.get(code);
          for (const socketId of room ? [...room] : []) {
            const target = io.sockets.sockets.get(socketId);
            if (target && (target.data as SocketData).userId === targetUserId) {
              target.emit('room:removed', { code });
              target.leave(code);
            }
          }
          const summary = await getRoomSummary(code, await getConnectedUserIds(code));
          io.to(code).emit('room:update', summary);
          const state = await loadGameState(code);
          if (state) {
            broadcastGameState(code, state, {
              code,
              members: summary.members,
              displayMode: summary.displayMode,
              controllerId: summary.controllerId,
            });
            await notifyPresenceChange(code);
          }
        } catch (err) {
          emitError(socket, err);
        }
      })
    );

    socket.on(
      'game:action',
      withRateLimit(async (payload: { action?: unknown }) => {
        if (!joinedCode) {
          socket.emit('room:error', { code: 'NOT_IN_ROOM', message: 'Join a room first.' });
          return;
        }
        const code = joinedCode;
        try {
          await withRoomLock(code, async () => {
            const member = await isRoomMember(code, userId);
            if (!member) {
              socket.emit('room:error', { code: 'NOT_A_MEMBER', message: 'Join this room over the API first.' });
              return;
            }
            const state = await loadGameState(code);
            if (!state) {
              socket.emit('room:error', { code: 'GAME_NOT_STARTED', message: 'This game has not started yet.' });
              return;
            }
            const summary = await getRoomSummary(code, await getConnectedUserIds(code));
            const ctx: GameEngineContext = {
              code,
              members: summary.members,
              displayMode: summary.displayMode,
              controllerId: summary.controllerId,
            };
            const engine = getGameEngine(state.gameType);
            const next = settleBots(
              engine,
              ctx,
              engine.applyAction(ctx, state.phase, state.data, userId, payload?.action),
              'chatter'
            );
            const nextPayload: GameStatePayload = { ...state, phase: next.phase, data: next.data };
            await saveGameState(nextPayload);
            if (state.phase !== 'finished' && next.phase === 'finished') {
              await persistGameHistory(code, state.gameType, ctx, next.data);
            }
            scheduleIfNeeded(code, next.nextTickAt);
            broadcastGameState(code, nextPayload, ctx);
          });
        } catch (err) {
          emitError(socket, err);
        }
      })
    );

    socket.on('disconnect', async () => {
      clearRateLimit(socket.id);
      if (!joinedCode) return;
      const code = joinedCode;
      await markDisconnected(code, userId);

      cancelPendingDisconnectBroadcast(code);
      disconnectBroadcastTimers.set(
        code,
        setTimeout(async () => {
          disconnectBroadcastTimers.delete(code);
          try {
            const summary = await getRoomSummary(code, await getConnectedUserIds(code));
            io.to(code).emit('room:update', summary);
            // Whoever just dropped may have been the room's screen.
            hostWatch.review(summary);
          } catch {
            // Room may no longer exist; nothing to broadcast.
          }
        }, DISCONNECT_BROADCAST_DELAY_MS)
      );

      // A game whose phase ends when everyone present has acted has to be
      // told the room got smaller -- otherwise the last player to close
      // their phone leaves the rest waiting on them. On its own, much longer
      // timer than the cosmetic broadcast above, because this one can end a
      // phase and take somebody's answer with it: see PRESENCE_SETTLE_DELAY_MS.
      presenceSettleTimers.set(
        code,
        setTimeout(async () => {
          presenceSettleTimers.delete(code);
          try {
            await notifyPresenceChange(code);
          } catch {
            // Room may no longer exist; nothing to settle.
          }
        }, PRESENCE_SETTLE_DELAY_MS)
      );
    });
  });
}

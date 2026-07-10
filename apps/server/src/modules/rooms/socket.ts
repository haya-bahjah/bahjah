import type { GameStatePayload } from '@bahjah/shared';
import type { Server, Socket } from 'socket.io';
import { verifyAuthToken } from '../auth/jwt';
import { GameActionError, getGameEngine, type GameEngineContext } from '../games/engine';
import { clearSchedule, initScheduler, scheduleIfNeeded } from '../games/scheduler';
import { clearGameState, loadGameState, saveGameState } from '../games/state';
import { getConnectedUserIds, markConnected, markDisconnected } from './presence';
import { endRoom, getRoomSummary, isRoomMember, RoomError, startRoom } from './service';
import { clearRateLimit, isRateLimited } from './wsRateLimit';

interface SocketData {
  userId: string;
}

// A disconnect can be a real departure or just a page refresh / brief
// network blip. Rather than delay the underlying presence count (which
// risks a leak with multiple tabs — see presence.ts's reference counting),
// the count updates immediately and correctly; only the room:update telling
// everyone else about it is debounced per room code, so a quick reconnect
// self-corrects before anyone sees a flicker.
const DISCONNECT_BROADCAST_DELAY_MS = 3000;
const disconnectBroadcastTimers = new Map<string, NodeJS.Timeout>();

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
    return { code, members: summary.members };
  }

  function cancelPendingDisconnectBroadcast(code: string): void {
    const pending = disconnectBroadcastTimers.get(code);
    if (pending) {
      clearTimeout(pending);
      disconnectBroadcastTimers.delete(code);
    }
  }

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

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || !token) {
      next(new Error('UNAUTHENTICATED'));
      return;
    }
    try {
      (socket.data as SocketData).userId = verifyAuthToken(token).sub;
      next();
    } catch {
      next(new Error('UNAUTHENTICATED'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket.data as SocketData).userId;
    let joinedCode: string | null = null;

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
        const code = (payload?.code ?? '').toUpperCase();
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

          // Catch a client up on an already-started game (reconnect, or a
          // member who joined after the host started it) with their own view.
          const state = await loadGameState(code);
          if (state) {
            const engine = getGameEngine(state.gameType);
            const viewData = engine.toClientView
              ? engine.toClientView({ code, members: summary.members }, state.phase, state.data, userId)
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
          const ctx: GameEngineContext = { code: joinedCode, members: summary.members };
          const engine = getGameEngine(summary.gameType);
          const initial = engine.createInitialState(ctx);
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
      'room:end',
      withRateLimit(async () => {
        if (!joinedCode) {
          socket.emit('room:error', { code: 'NOT_IN_ROOM', message: 'Join a room first.' });
          return;
        }
        try {
          await endRoom(userId, joinedCode);
          clearSchedule(joinedCode);
          await clearGameState(joinedCode);
          const summary = await getRoomSummary(joinedCode, await getConnectedUserIds(joinedCode));
          io.to(joinedCode).emit('room:update', summary);
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
        try {
          const member = await isRoomMember(joinedCode, userId);
          if (!member) {
            socket.emit('room:error', { code: 'NOT_A_MEMBER', message: 'Join this room over the API first.' });
            return;
          }
          const state = await loadGameState(joinedCode);
          if (!state) {
            socket.emit('room:error', { code: 'GAME_NOT_STARTED', message: 'This game has not started yet.' });
            return;
          }
          const summary = await getRoomSummary(joinedCode, await getConnectedUserIds(joinedCode));
          const ctx: GameEngineContext = { code: joinedCode, members: summary.members };
          const engine = getGameEngine(state.gameType);
          const next = engine.applyAction(ctx, state.phase, state.data, userId, payload?.action);
          const nextPayload: GameStatePayload = { ...state, phase: next.phase, data: next.data };
          await saveGameState(nextPayload);
          scheduleIfNeeded(joinedCode, next.nextTickAt);
          broadcastGameState(joinedCode, nextPayload, ctx);
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
          } catch {
            // Room may no longer exist; nothing to broadcast.
          }
        }, DISCONNECT_BROADCAST_DELAY_MS)
      );
    });
  });
}

import type { GameStatePayload } from '@bahjah/shared';
import type { Server, Socket } from 'socket.io';
import { verifyAuthToken } from '../auth/jwt';
import { GameActionError, getGameEngine } from '../games/engine';
import { clearGameState, loadGameState, saveGameState } from '../games/state';
import { getConnectedUserIds, markConnected, markDisconnected } from './presence';
import { endRoom, getRoomSummary, isRoomMember, RoomError, startRoom } from './service';

interface SocketData {
  userId: string;
}

function emitError(socket: Socket, err: unknown): void {
  if (err instanceof RoomError || err instanceof GameActionError) {
    socket.emit('room:error', { code: err.code, message: err.message });
    return;
  }
  socket.emit('room:error', { code: 'INTERNAL_ERROR', message: 'Something went wrong.' });
}

export function registerRoomSocketHandlers(io: Server): void {
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

    socket.on('room:join', async (payload: { code?: string }) => {
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
        const summary = await getRoomSummary(code, await getConnectedUserIds(code));
        io.to(code).emit('room:update', summary);

        // Catch a client up on an already-started game (reconnect, or a
        // member who joined after the host started it).
        const state = await loadGameState(code);
        if (state) socket.emit('game:state', state);
      } catch (err) {
        emitError(socket, err);
      }
    });

    socket.on('room:start', async () => {
      if (!joinedCode) {
        socket.emit('room:error', { code: 'NOT_IN_ROOM', message: 'Join a room first.' });
        return;
      }
      try {
        await startRoom(userId, joinedCode);
        const summary = await getRoomSummary(joinedCode, await getConnectedUserIds(joinedCode));
        const engine = getGameEngine(summary.gameType);
        const initial = engine.createInitialState({ code: joinedCode, members: summary.members });
        const statePayload: GameStatePayload = {
          code: joinedCode,
          gameType: summary.gameType,
          phase: initial.phase,
          startedAt: Date.now(),
          data: initial.data,
        };
        await saveGameState(statePayload);
        io.to(joinedCode).emit('room:update', summary);
        io.to(joinedCode).emit('game:state', statePayload);
      } catch (err) {
        emitError(socket, err);
      }
    });

    socket.on('room:end', async () => {
      if (!joinedCode) {
        socket.emit('room:error', { code: 'NOT_IN_ROOM', message: 'Join a room first.' });
        return;
      }
      try {
        await endRoom(userId, joinedCode);
        await clearGameState(joinedCode);
        const summary = await getRoomSummary(joinedCode, await getConnectedUserIds(joinedCode));
        io.to(joinedCode).emit('room:update', summary);
      } catch (err) {
        emitError(socket, err);
      }
    });

    socket.on('game:action', async (payload: { action?: unknown }) => {
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
        const engine = getGameEngine(state.gameType);
        const next = engine.applyAction(
          { code: joinedCode, members: summary.members },
          state.phase,
          state.data,
          userId,
          payload?.action
        );
        const nextPayload: GameStatePayload = { ...state, phase: next.phase, data: next.data };
        await saveGameState(nextPayload);
        io.to(joinedCode).emit('game:state', nextPayload);
      } catch (err) {
        emitError(socket, err);
      }
    });

    socket.on('disconnect', async () => {
      if (!joinedCode) return;
      await markDisconnected(joinedCode, userId);
      try {
        const summary = await getRoomSummary(joinedCode, await getConnectedUserIds(joinedCode));
        io.to(joinedCode).emit('room:update', summary);
      } catch {
        // Room may no longer exist; nothing to broadcast.
      }
    });
  });
}

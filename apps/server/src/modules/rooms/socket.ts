import type { Server, Socket } from 'socket.io';
import { verifyAuthToken } from '../auth/jwt';
import { getConnectedUserIds, markConnected, markDisconnected } from './presence';
import { getRoomSummary, isRoomMember, RoomError } from './service';

interface SocketData {
  userId: string;
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
        markConnected(code, userId);
        const summary = await getRoomSummary(code, getConnectedUserIds(code));
        io.to(code).emit('room:update', summary);
      } catch (err) {
        if (err instanceof RoomError) {
          socket.emit('room:error', { code: err.code, message: err.message });
          return;
        }
        socket.emit('room:error', { code: 'INTERNAL_ERROR', message: 'Something went wrong.' });
      }
    });

    socket.on('disconnect', async () => {
      if (!joinedCode) return;
      markDisconnected(joinedCode, userId);
      try {
        const summary = await getRoomSummary(joinedCode, getConnectedUserIds(joinedCode));
        io.to(joinedCode).emit('room:update', summary);
      } catch {
        // Room may no longer exist; nothing to broadcast.
      }
    });
  });
}

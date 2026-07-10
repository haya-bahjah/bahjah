import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { getConnectedUserIds } from './presence';
import { createRoom, getRoomSummary, isRoomMember, joinRoom, RoomError } from './service';
import { createRoomSchema } from './validation';

export const roomsRouter = Router();

roomsRouter.post('/', requireAuth, async (req, res, next) => {
  const parsed = createRoomSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' },
    });
    return;
  }
  try {
    const room = await createRoom(req.userId!, parsed.data.gameType);
    const summary = await getRoomSummary(room.code, getConnectedUserIds(room.code));
    res.status(201).json({ room: summary });
  } catch (err) {
    if (err instanceof RoomError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    next(err);
  }
});

roomsRouter.post('/:code/join', requireAuth, async (req, res, next) => {
  const code = req.params.code.toUpperCase();
  try {
    await joinRoom(req.userId!, code);
    const summary = await getRoomSummary(code, getConnectedUserIds(code));
    res.json({ room: summary });
  } catch (err) {
    if (err instanceof RoomError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    next(err);
  }
});

roomsRouter.get('/:code', requireAuth, async (req, res, next) => {
  const code = req.params.code.toUpperCase();
  try {
    const member = await isRoomMember(code, req.userId!);
    if (!member) {
      res.status(403).json({ error: { code: 'NOT_A_MEMBER', message: 'Join this room before viewing it.' } });
      return;
    }
    const summary = await getRoomSummary(code, getConnectedUserIds(code));
    res.json({ room: summary });
  } catch (err) {
    if (err instanceof RoomError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    next(err);
  }
});

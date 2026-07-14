import { Router } from 'express';
import QRCode from 'qrcode';
import { requireAuth } from '../auth/middleware';
import { createRoomRateLimit } from '../../middleware/rateLimit';
import { getConnectedUserIds } from './presence';
import { createRoom, getRoomGameType, getRoomSummary, isRoomMember, joinRoom, RoomError } from './service';
import { createRoomSchema } from './validation';

export const roomsRouter = Router();

roomsRouter.post('/', requireAuth, createRoomRateLimit, async (req, res, next) => {
  const parsed = createRoomSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' },
    });
    return;
  }
  try {
    const room = await createRoom(req.userId!, parsed.data.gameType);
    const summary = await getRoomSummary(room.code, await getConnectedUserIds(room.code));
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
    const summary = await getRoomSummary(code, await getConnectedUserIds(code));
    res.json({ room: summary });
  } catch (err) {
    if (err instanceof RoomError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    next(err);
  }
});

// Public (no auth) so it can be used directly as an <img src> -- the room
// code is already shown in plain text in the lobby, so this reveals
// nothing a member wouldn't already share when inviting people.
roomsRouter.get('/:code/qr.svg', async (req, res, next) => {
  const code = req.params.code.toUpperCase();
  try {
    const gameType = await getRoomGameType(code);
    const joinUrl = `${req.protocol}://${req.get('host')}/${gameType}-lobby.html?code=${encodeURIComponent(code)}`;
    const svg = await QRCode.toString(joinUrl, { type: 'svg', margin: 1, width: 220 });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-store');
    res.send(svg);
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
    const summary = await getRoomSummary(code, await getConnectedUserIds(code));
    res.json({ room: summary });
  } catch (err) {
    if (err instanceof RoomError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    next(err);
  }
});

import { Router } from 'express';
import { signGuestToken, verifyAuthToken } from '../auth/jwt';
import { createGuestUser, getUserById } from '../auth/service';
import { createRoomRateLimit } from '../../middleware/rateLimit';
import { getConnectedUserIds } from '../rooms/presence';
import { createRoom, getRoomSummary, RoomError } from '../rooms/service';
import { getEventByLinkKey } from './registry';

export const eventsRouter = Router();

// The landing page asks this before showing anything, so a mistyped or
// retired link says so instead of offering a button that cannot work.
eventsRouter.get('/:linkKey', (req, res) => {
  const event = getEventByLinkKey(req.params.linkKey);
  if (!event) {
    res.status(404).json({ error: { code: 'EVENT_NOT_FOUND', message: 'This event link is not active.' } });
    return;
  }
  res.json({ event: { title: event.title, lang: event.lang, gameType: event.gameType, maxPlayers: event.maxPlayers } });
});

// Opens a new room for the event. No account needed and no pass: whoever has
// the link may host, which is the whole point of handing it out. Someone
// already signed in hosts as themselves; anyone else gets a guest identity
// for the room's screen, the same short-lived kind a player gets by scanning
// the code, and the token to go with it.
//
// Auth is optional here rather than required, so it is read by hand: a stale
// or broken token just means "not signed in", never an error.
eventsRouter.post('/:linkKey/rooms', createRoomRateLimit, async (req, res, next) => {
  const event = getEventByLinkKey(req.params.linkKey);
  if (!event) {
    res.status(404).json({ error: { code: 'EVENT_NOT_FOUND', message: 'This event link is not active.' } });
    return;
  }
  try {
    let hostId: string | null = null;
    const header = req.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null;
    if (bearer) {
      try {
        const userId = verifyAuthToken(bearer).sub;
        if (userId && (await getUserById(userId))) hostId = userId;
      } catch {
        hostId = null;
      }
    }

    let guest: { token: string; user: Awaited<ReturnType<typeof createGuestUser>> } | null = null;
    if (!hostId) {
      // The host is the room's screen, not a player, so this name is only
      // ever seen in the lobby's "hosted by" line.
      const user = await createGuestUser(event.title[event.lang], null);
      hostId = user.id;
      guest = { token: signGuestToken(user.id), user };
    }

    const room = await createRoom(hostId, event.gameType, 'tv', event.id);
    const summary = await getRoomSummary(room.code, await getConnectedUserIds(room.code));
    res.status(201).json({ room: summary, ...(guest ? { token: guest.token, user: guest.user } : {}) });
  } catch (err) {
    if (err instanceof RoomError) {
      res.status(err.status).json({ error: { code: err.code, message: err.message } });
      return;
    }
    next(err);
  }
});

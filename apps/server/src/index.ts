import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env';
import { authRouter } from './modules/auth/routes';
import { registerPlaceholderEngines } from './modules/games/placeholderEngine';
import { roomsRouter } from './modules/rooms/routes';
import { registerRoomSocketHandlers } from './modules/rooms/socket';

registerPlaceholderEngines();

const app = express();
app.use(cors({ origin: env.webOrigin, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/rooms', roomsRouter);

// apps/web is a set of static, self-contained HTML pages with no build
// step, so the API server also serves them directly — one origin, no CORS
// dance in dev or prod.
const webDir = path.resolve(__dirname, '../../web');
app.use(express.static(webDir));
app.get('/', (_req, res) => res.redirect('/bahjah-landing.html'));

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } });
};
app.use(errorHandler);

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: env.webOrigin, credentials: true },
});

registerRoomSocketHandlers(io);

httpServer.listen(env.port, () => {
  console.log(`bahjah server listening on :${env.port}`);
});

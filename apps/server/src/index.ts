import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env';
import { authRouter } from './modules/auth/routes';
import { loadPromptBank } from './modules/games/knowsYouBest/promptBank';
import { registerEngines } from './modules/games/registerEngines';
import { triviaRouter } from './modules/games/trivia/routes';
import { loadQuestionBank } from './modules/games/trivia/questionBank';
import { roomsRouter } from './modules/rooms/routes';
import { registerRoomSocketHandlers } from './modules/rooms/socket';

const app = express();
// Fly's edge terminates TLS and forwards plain HTTP internally; without this,
// req.protocol always reports 'http' behind the proxy, breaking anything that
// builds an absolute URL from the request (e.g. the room QR/join links).
app.set('trust proxy', 1);
app.use(cors({ origin: env.webOrigin, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/games/trivia', triviaRouter);

// apps/web is a set of static, self-contained HTML pages with no build
// step, so the API server also serves them directly — one origin, no CORS
// dance in dev or prod.
//
// express.static() sends Last-Modified/ETag but no Cache-Control by
// default, which lets browsers apply *heuristic* caching (RFC 7234) and
// keep serving an old HTML/JS file on normal reloads for a long time
// after a new deploy, without the visitor doing anything wrong. Forcing
// no-cache makes every request revalidate via ETag (still a cheap 304 in
// the common case) instead of silently going stale.
const webDir = path.resolve(__dirname, '../../web');
app.use(express.static(webDir, { setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache') }));
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

async function main() {
  await loadQuestionBank();
  await loadPromptBank();
  registerEngines();
  registerRoomSocketHandlers(io);

  httpServer.listen(env.port, () => {
    console.log(`bahjah server listening on :${env.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});

import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './config/env';
import { prisma } from './db/prisma';
import { adminRouter } from './modules/admin/routes';
import { authRouter } from './modules/auth/routes';
import { contactRouter } from './modules/contact/routes';
import { dashboardRouter } from './modules/games/dashboardRoutes';
import { historyRouter } from './modules/games/historyRoutes';
import { knowsYouBestRouter } from './modules/games/knowsYouBest/routes';
import { loadPromptBank } from './modules/games/knowsYouBest/promptBank';
import { mafiaRouter } from './modules/games/mafia/routes';
import { registerEngines } from './modules/games/registerEngines';
import { triviaRouter } from './modules/games/trivia/routes';
import { loadQuestionBank } from './modules/games/trivia/questionBank';
import { paymentsRouter } from './modules/payments/routes';
import { startRenewalScheduler } from './modules/payments/renewalScheduler';
import { roomsRouter } from './modules/rooms/routes';
import { registerRoomSocketHandlers } from './modules/rooms/socket';

const STARTED_AT = new Date().toISOString();

const app = express();
// Fly's edge terminates TLS and forwards plain HTTP internally; without this,
// req.protocol always reports 'http' behind the proxy, breaking anything that
// builds an absolute URL from the request (e.g. the room QR/join links).
app.set('trust proxy', 1);
app.use(cors({ origin: env.webOrigin, credentials: true }));
// The verify hook stashes the exact raw bytes on req.rawBody, alongside the
// normal parsed req.body -- only the Moyasar webhook route uses it, to check
// the x-moyasar-signature HMAC against what was actually sent on the wire.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as express.Request).rawBody = Buffer.from(buf);
    },
  })
);

// Reports which commit is actually running, so "the new design isn't live"
// can be answered by looking rather than guessing. Render injects
// RENDER_GIT_COMMIT/RENDER_GIT_BRANCH into the container at runtime; Fly
// doesn't, so GIT_COMMIT can be set there via a build arg if we ever want
// the same visibility in production. Null means "not reported by the host",
// not "unknown build".
//
// Always answers 200, even while the question banks are still loading or if
// loading them failed. That is deliberate: this path is the platform's health
// check, and a non-2xx here makes the whole service unroutable -- including
// every static page, which needs no database at all. A database problem
// should cost the games, not the website. `ready` and `bankError` say what is
// actually wrong, so the honest answer is in the payload rather than the
// status code.
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    ready: banks.ready,
    bankError: banks.error,
    // Only while something is broken, and only the host and database name --
    // never the credentials. A process holds whatever DATABASE_URL it booted
    // with, so when a database has just been repointed this is what tells you
    // whether the running container ever picked the new one up.
    db: banks.ready ? undefined : describeDatabaseTarget(),
    commit: process.env.RENDER_GIT_COMMIT ?? process.env.GIT_COMMIT ?? null,
    branch: process.env.RENDER_GIT_BRANCH ?? process.env.GIT_BRANCH ?? null,
    startedAt: STARTED_AT,
  });
});

app.use('/api/auth', authRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/games/trivia', triviaRouter);
app.use('/api/games/knows-you-best', knowsYouBestRouter);
app.use('/api/games/mafia', mafiaRouter);
app.use('/api/games', historyRouter);
app.use('/api/games', dashboardRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/contact', contactRouter);
app.use('/api/admin', adminRouter);

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
// express.static() ignores dotfile paths (like .well-known/...) by default,
// which would otherwise silently 404 the Apple Pay merchant domain
// association file Moyasar has us host there. Scoped to just this one
// prefix rather than a blanket dotfiles:'allow' on the whole static mount.
app.use('/.well-known', express.static(path.join(webDir, '.well-known')));
// Assets requested with a ?v= token (see the logo references in apps/web)
// are safe to cache hard: the token is part of the URL, so publishing new
// artwork under the same filename changes the URL and the browser fetches
// it rather than reusing what it already has. Without this, no-cache below
// makes every logo revalidate on every page load -- correct, but a wasted
// round trip for a file that by construction cannot have changed.
//
// This also fixes the case no-cache alone cannot: a browser that cached a
// logo *before* these headers existed applied heuristic freshness (RFC
// 7234) and will keep serving it without revalidating until that expires.
// A versioned URL sidesteps that entirely, since it is a different URL.
app.use(
  express.static(webDir, {
    setHeaders: (res) => {
      const versioned = typeof res.req?.query?.v === 'string' && res.req.query.v.length > 0;
      res.setHeader(
        'Cache-Control',
        versioned ? 'public, max-age=31536000, immutable' : 'no-cache',
      );
    },
  }),
);
app.get('/', (_req, res) => res.redirect('/bahjah-landing.html'));
// The Mafia game surface shares its result as bahjah.com/mafia?room=CODE, so
// that bare path has to resolve to the game itself (the room code is read off
// the query string to prefill a rematch join). It is a path, not a file, so
// express.static above passes it through to here.
app.get('/mafia', (_req, res) => res.sendFile(path.join(webDir, 'mafia-game.html')));

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong.' } });
};
app.use(errorHandler);

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: env.webOrigin, credentials: true },
});

// The question banks are read once into memory and served from there. They
// used to be awaited before the port opened, which meant a database that was
// slow, unreachable or expired stopped the process from ever listening -- so
// the platform's health check never passed, the wake never completed, and the
// site sat in a restart loop with nothing to look at. The failure had no
// surface: not even the static pages, which need no database, would load.
//
// So the port opens first and the banks load behind it, retrying rather than
// giving up. A player who arrives before they are ready gets a clear error
// from the game routes (getQuestionBankSync throws by design); everyone else
// gets the site.
const banks: { ready: boolean; error: string | null } = { ready: false, error: null };

// Host and database name out of DATABASE_URL, with user and password dropped.
function describeDatabaseTarget(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) return 'DATABASE_URL is not set';
  try {
    const u = new URL(raw);
    return `${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname}`;
  } catch {
    return 'DATABASE_URL is not a valid URL';
  }
}

// /api/health is public, so what it says about a failure has to be enough to
// act on without describing our own infrastructure. Prisma quotes the database
// host and port back in its message, but its error class and code carry the
// diagnosis on their own -- P1001 is "can't reach the database server", P1002
// a connection timeout, P1003 a missing database -- so report those and leave
// the prose (and the hostname in it) to the server log.
// The code lives under different property names depending on which Prisma
// error class this is: query errors use `code`, but PrismaClientInitializationError
// -- the one a broken DATABASE_URL actually produces -- uses `errorCode`. Reading
// only `code` is why staging's health endpoint reported a bare
// "PrismaClientInitializationError" with nothing to act on.
function summarise(err: unknown): string {
  if (err instanceof Error) {
    const e = err as { code?: unknown; errorCode?: unknown };
    const code = typeof e.code === 'string' && e.code.length > 0
      ? e.code
      : typeof e.errorCode === 'string' && e.errorCode.length > 0
        ? e.errorCode
        : null;
    return code ? `${err.name} (${code})` : err.name;
  }
  return 'Unknown error';
}

const BANK_RETRY_MS = 15_000;

async function loadBanks(): Promise<void> {
  try {
    // Connect explicitly before running any query. Prisma will connect lazily
    // on the first query anyway, but it only fills in `errorCode` (P1000 wrong
    // password, P1001 unreachable, P1003 missing database) when the failure
    // comes from $connect(). Going through a query instead throws the same
    // error class with the code stripped, which is exactly the useless bare
    // "PrismaClientInitializationError" staging reported for a day.
    await prisma.$connect();
    await loadQuestionBank();
    await loadPromptBank();
    banks.ready = true;
    banks.error = null;
    console.log('question banks loaded');
  } catch (err) {
    banks.ready = false;
    banks.error = summarise(err);
    // The full error, with its connection details, stays in the server log.
    console.error('Failed to load question banks; retrying', err);
    // Unref'd so a pending retry can never hold the process open on shutdown.
    setTimeout(loadBanks, BANK_RETRY_MS).unref();
  }
}

async function main() {
  registerEngines();
  registerRoomSocketHandlers(io);
  startRenewalScheduler();

  httpServer.listen(env.port, () => {
    console.log(`bahjah server listening on :${env.port}`);
  });

  await loadBanks();
}

main().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});

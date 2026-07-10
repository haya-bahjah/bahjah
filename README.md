# Bahjah

Multiplayer party games — trivia, mafia, and knows-you-best — bilingual (EN/AR), deploying to bahjah.com.

## Layout

- `apps/web` — static frontend (landing, auth, about, contact, and the three game pages).
- `apps/server` — Node.js/TypeScript backend: Express REST API + Socket.IO realtime layer, Postgres (via Prisma) for durable data, Redis for live room state.
- `packages/shared` — TypeScript types shared between frontend and backend (game types, WebSocket event contracts).

## Local development

**Easiest: Docker Compose.** With [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed:

```
docker compose up --build
```

This brings up Postgres, Redis, and the app together, with migrations and the trivia/knows-you-best question banks applied automatically on boot. Once it says `bahjah server listening on :3001`, open **http://localhost:3001** in a browser — that's the live site (landing page, sign up, create a room, play). Stop it with `Ctrl+C`; re-run `docker compose up` (no `--build`) next time unless you changed server code.

**Without Docker** (requires a local Postgres + Redis already running):

```
npm install
cp apps/server/.env.example apps/server/.env   # point at local Postgres + Redis
npm run build:shared
npm run dev:server
```

`GET /api/health` should return `{"status":"ok"}` once the server is up.

## Roadmap

Built in phases, each shipped and reviewed before moving to the next:

0. **Scaffolding** — monorepo, backend skeleton, deploy config.
1. **Auth** — real signup/signin backed by Postgres, wired into `auth.html`.
2. **Rooms** — create/join by room code, lobby presence over WebSocket.
3. **Game engine framework** — shared room/game state machine and WS protocol that all three games build on.
4. **Trivia engine** — questions, timers, scoring, leaderboard.
5. **Mafia engine** — roles, night/day phases, voting, win conditions.
6. **Knows You Best engine** — prompts, guessing, scoring.
7. **Polish & cutover** — reconnect handling, rate limiting, bahjah.com DNS + Fly.io deploy.

## Deployment

Every container boot runs `npm run start:prod` (see `apps/server/Dockerfile`), which applies any pending Prisma migrations, idempotently seeds the trivia/knows-you-best question banks, then starts the server — safe to run on every restart, no manual shell step needed on either host below.

**Free preview: Render.** `render.yaml` is a Blueprint that provisions the web service (from `apps/server/Dockerfile`), a free Postgres database, and a free Key Value (Redis-compatible) store, and wires them together automatically. To deploy: on [render.com](https://render.com), "New" -> "Blueprint", point it at this repo/branch.

Free-tier caveats worth knowing:
- The web service sleeps after 15 min idle; the next request takes ~1 min to wake it, which will drop any open WebSocket game connections. Fine for casual testing, not for a real game night.
- The free Postgres database **expires 30 days after creation** (14-day grace period to upgrade before it's deleted) — plan to upgrade or recreate it before then if you want to keep the data.
- The free Key Value store has no disk persistence (data is lost on restart) — a non-issue here since presence and in-progress game state are meant to be ephemeral.

**Production target: Fly.io.** `fly.toml` builds the same `apps/server/Dockerfile` from the repo root, for when bahjah.com is ready to go live on always-on infrastructure with a durable database.

First-time setup (run from the repo root, once `flyctl` is installed and you're logged in with `fly auth login`):

```
fly apps create bahjah                 # skip if the app already exists
fly postgres create                    # create a Postgres cluster, then:
fly postgres attach <cluster-name> -a bahjah   # sets the DATABASE_URL secret automatically
fly redis create                       # create a managed Redis; copy the connection string it prints
fly secrets set REDIS_URL="redis://..." JWT_SECRET="$(openssl rand -hex 32)" -a bahjah
fly deploy
```

`DATABASE_URL`, `REDIS_URL`, and `JWT_SECRET` are all required — the server checks for them at startup and exits immediately with a clear `Missing required env var: ...` error if any are missing (see `apps/server/src/config/env.ts`). **This is the most likely explanation for the earlier "no machines running" / `[PR04] could not find a good candidate` error**: if secrets were never set (or the Postgres/Redis attachments hadn't happened yet), every machine crashes on boot before the health check can ever pass, and after enough failed attempts across the fleet the proxy reports no healthy candidates. Running `fly logs -a bahjah` during a failed rollout will show the exact `Missing required env var` (or migration/DB-connection) error if this is the cause.

Once a deploy is healthy, connect the custom domain:

```
fly certs add bahjah.com -a bahjah
fly certs add www.bahjah.com -a bahjah   # optional
```

Then add the DNS records `fly certs show bahjah.com -a bahjah` gives you at your domain registrar, and re-run `fly certs check bahjah.com -a bahjah` once DNS propagates to confirm the certificate issued.

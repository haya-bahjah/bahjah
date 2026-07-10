# Bahjah

Multiplayer party games — trivia, mafia, and knows-you-best — bilingual (EN/AR), deploying to bahjah.com.

## Layout

- `apps/web` — static frontend (landing, auth, about, contact, and the three game pages).
- `apps/server` — Node.js/TypeScript backend: Express REST API + Socket.IO realtime layer, Postgres (via Prisma) for durable data, Redis for live room state.
- `packages/shared` — TypeScript types shared between frontend and backend (game types, WebSocket event contracts).

## Local development

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

**Free preview: Render.** `render.yaml` is a Blueprint that provisions the web service (from `apps/server/Dockerfile`), a free Postgres database, and a free Key Value (Redis-compatible) store, and wires them together automatically. To deploy: on [render.com](https://render.com), "New" -> "Blueprint", point it at this repo/branch. After the first deploy, run once from the service's Shell tab:

```
npx prisma migrate deploy --schema=apps/server/prisma/schema.prisma
npx prisma db seed
```

Free-tier caveats worth knowing:
- The web service sleeps after 15 min idle; the next request takes ~1 min to wake it, which will drop any open WebSocket game connections. Fine for casual testing, not for a real game night.
- The free Postgres database **expires 30 days after creation** (14-day grace period to upgrade before it's deleted) — plan to upgrade or recreate it before then if you want to keep the data.
- The free Key Value store has no disk persistence (data is lost on restart) — a non-issue here since presence and in-progress game state are meant to be ephemeral.

**Production target: Fly.io.** `fly.toml` builds the same `apps/server/Dockerfile` from the repo root, for when bahjah.com is ready to go live on always-on infrastructure with a durable database.

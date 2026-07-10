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

0. **Scaffolding** — monorepo, backend skeleton, Fly.io deploy config. *(this commit)*
1. **Auth** — real signup/signin backed by Postgres, wired into `auth.html`.
2. **Rooms** — create/join by room code, lobby presence over WebSocket.
3. **Game engine framework** — shared room/game state machine and WS protocol that all three games build on.
4. **Trivia engine** — questions, timers, scoring, leaderboard.
5. **Mafia engine** — roles, night/day phases, voting, win conditions.
6. **Knows You Best engine** — prompts, guessing, scoring.
7. **Polish & cutover** — reconnect handling, rate limiting, bahjah.com DNS + Fly.io deploy.

## Deployment target

Fly.io, with managed Postgres and Redis. `fly.toml` builds `apps/server/Dockerfile` from the repo root.

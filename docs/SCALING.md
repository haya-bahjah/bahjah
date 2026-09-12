# Scaling and capacity

Written 12 September 2026, against `staging`. Target revised from 10,000 to
**500–1,000 concurrent players**.

## The short answer

**500–1,000 concurrent is reachable, and it does not need the clustering work.**

That is the important consequence of lowering the target. Everything that made
10,000 hard was about running *more than one instance* — and at this size you
do not have to. One properly-sized container holds 500–1,000 players
comfortably, and the three single-process assumptions in the code (no
cross-instance socket adapter, an in-process room lock, in-process tick
scheduling) never come into play, because there is only ever one process.

What it does need is a **paid plan**. The blocker today is not the code, it is
512 MB of RAM, a tenth of a CPU, and a container that falls asleep after
fifteen minutes.

---

## What one instance can carry

Arithmetic rather than a feeling, for 1,000 players in rooms of ten:

| | Per unit | At 1,000 players | Against a 2 GB / 1 CPU instance |
|---|---|---|---|
| Socket memory | ~30–50 KB per socket.io connection | 30–50 MB | Trivial |
| Node baseline + question banks | — | ~100–150 MB | Trivial |
| Action rate | A trivia question every ~20–25 s | ~40–50 actions/sec | Trivial |
| Broadcast fan-out | Each action reaches its room | ~400–500 emits/sec | Comfortable on one core |
| Redis | 2 ops per action (load + save state) | ~100 ops/sec | Nothing |
| Postgres | Room create/join at the start, history at the end | Bursty, small | Needs a connection limit set — see below |

The load is dominated by fan-out, which scales with **players × room size**,
not players alone. A thousand players in rooms of fifty is five times the
broadcast work of a thousand in rooms of ten, for the same socket count. Size
the plan against the rooms you actually expect.

500 is roughly half of all of the above and is not close to any limit.

---

## What has to change

### 1. Leave the free plan — this is the whole fix

`render.yaml` declares `plan: free` for the web service. That means:

- **512 MB RAM and 0.1 of a CPU.** A tenth of a core cannot serialise and
  broadcast for a thousand clients.
- **Sleeps after 15 minutes idle**, with about a minute of cold start — and
  the wake drops every open WebSocket, so every live game dies.
- No autoscaler exists on the plan, which is why nothing is "misconfigured":
  there is nothing to configure.

A **2 GB / 1 CPU** class instance (Render's Standard tier or equivalent) is
the target for 1,000. For 500, one tier down is defensible, but the headroom
is worth more than the saving.

This is a billing decision, so `render.yaml` has deliberately been left on
`plan: free` — change the two `plan:` lines when you have picked a tier.

### 2. Set a Postgres connection limit

`new PrismaClient()` with no `connection_limit` in `DATABASE_URL` defaults to
`num_physical_cpus * 2 + 1` — **three connections on a 1-CPU instance**. Most
gameplay is Redis, so this is quiet most of the time, but it is not quiet when
fifty phones join a room at once: each guest join writes a User row and a
RoomMember row. Three connections and a 10-second pool timeout is how that
burst turns into `P2024` errors.

Append to `DATABASE_URL` in the dashboard:

```
?connection_limit=15&pool_timeout=20
```

### 3. Stop losing games to restarts

The free Redis has no disk persistence, and game state and presence both live
there. A restart — a deploy, a crash, a plan change — drops every in-flight
game. At 1,000 concurrent that is a hundred rooms ending mid-round.

A persistent Redis fixes the crash and plan-change cases. **Deploys are a
separate problem**: with a single instance, every deploy disconnects everyone,
because there is no second instance to hand the sockets to. Two mitigations,
pick one:

- Deploy off-peak and accept it. Simplest, and honest at this size.
- Run two or more instances — which *does* require the clustering work below.

### 4. The free Postgres is deleted after 30 days

Unrelated to scale, and the most likely thing to take production down. The
Blueprint already documents that it has happened once. Production needs a
managed database that does not expire, with backups.

---

## What is *not* needed at this size

These are the three single-process assumptions. They are real, and they are
why 10,000 was a different conversation — but **at one instance none of them
can fire**, and none is worth doing speculatively.

| | Where | Bites when |
|---|---|---|
| No socket.io Redis adapter | `index.ts` | Instance count > 1 |
| In-process room lock | `modules/games/roomLock.ts` | Instance count > 1 |
| In-process tick scheduler | `modules/games/scheduler.ts` | Instance count > 1 |
| In-memory rate-limit store | `middleware/rateLimit.ts` | Instance count > 1 (limits become per-instance) |

If you later want zero-downtime deploys or redundancy — both good reasons,
independent of load — these become required. Each is roughly an afternoon:
`@socket.io/redis-adapter` for the first, a `SET NX PX` lock for the second,
a Redis sorted set keyed by fire time for the third, and
`rate-limit-redis` for the fourth.

---

## Rate limits and the party problem

Fixed in this commit, and worth understanding because it is specific to this
product.

`trust proxy` is set, so rate limits key on the real client IP rather than
Render's load balancer — correct, but for a party game one IP means something
unusual: **everybody in the room is behind it**. Fifty phones at a venue share
one public address.

Guest join was capped at **20 per 15 minutes per IP**, while trivia and mafia
rooms hold **50 players**. A twenty-five person party on one WiFi hit the wall
at person twenty-one, and the rest simply could not join — the exact scenario
the product exists for. Promo redemption had the same shape: ten per hour per
IP meant only ten people at a party could ever use a code the party was given.

The limits are now split by what they actually protect:

- **Guessing a secret** is limited per account. Sign-in keeps 20 attempts per
  15 minutes *per email address*, so brute force is still bounded wherever it
  comes from, while thirty people signing in from one house are not. Promo
  redemption is keyed per user id for the same reason.
- **Burning server resources** is limited per IP, sized above a full room:
  guest join now 150 per 15 minutes, auth 100.

The cost of the higher guest-join ceiling is more junk guest rows per hour
from one address. That is the right trade for a party game, but guest accounts
accumulate and a sweep of ones with no recent membership is worth adding.

---

## Prove it rather than trust it

`scripts/loadtest.js` simulates real players — guest join over REST, a real
socket.io connection, `room:join`, then actions for the length of a game —
and reports peak concurrent sockets, action→state latency at p50/p95/p99,
drops, and 429s.

```bash
npm i -D socket.io-client
node scripts/loadtest.js --url https://bahjah-server-6bin.onrender.com \
                         --players 500 --room-size 10 --minutes 3
```

Point it at **staging, never production** — it creates real guest accounts and
real rooms. Ramp gradually; a thundering herd measures your laptop's ability
to open sockets, not the server's ability to hold them. Past a few thousand
sockets you are measuring the client, so run it from two or three boxes if you
need a number you can defend.

Good looks like: no drops, no 429s, p95 under about 500 ms. Sustained p95 over
a second, or sockets dropping, is the ceiling.

Run it against the free plan first — it will fail early, and that failure is a
useful baseline. Then upgrade and run it again. **The numbers in this document
are estimates; the load test is the only thing that turns them into a
capacity.**

---

## Summary

| Question | Answer |
|---|---|
| Is autoscaling configured? | No — and at 500–1,000 you do not need it |
| Can one instance serve 500? | Yes, comfortably, on a paid plan |
| Can one instance serve 1,000? | Yes, on a 2 GB / 1 CPU class instance — verify with the load test |
| Can the current free-tier deployment? | No. It sleeps, and 0.1 CPU is not enough |
| Is code work required? | Not for this target. Only if you later want more than one instance |

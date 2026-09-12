# Scaling and capacity

Written 12 September 2026, against `staging` at commit `2dffa5b`.

## The short answer

**Autoscaling is not configured, and it could not safely be switched on today.**
The server is written to run as one process. Three specific things break the
moment a second instance exists, and they break loudly — see
[What breaks at two instances](#what-breaks-at-two-instances).

**10,000 concurrent players is roughly two orders of magnitude beyond what the
current deployment can serve.** Today's ceiling is a single free-tier
container: 512 MB of RAM, 0.1 of a CPU, asleep after 15 minutes of quiet.

Neither of these is a criticism of the code. The application is built cleanly
against Redis and Postgres, which is most of the work; what is missing is the
handful of places that still assume "one process" and the infrastructure to
run more than one.

---

## Where things stand

`render.yaml` declares one web service on `plan: free`, with no `scaling`
block and no `numInstances`. Render's free plan is a single instance and has
no autoscaler to configure, so there is nothing mis-set — there is simply
nothing set.

The free tier also carries three caveats the Blueprint already documents: the
service sleeps after 15 minutes idle and takes about a minute to wake (dropping
every open WebSocket when it does), the free Postgres is **deleted 30 days
after creation and not replaced**, and the free Redis has no disk persistence.

## What breaks at two instances

These are correctness failures, not slowdowns. Raising the instance count
without fixing them makes the product worse, not faster.

### 1. Socket.io has no cross-instance adapter

`io.to(code).emit(...)` reaches only the sockets held by the process that runs
it. With two instances, two players in the same room who happen to connect to
different containers cannot see each other at all — no roster, no game state,
no chat. Not degraded: absent.

*Fix:* `@socket.io/redis-adapter`, wired to the Redis connection that already
exists in `db/redis.ts`. This is the one change that is strictly required
before instance count can ever exceed one.

### 2. The room lock is in-process

`modules/games/roomLock.ts` serialises read-modify-write on game state with a
`Map<string, Promise>`. Its own header comment explains exactly what that
prevents: two actions on the same room interleaving, so the later save
overwrites state read before the earlier one landed, silently dropping a
player's move. Across processes that protection does not exist.

*Fix:* a Redis lock (`SET key token NX PX ttl`, released only by the holder)
behind the same `withRoomLock` signature, so nothing else has to change.

### 3. Scheduled ticks are in-process

`modules/games/scheduler.ts` keeps `setTimeout` handles in a `Map`. Whichever
instance handled the last action owns that room's next tick. If that instance
restarts, is scaled down, or is simply not the one the next action lands on,
the tick never fires and a trivia or mafia phase hangs until someone acts.

Knows You Best is immune — nothing in it runs on a clock any more — but the
other two games depend on this.

*Fix:* move the due-time into Redis (a sorted set keyed by fire time) and let
any instance claim and run what is due.

### Also worth settling before a prod push

- **`WEB_ORIGIN` is `"*"` in the staging Blueprint.** Production should name
  `https://bahjah.com` explicitly rather than inherit a wildcard.
- **Prisma has no connection limit set.** `new PrismaClient()` with no
  `connection_limit` in `DATABASE_URL` defaults to `num_cpus * 2 + 1` per
  instance. Fine for one; with N instances against one Postgres it is the
  first thing to exhaust.

## Why 10,000 concurrent is far off

Concrete arithmetic rather than a feeling:

| Constraint | Today | Needed for 10k |
|---|---|---|
| Instances | 1 (free plan, no autoscaler) | Many, behind a load balancer with sticky sessions or the Redis adapter |
| RAM | 512 MB total | A socket.io connection costs roughly 30–50 KB of heap. 10,000 of them is ~300–500 MB **before any game state** — the whole plan's memory |
| CPU | 0.1 of a core | Broadcasting to 10k sockets and serialising room state per action is not a tenth-of-a-core workload |
| Postgres | Free tier, deleted after 30 days | Managed instance, connection pooling (PgBouncer), real backups |
| Redis | Free, no persistence | Persistent, sized for presence + game state across every live room |

Rooms cap at 50 players for trivia and mafia, so 10,000 concurrent players is
at least 200 simultaneous rooms and realistically over 1,000 at normal party
sizes. Every action fans out to everyone in its room, so load scales with
players × room size, not with players alone.

## What it would take, in order

1. **A paid plan with more than one instance.** Nothing else matters until
   this is true, and nothing else should be attempted before it.
2. **Redis adapter for socket.io.** Required for step 1 to be correct rather
   than merely bigger.
3. **Redis-backed room lock.**
4. **Redis-backed tick scheduler** with claim semantics.
5. **Managed Postgres**, with `connection_limit` set per instance and a pooler
   in front.
6. **Redis sized and persistent.**
7. **Load testing.** None of the above is proven until it has been measured
   with simulated rooms — the numbers in the table are estimates, and the only
   honest way to state a capacity is to have reached it.

Steps 2–4 are contained code changes, each an afternoon's work. They are
deliberately *not* done yet: they cannot be tested in an environment without
Redis and a second instance, and untested clustering code in a server that
takes payments is a worse risk than a documented gap.

## What the current deployment can serve

A single small container handling a launch-day crowd in the **tens to low
hundreds** of concurrent players, provided it is kept awake. That is a real
answer for a launch, and it is not 10,000.

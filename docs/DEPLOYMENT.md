# Deployment & Branching

## Branches

- **`claude/bahjah-backend-games-pytlmj`** — production. Every push here triggers
  `.github/workflows/fly-deploy.yml`, which deploys straight to Fly.io (`bahjah` app,
  `bahjah.com`). This is unchanged from how the project has always worked.
- **`staging`** — integration/preview branch. Every push here triggers
  `.github/workflows/staging-typecheck.yml` (a fast build+typecheck gate) and, once
  connected (see below), auto-redeploys the Render.com preview environment.

Nothing about the production branch or `fly-deploy.yml` changed to add staging — it's a
second, independent branch and pipeline layered on top.

## Staging preview (Render.com)

`render.yaml` at the repo root is a Render Blueprint that provisions a free web service,
Postgres database, and key-value store, wired together automatically. Activated as of
this writing, on the `staging` branch, as a Blueprint named "Staging" in the Render
dashboard. One-time setup, for reference (Render dashboard, not repo work):

1. Sign in / create an account at render.com.
2. **New +** → **Blueprint** → connect the `haya-bahjah/bahjah` GitHub repo (this
   authorizes Render's own GitHub App — separate from Claude's repo access).
3. Point the blueprint at the **`staging`** branch (not the production branch).
4. Render provisions the service + DB + key-value store from `render.yaml` and gives a
   `*.onrender.com` URL, each with a random suffix (e.g. `bahjah-server-6bin`) — safe to
   ignore, no need to keep it in sync with this doc.
5. From then on, every push to `staging` auto-redeploys that preview — Render's own
   webhook handles it, independent of GitHub Actions.

**Free-tier gotcha**: a Render account only gets *one* free Postgres database and *one*
free Key Value instance, account-wide — not one per Blueprint. If a create fails with
"cannot have more than one active free tier database/Key Value instance," it means
another Blueprint (or a standalone resource left over after deleting one) is already
using that slot. Check **Resources** in the left sidebar for orphaned services — deleting
a Blueprint does not always delete the resources it created — and delete those first, or
repoint the existing Blueprint's branch (**Settings** → Branch) instead of creating a new
one.

### Known limits of the free tier

- The web service sleeps after 15 minutes idle; the next request takes ~1 minute to
  wake it up, and any open Socket.io game connections at that moment drop. Don't mistake
  this for a real bug — it's specific to the free-tier preview, not production.
- The free Postgres database expires 30 days after creation (14-day grace period to
  upgrade before deletion). This is a non-issue in practice: `apps/server/prisma/seed.ts`
  runs on every boot (`start:prod` = `prisma migrate deploy && tsx prisma/seed.ts && node
  dist/index.js`) and is idempotent — it matches existing rows by content and backfills
  rather than duplicating, so it safely re-bootstraps a brand-new empty database with zero
  manual steps. When Render swaps in a replacement DB, the next boot just self-heals.
- The free key-value store has no disk persistence — fine here, since presence/game state
  is meant to be ephemeral.

## Promotion (staging → production)

Once a change looks right on the Render preview URL:

```
git checkout claude/bahjah-backend-games-pytlmj
git merge staging
git push origin claude/bahjah-backend-games-pytlmj
```

`fly-deploy.yml` picks it up automatically from there, exactly as it does today.

## Rollback (production)

Revert the bad commit(s) on the production branch and push — the same existing pipeline
redeploys the previous good state:

```
git checkout claude/bahjah-backend-games-pytlmj
git revert <bad-commit-sha>
git push origin claude/bahjah-backend-games-pytlmj
```

No new tooling needed — this already worked before staging existed, it just wasn't
written down anywhere.

## Database backups

`.github/workflows/db-backup.yml` runs a daily logical backup of the production
`bahjah-db` Postgres cluster (also runnable on demand via `workflow_dispatch`):

1. Uses `flyctl ssh console -a bahjah-db -C "sh -c 'PGPASSWORD=$OPERATOR_PASSWORD pg_dumpall
   -h localhost -U postgres'"` (using the same `FLY_API_TOKEN` secret the deploy workflow
   already uses) to run `pg_dumpall` directly on the Postgres machine over SSH and stream
   the output back. Two things that aren't obvious up front, confirmed by a live run:
   `pg_dumpall` with no `-h` defaults to a Unix socket that doesn't exist in Fly's
   container (it only listens on TCP), and TCP auth needs a password — `OPERATOR_PASSWORD`
   is already set as an env var on the machine itself, no separate secret needed.
2. Gzips the output into a timestamped `.sql.gz` file.
3. Uploads it as a GitHub Actions artifact (default retention: 90 days).

This is a *logical* backup (schema + data as SQL) — complementary to Fly's own automatic
daily volume snapshots (block-level, ~5-day retention). A logical dump also protects
against in-place data corruption that a raw disk snapshot would otherwise just preserve
as-is.

### Restoring

- **Fast, whole-cluster restore** (e.g. recovering from a bad deploy or corrupted volume):
  use Fly's own volume-snapshot restore —
  [`flyctl postgres`](https://fly.io/docs/postgres/managing-postgres/) snapshot restore
  from the Fly dashboard/CLI.
- **Selective/portable restore** (e.g. seeding a fresh staging DB with real data, or
  recovering specific rows): download the artifact from the relevant `db-backup.yml` run
  in the Actions tab, decompress it, and replay it. The dump is a full `pg_dumpall`
  output (all databases + roles), so it's typically replayed against a fresh Postgres
  instance rather than an existing one:
  ```
  gunzip bahjah-db-YYYYMMDD.sql.gz
  flyctl proxy 5432 -a bahjah-db &
  psql "postgres://postgres:<password>@localhost:5432/postgres" -f bahjah-db-YYYYMMDD.sql
  ```
  (Get the `postgres` superuser password with `flyctl ssh console -a bahjah-db -C
  "printenv OPERATOR_PASSWORD"`, or use `flyctl postgres connect -a bahjah-db` for an
  interactive session instead.)

## Domain

Production continues to serve `bahjah.com` via the existing Fly.io certificate — nothing
about that changes here. A custom subdomain for staging (vs. the free `*.onrender.com`
URL) is a deliberately deferred decision, to be revisited once the flow above has been
proven out in practice.

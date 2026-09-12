# Go-live checklist

Written 12 September 2026, against `staging` at commit `2dffa5b`.

Everything below is either verified on staging or is a step that can only be
done on production. Items marked **cannot be verified from the repo** need a
person with a device or a dashboard login; they are listed rather than quietly
assumed.

---

## Apple Pay

### What is in place

- `apps/web/.well-known/apple-developer-merchantid-domain-association` exists
  and is served: `index.ts` mounts `/.well-known` with its own
  `express.static`, because express.static ignores dotfile paths by default
  and would otherwise 404 it.
- The file decodes to Moyasar's own PSP domain-association payload
  (`pspId: CB999E93…`). It is **the same file for every
  Moyasar merchant** — it is not generated per domain, which is why staging
  and production serve an identical copy, and why its presence on disk says
  nothing about which domains are registered. Registration happens in the
  Moyasar dashboard, under their Web Registration flow (Settings ▸ Apple Pay ▸
  Domains).
- The server sends the Apple Pay block from `buildCheckoutConfig`
  (`country: SA`, `label: Bahjah`, `validate_merchant_url` pointing at
  Moyasar's own initiate endpoint), so the amount and the merchant name the
  sheet shows are decided server-side, not in the browser.
- `assets/payments.js` only lists `applepay` as a method when the server sent
  that block. This matters: the Moyasar widget validates the block up front,
  and listing `applepay` without a complete `apple_pay` object stops the whole
  form rendering, card option included.
- `test_150sar` exists as a staging-only plan specifically so Apple Pay can be
  rehearsed at a realistic amount — the sheet shows the shopper what they are
  authorising, so testing at a token amount does not rehearse what they see.

### Confirmed on staging — 12 September 2026

`bahjah-server-6bin.onrender.com` shows **REGISTERED** under Apple Pay ▸
Domains in the Moyasar dashboard, on the **Live** environment, and Apple Pay
is working there.

That is worth more than it looks. It proves three things about the code that
no amount of reading could: the association file committed in this repo is the
right file, `/.well-known/...` is genuinely reachable over HTTPS from outside
(the dedicated `express.static` mount works), and the `apple_pay` block the
server sends is one the widget accepts.

**So production needs nothing from the repo.** It needs two rows added in the
dashboard.

### What has to be done on production — cannot be verified from the repo

### Why bahjah.com first failed validation — fixed 12 September 2026

Adding `bahjah.com` got past the hostname field and then failed with
**"Validation Failed: Server responded with status 404 Not Found"**.

The cause was neither the file nor the route. The production branch
(`claude/bahjah-backend-games-pytlmj`) was sitting at `b8ba667`, dated **26
August**, and the association file was first committed on **28 August** — two
days later. The `/.well-known` mount had been there since 24 August and worked
fine; there was simply nothing behind it to serve. Production was 114 commits
behind staging.

Commit `84e4584` puts **only that file** on the production branch — no code,
nothing that can affect a game or a payment. Deploy production, then press
**Validate** on the pending `bahjah.com` row.

One consequence to know about before the full release: production now carries
one commit that staging does not, so promoting staging is a **merge, not a
fast-forward**. The file is byte-identical on both branches, so there is
nothing to resolve — but the promotion will not fast-forward, and that is
expected rather than a sign something is wrong.

1. **Register BOTH `bahjah.com` and `www.bahjah.com`** as Apple Pay domains in
   the Moyasar dashboard.

   Both are live on Fly with their own certificates (see DEPLOYMENT.md ▸
   Domain — GoDaddy points the apex at Fly's IPs and `www` at
   `bahjah.fly.dev`). Apple Pay validates against the **exact hostname of the
   page the sheet opens on**, so registering only the apex means anybody who
   arrived at `www.` gets a card form and no Apple Pay button, with nothing in
   any log to say why.

   **"Data validation failed — Invalid hostname"** means the field wants a
   bare hostname and got something else. In order of likelihood:

   - a scheme: `https://bahjah.com` → enter `bahjah.com`
   - a trailing slash: `bahjah.com/`
   - a path: `bahjah.com/.well-known/apple-developer-merchantid-domain-association`
   - whitespace from a paste (easy to do when copying the existing row)
   - a port, or an IP rather than a name

   The value should look exactly like the staging row that already works:
   hostname only, no scheme, no slash.

2. **The association file has been replaced** (12 September 2026). It had
   rotated and nobody had noticed, because an existing registration keeps
   working on the file it was verified against.

   | | Was in the repo | Now in the repo |
   |---|---|---|
   | Size | 9,122 bytes | 228 bytes |
   | Created | 2021-07-15 | 2026-08-19 |
   | Shape | `version`, `pspId`, `createdOn`, **`signature`** (4,432-char PKCS#7) | `version`, `pspId`, `createdOn` |
   | `pspId` | `CB999E93…` | `CB999E93…` (same — same PSP) |

   Apple dropped the signed-blob format; the current file is the short
   unsigned token. The copy now committed is byte-for-byte what the Moyasar
   dashboard's **Domain Association** button hands out
   (sha256 `0a64c169…`).

   This matters for exactly the step you are on: a **new** domain is verified
   against the file the dashboard issues **today**, so registering
   `bahjah.com` against a 2021 file would fail verification even once the
   hostname itself is accepted. It does not explain "Invalid hostname" — that
   is the text in the field, and comes earlier — but it is the next thing that
   would have gone wrong.

   After deploying, confirm what is actually being served:

   ```bash
   curl -s https://bahjah.com/.well-known/apple-developer-merchantid-domain-association | sha256sum
   # expect 0a64c169855257b6f2fa0d544117498ed757084b8bb8c86b5972612d11c3d455
   ```

   If Apple Pay ever stops appearing on every domain at once, this file
   rotating again is the first thing to check.
2. **Confirm `MOYASAR_PUBLISHABLE_KEY`, `MOYASAR_SECRET_KEY` and
   `MOYASAR_WEBHOOK_SECRET` are set on the production service**, and that they
   are the *live* keys, not test keys.
3. **Fetch the association file over production HTTPS** and confirm a 200 with
   the file body:
   `curl -i https://bahjah.com/.well-known/apple-developer-merchantid-domain-association`
4. **Pay once, on a real device.** Apple Pay cannot be exercised in a headless
   browser, in Chrome, or on a desktop without a paired device. Use Safari on
   an iPhone with a card in Wallet, buy a Day Pass, and check:
   - the sheet shows **Bahjah** as the merchant and **9.60 SAR** while the
     National Day offer is running;
   - the payment lands in the Moyasar dashboard as `paid`;
   - `paidUntil` moves on the account (Settings shows Day Pass, active);
   - the webhook arrives — `POST /api/payments/webhook` reconciles it a second
     time, and that path is what production relies on.

Until the payment step has been done once on production, Apple Pay should be
treated as unproven **there**. The mechanism is no longer in doubt — staging
settles that — but a registration that has not been made is still a
registration that has not been made.

---

## Password reset

New in `2dffa5b`. Test on staging before promoting:

1. `/auth.html` → **Forgot your password?** → enter a real address you can
   read → the page should say the same thing whether or not that address has
   an account.
2. Check the inbox. The mail comes from Resend, so `RESEND_API_KEY` and
   `MAIL_FROM` must be set on the service — **without them the send throws and
   the user still sees the success screen** (by design: the screen must not
   reveal anything), so a missing key is silent to the user and visible only
   in the server log. Check the log if no mail arrives.
3. Follow the link, set a password of at least 8 characters, confirm you land
   signed in.
4. Follow the same link again — it must be refused.
5. Ask for a second link, then try the first one — it must be refused.
6. Sign in with the new password.

**Known limitation, deliberately not fixed:** sessions are stateless 30-day
JWTs, so resetting a password does not invalidate sessions already signed in
elsewhere. Someone who already holds a token keeps it until it expires.
Closing that means adding a session version to the token and checking it on
each request, which puts a lookup in the auth hot path — worth doing, but not
worth doing untested the week of a launch.

---

## Promo code — BAHJAH24

Verified against the real service in `45e3704` (24h granted, once per account,
simultaneous taps grant once, case and spacing ignored, stacking on existing
access, guest refused, expiry at the right second). On staging, confirm the
round trip against a real database:

1. Settings → Packages → **Have a promo code?** → `BAHJAH24` → expect
   "Done — 24 hours of full access unlocked."
2. The Day Pass card should now read **Current plan**, and the subscription
   panel should show Active with a date 24 hours out.
3. Redeem it a second time → "You've already used that code."
4. Try `BAHJAH25` → "That code isn't valid."
5. Switch to Arabic and confirm the refusal reads in Arabic.

The code stops being accepted at midnight Riyadh on 28 September 2026, the same
deadline as the 9.60 price.

---

## Rehearsal plans — fixed 12 September 2026

`test_50sar` (50 SAR) and `test_150sar` (150 SAR) charge a real card. They
were `purchasable: true` with a comment saying "Not on production", and
nothing enforced it — so **the 50 SAR card had been sitting on bahjah.com
above the Day Pass**, badged "Staging payment test only", with a working
Select button. Promoting staging would have added the 150 SAR one beside it.

Both are now gated on `ENABLE_TEST_PLANS`, which production must never set.
The gate is in two places on purpose: the server refuses to build a checkout
for a non-purchasable plan and leaves them out of `GET /api/payments/plans`,
and Settings renders a rehearsal card only when that endpoint has named it —
so they are hidden before the server has answered, not shown and then taken
away.

Check after deploying production: Settings ▸ Packages should list **only**
Day Pass. If a "Test" card appears, `ENABLE_TEST_PLANS` is set on the Fly app
and must be unset.

## Analytics

`/admin-analytics.html` — on **both** staging and production, since the two
trees are identical. Which host you use only changes whose numbers you see.

**Who can open it.** `ADMIN_EMAILS` on the server, which **replaces** the
default rather than adding to it. Unset, the only admin is
`develop@bahjah.com` — so any other account, including the owner's, gets a
404 from the API and "Not on the admin list" from the page.

To add yourself:

```bash
# production (Fly) -- name EVERY admin, the list is not additive
flyctl secrets set ADMIN_EMAILS="you@bahjah.com,develop@bahjah.com" -a bahjah
```

Setting a Fly secret restarts the machine, so expect a few seconds of
downtime. On staging, set the same variable in the Render dashboard.

Confirm without shell access:

```bash
curl -s https://bahjah.com/api/health | python3 -m json.tool   # config.adminCount
```

**Three different refusals, and they mean different things:**

| What the page says | What it means |
|---|---|
| "Sign in required" | No token at all. Note a **guest** session does not count — guests have no email, so they can never be admins |
| "Session expired" | The token is stale; sign in again |
| "Not on the admin list" | Signed in fine, but this account is not in `ADMIN_EMAILS`. The page names the account it tried, so you can see whether you are signed in as who you think |

---

## Contact form

The form already delivers to `contact@bahjah.com` — that is `CONTACT_INBOX`'s
default in `config/env.ts`, and the route passes it straight to `sendMail`.
The visitor's own address rides along as `reply_to`, so hitting Reply in the
inbox answers them directly. `contact@bahjah.com` is also the `mailto:` link
in the page's "Email us" panel.

**What actually decides whether it works is `RESEND_API_KEY` and `MAIL_FROM`.**
Without both, `sendMail` throws before it sends, and the visitor is told
"We couldn't send your message just now — please email contact@bahjah.com
instead." That is a decent fallback, but it means a silent misconfiguration
looks like a working page.

`MAIL_FROM` must be an address on a domain **verified with Resend**, or their
API rejects the send even with a valid key.

Check it without shell access:

```bash
curl -s https://bahjah.com/api/health | python3 -m json.tool
```

`config.mail` is `true` only when both are set. `config.contactInbox` and
`config.mailFrom` show the addresses in play. Then send one real message
through the form and confirm it lands.

The same two variables are what password reset needs, and its failure is even
quieter — the user sees the success screen either way, by design.

---

## Scaling

See [SCALING.md](./SCALING.md). Short version for the revised 500-1,000
target: **no code changes needed** -- one properly-sized instance carries it,
and the three clustering gaps only bite above one instance. What is needed is
a paid plan (the free tier sleeps and has 0.1 CPU), a Postgres
`connection_limit`, a persistent Redis, and a database that is not deleted
after 30 days. Prove the number with `scripts/loadtest.js` against staging
before trusting it.

---

## Environment variables production needs

| Key | Why |
|---|---|
| `DATABASE_URL` | Postgres. Use the **external** URL; an internal hostname only resolves in-region (see DEPLOYMENT.md) |
| `REDIS_URL` | Presence, game state, room config |
| `JWT_SECRET` | Sessions |
| `MOYASAR_PUBLISHABLE_KEY` | The embedded payment form |
| `MOYASAR_SECRET_KEY` | Reconciling payments server-side |
| `MOYASAR_WEBHOOK_SECRET` | Verifying webhook signatures |
| `RESEND_API_KEY` | Password reset and contact mail |
| `MAIL_FROM` | Verified sending address for the above |
| `CONTACT_INBOX` | Optional; defaults to contact@bahjah.com |
| `ADMIN_EMAILS` | Who can open the admin pages. Unset means nobody |
| `WEB_ORIGIN` | Set to `https://bahjah.com`, not `*` |
| `DATABASE_URL` query | Append `?connection_limit=15&pool_timeout=20` -- the default is 3 connections on a 1-CPU instance, which a fifty-player room join burst will exhaust |
| `ENABLE_TEST_PLANS` | **Leave unset on production.** Set only on staging. It is what makes the 50 and 150 SAR rehearsal plans purchasable; without it they are refused by the server and never rendered |
| `TEST_ACCOUNT_EMAILS` | Optional. **Replaces** the default exempt list rather than adding to it — an environment that sets it must name every exempt account |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Staging only. Production must not set these |

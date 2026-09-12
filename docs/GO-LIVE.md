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
  (`pspId: CB999E93…`, created July 2021). It is **the same file for every
  Moyasar merchant** — it is not generated per domain, which is why staging
  and production can serve an identical copy. The domain itself is registered
  in the Moyasar dashboard, under their Web Registration flow.
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

### What has to be done on production — cannot be verified from the repo

1. **Register `bahjah.com` as an Apple Pay domain in the Moyasar dashboard.**
   This is the step that actually enables it. The file on disk is necessary but
   not sufficient, and it is domain-agnostic, so its presence proves nothing
   about whether bahjah.com is registered.
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

Until step 4 has been done once on production, Apple Pay should be treated as
unproven. It is configured; it is not verified.

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

## Analytics

New in `2dffa5b`, at `/admin-analytics.html`, behind the same `ADMIN_EMAILS`
gate as the question bank.

- Confirm `ADMIN_EMAILS` is set on production and contains the right people.
  With it unset, the admin routes answer 404 to everyone — including you.
- Open the page signed in as an admin and confirm numbers appear.
- Open it signed in as a non-admin and confirm it refuses without confirming
  the page exists.

---

## Contact

`contact@bahjah.com` is already the address on `/contact.html` (a `mailto:`
link in the "Email us" panel) and is already where the contact form delivers —
`CONTACT_INBOX` defaults to it in `config/env.ts`. Nothing to change; confirm
the inbox is monitored and that Resend can send from `MAIL_FROM`.

---

## Scaling

See [SCALING.md](./SCALING.md). Short version: autoscaling is not configured,
cannot be safely enabled without three code changes, and 10,000 concurrent
players is far beyond the current single free-tier container.

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
| `TEST_ACCOUNT_EMAILS` | Optional. **Replaces** the default exempt list rather than adding to it — an environment that sets it must name every exempt account |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Staging only. Production must not set these |

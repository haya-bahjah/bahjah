// Promo codes: a code somebody types in that grants access outright, with no
// payment. Distinct from a plan offer (plans.ts), which discounts a price
// everybody pays automatically -- here nothing is charged at all.
//
// The server owns every part of this. The client sends a string; it never
// says what the string is worth, how long the grant runs, or whether the code
// is still live.

export interface PromoCode {
  // Canonical form: upper-case, no surrounding space. What the user types is
  // normalized to this before anything is looked up, so "bahjah24" and
  // " BAHJAH24 " are the same code.
  code: string;
  // What one redemption is worth. Exactly one of these.
  //
  //   grantHours  a rolling window -- 24 hours from whenever you redeem, so
  //               the code is worth the same on the first day as on the last.
  //   grantUntil  a fixed deadline -- everybody who redeems lands on the same
  //               instant, and the code is worth less the later you use it.
  //               ISO 8601 with an explicit offset, same as the window below.
  grantHours?: number;
  grantUntil?: string;
  // ISO 8601 with an explicit offset, written in Riyadh time for the same
  // reason the National Day offer's window is (see plans.ts): the window
  // should mean what it says in the market it is aimed at, whatever timezone
  // the server runs in. startsAt inclusive, endsAt exclusive.
  startsAt: string;
  endsAt: string;
  label: { en: string; ar: string };
}

// Every account may redeem a given code once, ever -- enforced by the unique
// (code, userId) index on PromoRedemption, not by a check here.
//
// BAHJAH24 runs to the same deadline as the National Day price: the last
// redemption is at 23:59:59 on 27 September 2026, Riyadh time. Access already
// granted runs its full 24 hours from the moment it was redeemed, including
// past that deadline.
//
// BAHJAHSND was extended by a day and now outlives it, ending with the 28th.
// The two no longer finish together; moving BAHJAH24 or the price to match is
// a separate decision.
//
// To end it early, take the entry out of PROMOS (or move endsAt). To keep it
// running, move endsAt. Redemptions already recorded are unaffected either
// way -- they are history, not a live grant.
// BAHJAHSND is the campaign pass: redeem it any time before the deadline and
// every game is free until it. Unlike BAHJAH24 it does not hand out a fixed
// 24 hours -- it hands out "the rest of National Day", so somebody redeeming
// on the 13th gets a fortnight and somebody redeeming on the 28th gets a day.
// Its grant and its own deadline are the same instant on purpose: a code that
// could still be typed after it stopped being worth anything would report
// success and grant nothing.
export const PROMOS: Record<string, PromoCode> = {
  BAHJAH24: {
    code: 'BAHJAH24',
    grantHours: 24,
    startsAt: '2026-09-12T00:00:00+03:00',
    endsAt: '2026-09-28T00:00:00+03:00',
    label: { en: 'National Day — 24 hours free', ar: 'اليوم الوطني — ٢٤ ساعة مجانًا' },
  },
  BAHJAHSND: {
    code: 'BAHJAHSND',
    // Midnight opening the 29th, so the whole of the 28th is included. Both
    // dates move together: see the note above about a code outliving what it
    // is worth.
    grantUntil: '2026-09-29T00:00:00+03:00',
    startsAt: '2026-09-13T00:00:00+03:00',
    endsAt: '2026-09-29T00:00:00+03:00',
    label: {
      en: 'National Day — free until 28 September',
      ar: 'اليوم الوطني — مجانًا حتى ٢٨ سبتمبر',
    },
  },
  // UCL: 24 hours free from the moment it is redeemed, once per account, same
  // as BAHJAH24. Open-ended on purpose -- no campaign deadline, it runs until
  // it is taken out of PROMOS. The far-future endsAt stands in for "never".
  UCL: {
    code: 'UCL',
    grantHours: 24,
    startsAt: '2026-09-24T00:00:00+03:00',
    endsAt: '2100-01-01T00:00:00+03:00',
    label: { en: 'UCL — 24 hours free', ar: 'UCL — ٢٤ ساعة مجانًا' },
  },
};

// What a redemption is worth to this account, right now.
//
// Never shortens access somebody already holds. A fixed-deadline code handed
// to a monthly subscriber whose month runs into October must not pull them
// back to September, and a rolling code stacks on top of what is left rather
// than replacing it -- same rule as buying a Day Pass while one is running.
//
// grantedHours is what the account actually gained, not what the code
// advertises, so the redemption row says what happened rather than what was
// offered.
export function resolvePromoGrant(
  promo: PromoCode,
  currentPaidUntil: Date | null,
  now: Date = new Date()
): { grantedUntil: Date; grantedHours: number } {
  const from = currentPaidUntil && currentPaidUntil.getTime() > now.getTime()
    ? currentPaidUntil.getTime()
    : now.getTime();

  const target = promo.grantUntil
    ? Math.max(from, Date.parse(promo.grantUntil))
    : from + (promo.grantHours ?? 0) * 60 * 60 * 1000;

  return {
    grantedUntil: new Date(target),
    grantedHours: Math.max(0, Math.round((target - from) / (60 * 60 * 1000))),
  };
}

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isPromoLive(promo: PromoCode, now: Date = new Date()): boolean {
  const t = now.getTime();
  return t >= Date.parse(promo.startsAt) && t < Date.parse(promo.endsAt);
}

// The code as typed, or null if there is no such code. Deliberately does not
// consider the window: an expired code and a code that never existed are
// different answers to the person holding it, and the caller says which
// message they get.
export function findPromo(raw: string): PromoCode | null {
  return PROMOS[normalizeCode(raw)] ?? null;
}

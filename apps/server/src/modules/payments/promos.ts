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
  // Hours of access one redemption grants.
  grantHours: number;
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
// BAHJAH24 runs to the same deadline as the National Day price, so the two
// halves of the campaign end together: the last redemption is at 23:59:59 on
// 27 September 2026, Riyadh time. Access already granted runs its full 24
// hours from the moment it was redeemed, including past that deadline.
//
// To end it early, take the entry out of PROMOS (or move endsAt). To keep it
// running, move endsAt. Redemptions already recorded are unaffected either
// way -- they are history, not a live grant.
export const PROMOS: Record<string, PromoCode> = {
  BAHJAH24: {
    code: 'BAHJAH24',
    grantHours: 24,
    startsAt: '2026-09-12T00:00:00+03:00',
    endsAt: '2026-09-28T00:00:00+03:00',
    label: { en: 'National Day — 24 hours free', ar: 'اليوم الوطني — ٢٤ ساعة مجانًا' },
  },
};

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

export type PlanId = 'day_pass' | 'monthly' | 'test_50sar' | 'test_150sar';

// A time-boxed price. There is no promo code to enter and nothing to opt
// into: while the window is open, every checkout for the plan is charged the
// offer amount, and the moment it closes the list price is back. The client
// is not consulted either way -- it still only names a plan id, and the
// server still decides what that costs (see buildCheckoutConfig).
export interface PlanOffer {
  id: string;
  // Minor currency units (halalas), like PlanDefinition.amount.
  amount: number;
  // ISO 8601 with an explicit offset. Both bounds are written in Riyadh time
  // so the window means what it says in the market it is aimed at, whatever
  // timezone the server itself happens to run in. startsAt is inclusive,
  // endsAt exclusive.
  startsAt: string;
  endsAt: string;
  label: { en: string; ar: string };
}

// Saudi National Day 2026 -- the 96th, which is where 9.60 SAR comes from.
// Ends at midnight Riyadh time on the 28th, so the last checkout at the
// offer price is 23:59:59 on Sunday 27 September 2026.
//
// Nothing has to be done to end it: the window closes on its own and the Day
// Pass is back to 15 SAR. Removing the `offer` line from day_pass below ends
// it early; changing these dates moves it.
export const SND_2026_OFFER: PlanOffer = {
  id: 'snd_2026',
  amount: 960,
  startsAt: '2026-09-12T00:00:00+03:00',
  endsAt: '2026-09-28T00:00:00+03:00',
  label: { en: 'Saudi National Day offer', ar: 'عرض اليوم الوطني السعودي' },
};

export interface PlanDefinition {
  id: PlanId;
  // Minor currency units (halalas) -- the only amount ever sent to Moyasar.
  // The client picks a plan id; it never gets to say how much that plan costs.
  amount: number;
  currency: 'SAR';
  // Whole days of access granted per purchase/renewal.
  durationDays: number;
  recurring: boolean;
  // Whether the plan can be bought right now. A plan that is withdrawn from
  // sale stays defined here rather than being deleted: existing subscribers
  // still renew against it, and past payments still reconcile by looking
  // their plan id up. Only new checkouts are refused.
  purchasable: boolean;
  // An automatic discount attached to this plan, if one is running or due to
  // run. Present does not mean active -- priceFor() checks the window.
  offer?: PlanOffer;
  label: { en: string; ar: string };
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  // Staging-only, for verifying a real live-key charge round-trips end to
  // end without spending a full Day Pass amount. Not on production.
  test_50sar: {
    id: 'test_50sar',
    amount: 5000,
    currency: 'SAR',
    durationDays: 1,
    recurring: false,
    purchasable: true,
    label: { en: 'Test (50 SAR)', ar: 'اختبار (٥٠ ر.س)' },
  },
  // Staging-only, for exercising Apple Pay at the real Monthly amount. Apple
  // Pay is priced separately from test_50sar on purpose: the sheet shows the
  // shopper the amount they are authorising, so testing it at 50 would not
  // rehearse what a Monthly subscriber actually sees.
  test_150sar: {
    id: 'test_150sar',
    amount: 15000,
    currency: 'SAR',
    durationDays: 1,
    recurring: false,
    purchasable: true,
    label: { en: 'Apple Pay test (150 SAR)', ar: 'اختبار Apple Pay (١٥٠ ر.س)' },
  },
  day_pass: {
    id: 'day_pass',
    // The list price. What a checkout is actually charged today comes from
    // priceFor(), which applies the offer below while its window is open.
    amount: 1500,
    currency: 'SAR',
    durationDays: 1,
    recurring: false,
    purchasable: true,
    offer: SND_2026_OFFER,
    label: { en: 'Day Pass', ar: 'تذكرة يومية' },
  },
  monthly: {
    id: 'monthly',
    amount: 15000,
    currency: 'SAR',
    durationDays: 30,
    recurring: true,
    // Withdrawn from sale for now -- see the note on `purchasable` above.
    // Reinstate by flipping this to true; nothing else has to change.
    purchasable: false,
    label: { en: 'Monthly', ar: 'شهري' },
  },
};

export interface PlanPricing {
  // What a checkout started right now is charged, in halalas.
  amount: number;
  // The undiscounted price, so a surface can show what is being saved.
  // Equal to `amount` when no offer is running.
  listAmount: number;
  // The offer being applied right now, or null. An offer whose window has
  // not opened yet, or has closed, is never returned here -- callers can
  // treat a non-null value as "this is live".
  offer: PlanOffer | null;
}

export function isOfferActive(offer: PlanOffer, now: Date = new Date()): boolean {
  const t = now.getTime();
  return t >= Date.parse(offer.startsAt) && t < Date.parse(offer.endsAt);
}

// The one place a price is decided. Everything that charges, quotes or
// displays a plan amount goes through here so the storefront and the charge
// cannot disagree about what today costs.
export function priceFor(plan: PlanDefinition, now: Date = new Date()): PlanPricing {
  const offer = plan.offer && isOfferActive(plan.offer, now) ? plan.offer : null;
  return {
    amount: offer ? offer.amount : plan.amount,
    listAmount: plan.amount,
    offer,
  };
}

export function getPlan(id: string): PlanDefinition | null {
  return id === 'day_pass' || id === 'monthly' || id === 'test_50sar' || id === 'test_150sar'
    ? PLANS[id]
    : null;
}

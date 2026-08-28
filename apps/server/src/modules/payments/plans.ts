export type PlanId = 'day_pass' | 'monthly' | 'test_50sar' | 'test_150sar';

export interface PlanDefinition {
  id: PlanId;
  // Minor currency units (halalas) -- the only amount ever sent to Moyasar.
  // The client picks a plan id; it never gets to say how much that plan costs.
  amount: number;
  currency: 'SAR';
  // Whole days of access granted per purchase/renewal.
  durationDays: number;
  recurring: boolean;
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
    label: { en: 'Apple Pay test (150 SAR)', ar: 'اختبار Apple Pay (١٥٠ ر.س)' },
  },
  day_pass: {
    id: 'day_pass',
    amount: 1500,
    currency: 'SAR',
    durationDays: 1,
    recurring: false,
    label: { en: 'Day Pass', ar: 'تذكرة يومية' },
  },
  monthly: {
    id: 'monthly',
    amount: 15000,
    currency: 'SAR',
    durationDays: 30,
    recurring: true,
    label: { en: 'Monthly', ar: 'شهري' },
  },
};

export function getPlan(id: string): PlanDefinition | null {
  return id === 'day_pass' || id === 'monthly' || id === 'test_50sar' || id === 'test_150sar'
    ? PLANS[id]
    : null;
}

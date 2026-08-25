export type PlanId = 'day_pass' | 'monthly' | 'test_50sar';

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
  return id === 'day_pass' || id === 'monthly' || id === 'test_50sar' ? PLANS[id] : null;
}

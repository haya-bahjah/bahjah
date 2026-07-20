export type PlanId = 'day_pass' | 'monthly';

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
    amount: 25000,
    currency: 'SAR',
    durationDays: 30,
    recurring: true,
    label: { en: 'Monthly', ar: 'شهري' },
  },
};

export function getPlan(id: string): PlanDefinition | null {
  return id === 'day_pass' || id === 'monthly' ? PLANS[id] : null;
}

import { env } from '../../config/env';
import { prisma } from '../../db/prisma';
import { chargeRenewal } from './service';

const SWEEP_INTERVAL_MS = 15 * 60 * 1000;
let timer: NodeJS.Timeout | null = null;

async function sweep(): Promise<void> {
  // No active subscription can exist yet without payments having been
  // configured (checkout itself is blocked until then), but skip early
  // regardless rather than firing an API call per sweep for nothing.
  if (!env.moyasarSecretKey) return;
  const due = await prisma.user.findMany({
    where: {
      subscriptionStatus: 'active',
      cancelAtPeriodEnd: false,
      nextBillingAt: { lte: new Date() },
    },
    select: { id: true, cardToken: true },
  });
  for (const user of due) {
    await chargeRenewal(user).catch((err) => console.error(`renewal sweep failed for user ${user.id}`, err));
  }
}

export function startRenewalScheduler(): void {
  if (timer) return;
  timer = setInterval(() => {
    sweep().catch((err) => console.error('renewal sweep failed', err));
  }, SWEEP_INTERVAL_MS);
  // Also run once shortly after boot rather than waiting a full interval.
  setTimeout(() => sweep().catch((err) => console.error('renewal sweep failed', err)), 30_000);
}

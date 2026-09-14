import { prisma } from '../../db/prisma';
import { computeAccess } from '../payments/access';

// The account list behind the dashboard's headline numbers: who signed up,
// when, and where they stand on access -- so "6 accounts created" can be read
// as six people rather than as a six.
//
// This is the one admin surface that returns personal data, so it is worth
// being explicit about what it does and does not hand over.
//
// Returned: name, email, when they joined, whether they opted into marketing,
// their plan and access state, and counts of what they have played and paid.
// That is the set needed to answer the questions this page exists for -- who
// is signing up, is anyone playing, did the National Day code get used.
//
// Never returned, and not selected from the database at all: passwordHash,
// cardToken, phone, and date of birth. A password hash is not display data
// under any argument; a card token can be charged; and a phone number and a
// birthday are the two fields here most worth stealing and least useful on a
// dashboard. `avatar` is skipped for a duller reason -- it can be a data: URL
// holding a whole photograph, which would make this response enormous.
//
// Guests and practice bots are excluded. A guest is a nickname that joined
// somebody's room for an evening; there is no account, no email, and nothing
// to browse. They are counted separately in the analytics summary.

export interface AdminAccount {
  id: string;
  fullName: string;
  email: string | null;
  createdAt: string;
  marketingOptIn: boolean;
  plan: string;
  subscriptionStatus: string;
  paidUntil: string | null;
  // Access as the product itself computes it (payments/access.ts), rather
  // than re-deriving the trial window here and letting the two drift.
  // 'unlimited' is a staff account, 'trial' the free window every new signup
  // gets, 'paid' a Day Pass / Monthly / promo grant still running.
  access: { state: 'unlimited' | 'paid' | 'trial' | 'none'; until: string | null };
  gamesPlayed: number;
  paymentsMade: number;
  promoCodes: string[];
}

export interface AdminAccountsPage {
  accounts: AdminAccount[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
}

const PAGE_SIZE = 25;
// A search that matched everything would be a full table scan plus a full
// render; a search nobody typed is just the first page.
const MAX_QUERY = 120;

export async function listAccounts(opts: {
  page?: number;
  query?: string;
} = {}): Promise<AdminAccountsPage> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const query = (opts.query ?? '').trim().slice(0, MAX_QUERY);

  // Real accounts only. isGuest covers bots too -- every bot is a guest -- but
  // both are named so the intent survives someone changing that.
  const where = {
    isGuest: false,
    isBot: false,
    ...(query
      ? {
          OR: [
            { email: { contains: query, mode: 'insensitive' as const } },
            { fullName: { contains: query, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        fullName: true,
        email: true,
        createdAt: true,
        marketingOptIn: true,
        plan: true,
        subscriptionStatus: true,
        paidUntil: true,
        // Counts rather than the rows themselves: the page shows "4 games,
        // 1 payment", and pulling every history row for every account to
        // display two numbers would be the slowest thing on the dashboard.
        _count: { select: { gameHistory: true, payments: true } },
        promoRedemptions: { select: { code: true } },
      },
    }),
  ]);

  return {
    accounts: rows.map((u) => {
      // email matters here: computeAccess uses it to spot a staff account,
      // which is the difference between "unlimited" and "their trial ran out
      // in August".
      const access = computeAccess({ email: u.email, createdAt: u.createdAt, paidUntil: u.paidUntil });
      const state = access.isUnlimited
        ? 'unlimited' as const
        : access.paidUntil && access.paidUntil.getTime() > Date.now()
          ? 'paid' as const
          : access.isTrialing
            ? 'trial' as const
            : 'none' as const;
      const until = state === 'paid'
        ? access.paidUntil
        : state === 'trial'
          ? access.trialEndsAt
          : null;
      return {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        createdAt: u.createdAt.toISOString(),
        marketingOptIn: u.marketingOptIn,
        plan: u.plan,
        subscriptionStatus: u.subscriptionStatus,
        paidUntil: u.paidUntil ? u.paidUntil.toISOString() : null,
        access: { state, until: until ? until.toISOString() : null },
        gamesPlayed: u._count.gameHistory,
        paymentsMade: u._count.payments,
        promoCodes: u.promoRedemptions.map((r) => r.code),
      };
    }),
    total,
    page,
    pageSize: PAGE_SIZE,
    query,
  };
}

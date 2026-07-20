import crypto from 'crypto';
import { env } from '../../config/env';

const API_BASE = 'https://api.moyasar.com/v1';

export class MoyasarError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!env.moyasarSecretKey) {
    throw new MoyasarError('Payments are not configured on this server yet.', 503, null);
  }
  const auth = Buffer.from(`${env.moyasarSecretKey}:`).toString('base64');
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${auth}`,
      ...init?.headers,
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new MoyasarError(`Moyasar API error (${res.status})`, res.status, body);
  }
  return body as T;
}

export interface MoyasarPayment {
  id: string;
  status: string; // initiated | paid | failed | authorized | captured | refunded | voided
  amount: number;
  currency: string;
  description: string;
  metadata: Record<string, string> | null;
  source: {
    type: string;
    token?: string;
    company?: string;
    last_four?: string;
  };
}

export function fetchPayment(id: string): Promise<MoyasarPayment> {
  return request<MoyasarPayment>(`/payments/${encodeURIComponent(id)}`);
}

// Charges a previously-saved card token (see save_card on the original
// checkout payment, which returns the reusable token in source.token) --
// used for Monthly auto-renewal, never for a fresh checkout, which always
// goes through the moyasar.js widget in the browser instead.
export function chargeToken(params: {
  amount: number;
  currency: string;
  description: string;
  token: string;
  metadata: Record<string, string>;
}): Promise<MoyasarPayment> {
  return request<MoyasarPayment>('/payments', {
    method: 'POST',
    body: JSON.stringify({
      amount: params.amount,
      currency: params.currency,
      description: params.description,
      source: { type: 'token', token: params.token },
      metadata: params.metadata,
    }),
  });
}

// Moyasar signs webhook bodies with HMAC-SHA256 over the raw request body,
// sent hex-encoded in the x-moyasar-signature header. Comparison is
// timing-safe on purpose -- this gates whether we trust a webhook's claim
// that money actually moved.
export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
  if (!env.moyasarWebhookSecret || !signatureHeader) return false;
  const expected = crypto.createHmac('sha256', env.moyasarWebhookSecret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signatureHeader, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

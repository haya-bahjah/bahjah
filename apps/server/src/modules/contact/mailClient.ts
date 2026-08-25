import { env } from '../../config/env';

// Transactional email via Resend's REST API. Called with plain fetch rather
// than the `resend` SDK for the same reason moyasarClient.ts talks to Moyasar
// directly: it is one POST to one endpoint, and a dependency that only wraps
// that is not worth carrying.
const API_URL = 'https://api.resend.com/emails';

export class MailError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  // The address a human hitting Reply should land on. Kept separate from
  // `from`: Resend will only send as a domain you have verified, so the
  // sender stays ours and the visitor's address rides along here.
  replyTo?: string;
}

export async function sendMail({ to, subject, text, replyTo }: SendMailInput): Promise<void> {
  if (!env.resendApiKey || !env.mailFrom) {
    throw new MailError('Email is not configured on this server yet.', 503, null);
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.resendApiKey}`,
    },
    body: JSON.stringify({
      from: env.mailFrom,
      to: [to],
      subject,
      text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new MailError(`Resend API error (${res.status})`, res.status, body);
  }
}

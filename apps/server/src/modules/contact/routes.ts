import { Router } from 'express';
import { env } from '../../config/env';
import { contactRateLimit } from '../../middleware/rateLimit';
import { MailError, sendMail } from './mailClient';
import { contactSchema, type ContactInput } from './validation';

export const contactRouter = Router();

const SUBJECT_LABELS: Record<ContactInput['subject'], string> = {
  general: 'General question',
  billing: 'Billing & subscriptions',
  bug: 'Report a problem',
  partnership: 'Partnership / press',
};

// The visitor's own words go in the body, never in the headers -- a name or
// subject carrying a newline could otherwise inject extra headers into the
// outgoing mail. Collapsing them here keeps the subject line one line.
function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function buildBody(input: ContactInput): string {
  return [
    `From:    ${input.name} <${input.email}>`,
    `Subject: ${SUBJECT_LABELS[input.subject]}`,
    `Sent:    ${new Date().toISOString()}`,
    '',
    '---',
    '',
    input.message,
    '',
    '---',
    'Sent from the contact form on bahjah.com. Reply straight to this email to answer.',
  ].join('\n');
}

contactRouter.post('/', contactRateLimit, async (req, res, next) => {
  const parsed = contactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message ?? 'Invalid input.' },
    });
    return;
  }

  const input = parsed.data;

  // A bot tripped the honeypot. Answer exactly as we would a real send, so it
  // gets no signal about why nothing happened, and drop the message.
  if (input.company) {
    res.status(202).json({ ok: true });
    return;
  }

  try {
    await sendMail({
      to: env.contactInbox,
      replyTo: input.email,
      subject: `[Bahjah] ${SUBJECT_LABELS[input.subject]} — ${oneLine(input.name)}`,
      text: buildBody(input),
    });
    res.status(202).json({ ok: true });
  } catch (err) {
    if (err instanceof MailError) {
      // Log the provider's own reason; the visitor only ever sees that it
      // did not send, since the detail is ours to act on, not theirs.
      console.error('[contact] send failed', err.status, err.body);
      res.status(502).json({
        error: { code: 'SEND_FAILED', message: "We couldn't send your message just now — please email contact@bahjah.com instead." },
      });
      return;
    }
    next(err);
  }
});

import { z } from 'zod';

// Mirrors the four fields on contact.html's form. The subject enum matches
// that <select>'s option values -- an unknown value is rejected rather than
// passed through into the email subject line.
export const contactSchema = z.object({
  name: z.string().trim().min(1, 'Please enter your name.').max(120),
  email: z.string().trim().email('Please enter a valid email address.').max(254),
  subject: z.enum(['general', 'billing', 'bug', 'partnership']).default('general'),
  message: z.string().trim().min(1, 'Please enter a message.').max(5000),
  // Honeypot: a field no human ever sees, so anything filling it in is a bot.
  // Deliberately accepts any string rather than enforcing empty here -- a
  // schema rejection would answer with a 400 naming the offending field,
  // which tells a bot exactly what tripped it. The route checks it instead
  // and answers as though the send succeeded.
  company: z.string().max(200).optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;

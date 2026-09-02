import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  databaseUrl: required('DATABASE_URL'),
  redisUrl: required('REDIS_URL'),
  jwtSecret: required('JWT_SECRET'),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  // None of the three Moyasar vars are required at boot -- a deploy with
  // payments not yet configured should serve every other route normally
  // rather than crash-loop the whole app. payments/service.ts and
  // moyasarClient.ts reject with a clear "not configured" error the moment
  // something actually tries to use whichever one is missing.
  moyasarSecretKey: process.env.MOYASAR_SECRET_KEY || null,
  moyasarPublishableKey: process.env.MOYASAR_PUBLISHABLE_KEY || null,
  moyasarWebhookSecret: process.env.MOYASAR_WEBHOOK_SECRET || null,
  // Contact-form email, optional at boot for the same reason as the Moyasar
  // keys: a deploy without it should serve the whole site normally and only
  // fail when someone actually submits the form. mailFrom must be an address
  // on a domain verified with Resend, or the API rejects the send.
  resendApiKey: process.env.RESEND_API_KEY || null,
  mailFrom: process.env.MAIL_FROM || null,
  contactInbox: process.env.CONTACT_INBOX || 'contact@bahjah.com',
  // Who may open the admin pages, as a comma-separated list of account
  // emails. Access is per-account, not per-link: an admin signs in normally
  // and the routes check their email against this list, so the credential is
  // the account's own password, not a URL that leaks through history or a
  // forwarded message.
  //
  // The Bahjah admin account is the default so the pages work on a fresh
  // deploy without a secrets change -- naming it here is safe because the
  // string is not the credential; signing in as it is. ADMIN_EMAILS
  // *replaces* this rather than adding to it, so an environment that sets it
  // has to name every admin. Set it to a single space to lock the pages for
  // everyone.
  adminEmails: (process.env.ADMIN_EMAILS || 'develop@bahjah.com')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
};

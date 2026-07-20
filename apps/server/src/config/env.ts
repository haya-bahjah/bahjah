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
};

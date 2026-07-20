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
  moyasarSecretKey: required('MOYASAR_SECRET_KEY'),
  moyasarPublishableKey: required('MOYASAR_PUBLISHABLE_KEY'),
  // Not required at boot: the webhook can't be registered with Moyasar until
  // the server is deployed and reachable, so this stays unset in local dev.
  // payments/service.ts throws if a webhook actually arrives without it set.
  moyasarWebhookSecret: process.env.MOYASAR_WEBHOOK_SECRET || null,
};

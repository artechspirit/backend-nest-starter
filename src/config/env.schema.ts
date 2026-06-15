import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'staging', 'production'])
      .default('development'),

    APP_NAME: z.string().min(1).default('Backend Starterkit'),
    APP_PORT: z.coerce.number().int().positive().default(4000),
    APP_PREFIX: z.string().min(1).default('api/v1'),
    APP_URL: z.string().url(),
    WEB_URL: z.string().url(),

    DATABASE_URL: z.string().min(1),

    JWT_ACCESS_SECRET: z.string().min(16),
    JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),

    JWT_REFRESH_SECRET: z.string().min(16),
    JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(7),

    COOKIE_DOMAIN: z.string().default('localhost'),
    COOKIE_SECURE: z.coerce.boolean().default(false),

    // Redis configurations
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().int().positive().default(6379),
    REDIS_PASSWORD: z.string().optional(),

    // S3 / Object Storage configurations
    S3_ENDPOINT: z.preprocess(
      (val) => (val === '' ? undefined : val),
      z.string().url().optional(),
    ),
    S3_ACCESS_KEY_ID: z.string().min(1),
    S3_SECRET_ACCESS_KEY: z.string().min(1),
    S3_BUCKET_NAME: z.string().min(1),
    S3_REGION: z.string().default('us-east-1'),
    S3_PUBLIC_URL: z.preprocess(
      (val) => (val === '' ? undefined : val),
      z.string().url().optional(),
    ),

    // Mailer / SMTP configurations
    MAIL_HOST: z.string().default('localhost'),
    MAIL_PORT: z.coerce.number().int().positive().default(1025),
    MAIL_USER: z.preprocess(
      (val) => (val === '' ? undefined : val),
      z.string().optional(),
    ),
    MAIL_PASSWORD: z.preprocess(
      (val) => (val === '' ? undefined : val),
      z.string().optional(),
    ),
    MAIL_FROM: z.string().default('Backend Starterkit <noreply@example.com>'),

    // Google OAuth
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CALLBACK_URL: z.string().optional(),

    // GitHub OAuth
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    GITHUB_CALLBACK_URL: z.string().optional(),

    // Stripe
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),

    // Midtrans
    MIDTRANS_SERVER_KEY: z.string().optional(),
    MIDTRANS_CLIENT_KEY: z.string().optional(),
    MIDTRANS_IS_PRODUCTION: z.coerce.boolean().default(false),

    // FCM (Firebase Cloud Messaging)
    FCM_PROJECT_ID: z.string().optional(),
    FCM_PRIVATE_KEY: z.string().optional(),
    FCM_CLIENT_EMAIL: z.string().optional(),
  })
  .passthrough();

export type Env = z.infer<typeof envSchema>;

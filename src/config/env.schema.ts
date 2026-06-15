import { z } from 'zod';

export const envSchema = z.object({
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
});

export type Env = z.infer<typeof envSchema>;

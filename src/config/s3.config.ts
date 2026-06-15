import { registerAs } from '@nestjs/config';

export const s3Config = registerAs('s3', () => ({
  endpoint: process.env.S3_ENDPOINT || undefined,
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  bucketName: process.env.S3_BUCKET_NAME,
  region: process.env.S3_REGION ?? 'us-east-1',
  publicUrl: process.env.S3_PUBLIC_URL || undefined,
}));

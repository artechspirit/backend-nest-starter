import { registerAs } from '@nestjs/config';

export const fcmConfig = registerAs('fcm', () => ({
  projectId: process.env.FCM_PROJECT_ID,
  privateKey: process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FCM_CLIENT_EMAIL,
}));

import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV,
  name: process.env.APP_NAME,
  port: Number(process.env.APP_PORT),
  prefix: process.env.APP_PREFIX,
  appUrl: process.env.APP_URL,
  webUrl: process.env.WEB_URL,
}));

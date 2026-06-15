import { registerAs } from '@nestjs/config';

export const cookieConfig = registerAs('cookie', () => ({
  domain: process.env.COOKIE_DOMAIN,
  secure: process.env.COOKIE_SECURE === 'true',
}));

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    const clientID = configService.get<string>('oauth.google.clientId') || 'dummy-client-id';
    const clientSecret = configService.get<string>('oauth.google.clientSecret') || 'dummy-client-secret';
    const callbackURL = configService.get<string>('oauth.google.callbackUrl') || 'http://localhost:4000/api/v1/auth/oauth/google/callback';

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, photos, id } = profile;
    const user = {
      provider: 'google',
      providerId: id,
      email: emails?.[0]?.value,
      name: name ? `${name.givenName || ''} ${name.familyName || ''}`.trim() : emails?.[0]?.value?.split('@')[0],
      avatarUrl: photos?.[0]?.value,
    };
    done(null, user);
  }
}

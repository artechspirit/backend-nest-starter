import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(configService: ConfigService) {
    const clientID =
      configService.get<string>('oauth.github.clientId') || 'dummy-client-id';
    const clientSecret =
      configService.get<string>('oauth.github.clientSecret') ||
      'dummy-client-secret';
    const callbackURL =
      configService.get<string>('oauth.github.callbackUrl') ||
      'http://localhost:4000/api/v1/auth/oauth/github/callback';

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: (err: any, user: any) => void,
  ): Promise<any> {
    const { displayName, username, emails, photos, id } = profile;
    const user = {
      provider: 'github',
      providerId: id,
      email: emails?.[0]?.value || `${username}@users.noreply.github.com`,
      name: displayName || username,
      avatarUrl: photos?.[0]?.value,
    };
    done(null, user);
  }
}

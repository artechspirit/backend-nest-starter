import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../database/prisma.service';
import { JwtPayload } from '../types/jwt-payload.type';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as cacheManager from 'cache-manager';
import { CacheKeys } from '../../../cache/cache.keys';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheService: cacheManager.Cache,
  ) {
    const secret = configService.get<string>('jwt.accessSecret');

    if (!secret) {
      throw new Error('JWT access secret is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: Request) => {
          const req = request as unknown as {
            cookies?: Record<string, string>;
          };
          return req.cookies?.access_token ?? null;
        },
      ]),
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<{
    id: string;
    email: string;
    name: string | null;
    sessionId: string;
  }> {
    const cacheKey = CacheKeys.sessionUser(payload.sessionId);
    const cachedUser = await this.cacheService.get<{
      id: string;
      email: string;
      name: string | null;
      sessionId: string;
    }>(cacheKey);

    if (cachedUser) {
      return cachedUser;
    }

    const session = await this.prisma.session.findFirst({
      where: {
        id: payload.sessionId,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    });

    if (!session || !session.user || session.user.deletedAt) {
      throw new UnauthorizedException('Invalid session');
    }

    if (session.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User is not active');
    }

    const userPayload = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      sessionId: session.id,
    };

    // Cache session user details for 5 minutes (300 seconds)
    await this.cacheService.set(cacheKey, userPayload, 300);

    return userPayload;
  }
}

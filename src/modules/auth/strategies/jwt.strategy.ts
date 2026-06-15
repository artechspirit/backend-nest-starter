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
      // Dual-extraction method to maximize usability:
      // 1. Attempts to extract bearer token from standard Authorization header (great for API testing / Mobile clients)
      // 2. Falls back to extracting from 'access_token' cookie (HttpOnly cookie flow, ideal for secure SPA clients)
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

  /**
   * The validate() method is executed automatically after Passport verifies the JWT signature.
   * Whatever object this returns is attached to the Express request object as `req.user`.
   */
  async validate(payload: JwtPayload): Promise<{
    id: string;
    email: string;
    name: string | null;
    sessionId: string;
  }> {
    // 1. Try to fetch the session from Redis cache to avoid heavy DB roundtrips on every request.
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

    // 2. Cache miss: Verify the session status in PostgreSQL.
    // Check if the session is revoked, expired, or belongs to another user.
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

    // 3. Block access if session/user is invalid or user was soft-deleted
    if (!session || !session.user || session.user.deletedAt) {
      throw new UnauthorizedException('Invalid session');
    }

    // 4. Ensure the user's status is still ACTIVE
    if (session.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User is not active');
    }

    const userPayload = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      sessionId: session.id,
    };

    // 5. Cache the verified session payload for 5 minutes (300 seconds) for subsequent requests
    await this.cacheService.set(cacheKey, userPayload, 300);

    return userPayload;
  }
}

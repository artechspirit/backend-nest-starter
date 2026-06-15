import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class QueuesAuthMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const cookies = req.cookies as Record<string, string> | undefined;
      const accessToken =
        cookies?.access_token ||
        req.headers.authorization?.replace('Bearer ', '');

      if (!accessToken) {
        res.status(401).send('Unauthorized: Authentication token required');
        return;
      }

      const secret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
      const verified = (await this.jwtService.verifyAsync(accessToken, {
        secret,
      })) as unknown;
      const payload = verified as { sub: string };

      const userWithRoles = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      });

      if (!userWithRoles || userWithRoles.deletedAt) {
        res.status(401).send('Unauthorized: Invalid user');
        return;
      }

      const isSuperAdmin = userWithRoles.userRoles.some(
        (ur) => ur.role.name === 'super_admin',
      );

      if (!isSuperAdmin) {
        res
          .status(403)
          .send('Forbidden: Access denied. Super Admin role required.');
        return;
      }

      next();
    } catch (error) {
      console.error('Queues Auth Middleware Error:', error);
      res.status(401).send('Unauthorized: Please login as super_admin.');
    }
  }
}

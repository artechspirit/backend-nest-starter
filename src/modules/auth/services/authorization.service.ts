import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as cacheManager from 'cache-manager';
import { PrismaService } from '../../../database/prisma.service';
import { CacheKeys } from '../../../cache/cache.keys';

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheService: cacheManager.Cache,
  ) {}

  async getUserPermissions(userId: string) {
    const cacheKey = CacheKeys.userPermissions(userId);

    const cached = await this.cacheService.get<string[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const permissions = userRoles.flatMap((userRole) =>
      userRole.role.rolePermissions.map(
        (rolePermission) => rolePermission.permission.name,
      ),
    );

    const uniquePermissions = [...new Set(permissions)];

    await this.cacheService.set(cacheKey, uniquePermissions, 3600);

    return uniquePermissions;
  }

  async invalidateUserPermissions(userId: string) {
    await this.cacheService.del(CacheKeys.userPermissions(userId));
  }
}

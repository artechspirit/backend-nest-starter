import {
  BadRequestException,
  Injectable,
  Inject,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { buildPaginationMeta } from '../../common/utils/pagination.util';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as cacheManager from 'cache-manager';
import { CacheKeys } from '../../cache/cache.keys';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheService: cacheManager.Cache,
  ) {}

  async getProfile(userId: string) {
    const user = await this.findActiveUserById(userId);
    return this.sanitizeUser(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.findActiveUserById(userId);

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        name: dto.name?.trim(),
        avatarUrl: dto.avatarUrl,
      },
    });

    return this.sanitizeUser(updatedUser);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.findActiveUserById(userId);

    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      dto.currentPassword,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const newPasswordHash = await argon2.hash(dto.newPassword);

    // Query active sessions before revoking them
    const activeSessions = await this.prisma.session.findMany({
      where: {
        userId: user.id,
        revokedAt: null,
      },
      select: {
        id: true,
      },
    });
    const sessionIds = activeSessions.map((s) => s.id);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newPasswordHash,
        },
      }),
      this.prisma.session.updateMany({
        where: {
          userId: user.id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
    ]);

    // Clear active sessions from cache
    await Promise.all(
      sessionIds.map((sessionId) =>
        this.cacheService.del(CacheKeys.sessionUser(sessionId)),
      ),
    );

    return null;
  }

  async listUsers(dto: ListUsersDto) {
    const where = {
      deletedAt: null,
      ...(dto.status ? { status: dto.status } : {}),
      ...(dto.search
        ? {
            OR: [
              {
                name: {
                  contains: dto.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                email: {
                  contains: dto.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const allowedSortFields = [
      'createdAt',
      'updatedAt',
      'email',
      'name',
      'status',
    ];
    const sortField =
      dto.sort && allowedSortFields.includes(dto.sort) ? dto.sort : 'createdAt';

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: dto.skip,
        take: dto.limit,
        orderBy: {
          [sortField]: dto.order,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((user) => this.sanitizeUser(user)),
      meta: buildPaginationMeta({
        page: dto.page,
        limit: dto.limit,
        total,
      }),
    };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.sanitizeUser(user);
  }

  async updateUserStatus(id: string, status: UserStatus) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const sessionIds: string[] = [];
    if (status !== 'ACTIVE') {
      const activeSessions = await this.prisma.session.findMany({
        where: {
          userId: id,
          revokedAt: null,
        },
        select: {
          id: true,
        },
      });
      sessionIds.push(...activeSessions.map((s) => s.id));
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { status },
    });

    if (status !== 'ACTIVE') {
      await this.prisma.session.updateMany({
        where: {
          userId: id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      await Promise.all([
        ...sessionIds.map((sessionId) =>
          this.cacheService.del(CacheKeys.sessionUser(sessionId)),
        ),
        this.cacheService.del(CacheKeys.userPermissions(id)),
      ]);
    }

    return this.sanitizeUser(updatedUser);
  }

  async softDeleteUser(id: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const activeSessions = await this.prisma.session.findMany({
      where: {
        userId: id,
        revokedAt: null,
      },
      select: {
        id: true,
      },
    });
    const sessionIds = activeSessions.map((s) => s.id);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: {
          status: 'DELETED',
          deletedAt: new Date(),
        },
      }),
      this.prisma.session.updateMany({
        where: {
          userId: id,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      }),
    ]);

    await Promise.all([
      ...sessionIds.map((sessionId) =>
        this.cacheService.del(CacheKeys.sessionUser(sessionId)),
      ),
      this.cacheService.del(CacheKeys.userPermissions(id)),
    ]);

    return null;
  }

  private async findActiveUserById(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User is not active');
    }

    return user;
  }

  private sanitizeUser<T extends { passwordHash?: string }>(user: T) {
    const safeUser = { ...user };
    delete safeUser.passwordHash;
    return safeUser;
  }
}

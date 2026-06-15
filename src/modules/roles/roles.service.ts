import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AuthorizationService } from '../auth/services/authorization.service';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  async findAll() {
    return this.prisma.role.findMany({
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findById(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  async create(dto: CreateRoleDto) {
    const name = dto.name.trim();

    const existingRole = await this.prisma.role.findUnique({
      where: { name },
    });

    if (existingRole) {
      throw new ConflictException('Role already exists');
    }

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          name,
          description: dto.description,
        },
      });

      if (dto.permissionIds?.length) {
        await tx.rolePermission.createMany({
          data: dto.permissionIds.map((permissionId) => ({
            roleId: role.id,
            permissionId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.role.findUniqueOrThrow({
        where: { id: role.id },
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      });
    });
  }

  async update(id: string, dto: UpdateRoleDto) {
    await this.findById(id);

    // Get user IDs with this role BEFORE updating/deleting permissions
    const userRoles = await this.prisma.userRole.findMany({
      where: { roleId: id },
      select: { userId: true },
    });
    const userIds = userRoles.map((ur) => ur.userId);

    const updatedRole = await this.prisma.$transaction(async (tx) => {
      const role = await tx.role.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          description: dto.description,
        },
      });

      if (dto.permissionIds) {
        await tx.rolePermission.deleteMany({
          where: { roleId: id },
        });

        await tx.rolePermission.createMany({
          data: dto.permissionIds.map((permissionId) => ({
            roleId: id,
            permissionId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.role.findUniqueOrThrow({
        where: { id: role.id },
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      });
    });

    // Invalidate user permissions cache for affected users
    await Promise.all(
      userIds.map((userId) =>
        this.authorizationService.invalidateUserPermissions(userId),
      ),
    );

    return updatedRole;
  }

  async delete(id: string) {
    const role = await this.findById(id);

    if (['super_admin', 'admin', 'user'].includes(role.name)) {
      throw new ConflictException('Default role cannot be deleted');
    }

    // Get user IDs with this role BEFORE deleting the role
    const userRoles = await this.prisma.userRole.findMany({
      where: { roleId: id },
      select: { userId: true },
    });
    const userIds = userRoles.map((ur) => ur.userId);

    await this.prisma.role.delete({
      where: { id },
    });

    // Invalidate user permissions cache for affected users
    await Promise.all(
      userIds.map((userId) =>
        this.authorizationService.invalidateUserPermissions(userId),
      ),
    );

    return null;
  }
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const basePermissions = [
  'users.read',
  'users.create',
  'users.update',
  'users.delete',

  'roles.read',
  'roles.create',
  'roles.update',
  'roles.delete',

  'permissions.read',
  'permissions.create',
  'permissions.update',
  'permissions.delete',

  'audit_logs.read',
];

const roles = [
  {
    name: 'super_admin',
    description: 'Full access to all system features',
    permissions: basePermissions,
  },
  {
    name: 'admin',
    description: 'Admin access',
    permissions: [
      'users.read',
      'users.create',
      'users.update',
      'roles.read',
      'permissions.read',
      'audit_logs.read',
    ],
  },
  {
    name: 'user',
    description: 'Regular user',
    permissions: [
      'users.read',
    ],
  },
];

async function main() {
  // 1. Seed Permissions
  for (const permissionName of basePermissions) {
    await prisma.permission.upsert({
      where: { name: permissionName },
      update: {},
      create: {
        name: permissionName,
        description: permissionName,
      },
    });
  }

  // 2. Seed Roles and Associate Permissions
  for (const role of roles) {
    const createdRole = await prisma.role.upsert({
      where: { name: role.name },
      update: {
        description: role.description,
      },
      create: {
        name: role.name,
        description: role.description,
      },
    });

    for (const permissionName of role.permissions) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { name: permissionName },
      });

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: createdRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: createdRole.id,
          permissionId: permission.id,
        },
      });
    }
  }

  console.log('Seed completed successfully');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../database/prisma.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as argon2 from 'argon2';

jest.mock('argon2');

describe('UsersService', () => {
  let service: UsersService;
  let prismaService: {
    user: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
    session: {
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let cacheService: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  };

  const mockUser = {
    id: 'user-id-123',
    name: 'Test User',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    status: 'ACTIVE',
    deletedAt: null,
  };

  beforeEach(async () => {
    prismaService = {
      user: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      session: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest
        .fn()
        .mockImplementation(
          (callback: ((tx: unknown) => unknown) | Promise<unknown>[]) => {
            if (Array.isArray(callback)) {
              return Promise.all(callback);
            }
            return callback(prismaService);
          },
        ),
    };

    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prismaService },
        { provide: CACHE_MANAGER, useValue: cacheService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('should successfully return profile info without passwordHash', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.getProfile('user-id-123');

      expect(result).toBeDefined();
      expect(result.id).toBe(mockUser.id);
      expect(result.passwordHash).toBeUndefined();
    });
  });

  describe('changePassword', () => {
    it('should change user password and revoke all active sessions', async () => {
      prismaService.user.findFirst.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);
      (argon2.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      prismaService.session.findMany.mockResolvedValue([
        { id: 'sess-1' },
        { id: 'sess-2' },
      ]);
      prismaService.user.update.mockResolvedValue(mockUser);
      prismaService.session.updateMany.mockResolvedValue({ count: 2 });

      const dto = {
        currentPassword: 'password123',
        newPassword: 'newpassword123',
      };

      await service.changePassword('user-id-123', dto);

      expect(prismaService.user.update).toHaveBeenCalled();
      expect(prismaService.session.updateMany).toHaveBeenCalled();
      expect(cacheService.del).toHaveBeenCalledTimes(2); // Invalidation of 2 sessions
    });
  });
});

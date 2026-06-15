import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { MailService } from '../mail/mail.service';
import * as argon2 from 'argon2';

jest.mock('argon2');

describe('AuthService', () => {
  let service: AuthService;
  let prismaService: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    role: {
      findUnique: jest.Mock;
    };
    userRole: {
      create: jest.Mock;
    };
    session: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let jwtService: {
    signAsync: jest.Mock;
  };
  let configService: {
    get: jest.Mock;
    getOrThrow: jest.Mock;
  };
  let cacheService: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  };
  let mailService: {
    queueMail: jest.Mock;
  };

  const mockUser = {
    id: 'user-id-123',
    name: 'Test User',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    status: 'ACTIVE',
    deletedAt: null,
  };

  const mockSession = {
    id: 'session-id-123',
    userId: 'user-id-123',
    refreshTokenHash: 'hashed-token',
    userAgent: 'test-agent',
    ipAddress: '127.0.0.1',
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    revokedAt: null,
  };

  beforeEach(async () => {
    prismaService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      role: {
        findUnique: jest.fn(),
      },
      userRole: {
        create: jest.fn(),
      },
      session: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest
        .fn()
        .mockImplementation((callback: (tx: unknown) => unknown) => {
          return callback(prismaService);
        }),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('access-token-123'),
    };

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'jwt.refreshExpiresInDays') return 7;
        if (key === 'jwt.accessExpiresIn') return '15m';
        return null;
      }),
      getOrThrow: jest.fn().mockReturnValue('jwt-secret-123'),
    };

    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    mailService = {
      queueMail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prismaService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: CACHE_MANAGER, useValue: cacheService },
        { provide: MailService, useValue: mailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);
      prismaService.user.create.mockResolvedValue(mockUser);
      prismaService.role.findUnique.mockResolvedValue({ id: 'role-id' });
      (argon2.hash as jest.Mock).mockResolvedValue('hashed-password');

      const dto = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      };

      const result = await service.register(dto);

      expect(result).toBeDefined();
      expect(result.message).toContain('Please check your email');
      expect(result.user.email).toBe(dto.email);
      expect(result.user.passwordHash).toBeUndefined();
    });
  });

  describe('login', () => {
    it('should successfully login a user', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.session.create.mockResolvedValue(mockSession);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const dto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const result = await service.login(dto, {
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      });

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('access-token-123');
      expect(result.refreshToken).toBeDefined();
    });
  });
});

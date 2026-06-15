import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { FeatureFlagGuard } from './feature-flag.guard';

describe('FeatureFlagGuard', () => {
  let guard: FeatureFlagGuard;
  let reflector: Reflector;
  let configService: ConfigService;
  let cacheService: any;

  const mockCacheService = {
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagGuard,
        { provide: Reflector, useValue: mockReflector },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CACHE_MANAGER, useValue: mockCacheService },
      ],
    }).compile();

    guard = module.get<FeatureFlagGuard>(FeatureFlagGuard);
    reflector = module.get<Reflector>(Reflector);
    configService = module.get<ConfigService>(ConfigService);
    cacheService = module.get(CACHE_MANAGER);

    jest.clearAllMocks();
  });

  const createMockContext = (handler: any, classRef: any): ExecutionContext => {
    return {
      getHandler: () => handler,
      getClass: () => classRef,
    } as unknown as ExecutionContext;
  };

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access if no feature flag is defined', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(undefined);
    const context = createMockContext({}, {});

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  describe('Redis cache checks (dynamic)', () => {
    it('should allow access if flag is enabled in cache', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('billing');
      mockCacheService.get.mockResolvedValue(true);
      const context = createMockContext({}, {});

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(mockCacheService.get).toHaveBeenCalledWith('feature_flag:billing');
    });

    it('should block access if flag is disabled in cache', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('billing');
      mockCacheService.get.mockResolvedValue(false);
      const context = createMockContext({}, {});

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should coerce string "true" in cache to boolean true', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('billing');
      mockCacheService.get.mockResolvedValue('true');
      const context = createMockContext({}, {});

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should coerce string "false" in cache to boolean false and block', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('billing');
      mockCacheService.get.mockResolvedValue('false');
      const context = createMockContext({}, {});

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('ConfigService checks (static fallback)', () => {
    it('should fallback to config if cache returns null/undefined', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('billing');
      mockCacheService.get.mockResolvedValue(null);
      mockConfigService.get.mockReturnValue('true');
      const context = createMockContext({}, {});

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(mockConfigService.get).toHaveBeenCalledWith('FEATURE_BILLING');
    });

    it('should block if fallback config is disabled', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('billing');
      mockCacheService.get.mockResolvedValue(undefined);
      mockConfigService.get.mockReturnValue('false');
      const context = createMockContext({}, {});

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should default to true if not defined in cache or config', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('billing');
      mockCacheService.get.mockResolvedValue(undefined);
      mockConfigService.get.mockReturnValue(undefined);
      const context = createMockContext({}, {});

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  describe('Graceful degradation on Redis errors', () => {
    it('should log warning and fallback to config if Redis get throws an error', async () => {
      mockReflector.getAllAndOverride.mockReturnValue('billing');
      mockCacheService.get.mockRejectedValue(new Error('Redis connection lost'));
      mockConfigService.get.mockReturnValue('true');
      const context = createMockContext({}, {});

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(mockConfigService.get).toHaveBeenCalledWith('FEATURE_BILLING');
    });
  });
});

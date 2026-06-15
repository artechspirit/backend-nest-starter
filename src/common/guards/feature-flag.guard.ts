import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { FEATURE_FLAG_KEY } from '../decorators/feature-flag.decorator';

@Injectable()
export class FeatureFlagGuard implements CanActivate {
  private readonly logger = new Logger(FeatureFlagGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheService: Cache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<string>(FEATURE_FLAG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!feature) {
      return true;
    }

    let isEnabled = true;
    let isEvaluated = false;

    // 1. Check Redis cache first (dynamic override)
    const cacheKey = `feature_flag:${feature}`;
    try {
      const cachedValue = await this.cacheService.get<string | number | boolean>(cacheKey);
      if (cachedValue !== undefined && cachedValue !== null) {
        isEnabled = this.coerceBoolean(cachedValue);
        isEvaluated = true;
      }
    } catch (err: any) {
      // Graceful degradation: Log Redis errors and skip to config fallback
      this.logger.warn(
        `Failed to retrieve feature flag '${feature}' from cache. Falling back to environment variables. Error: ${err.message}`,
      );
    }

    // 2. Fallback to ConfigService (static env variable)
    if (!isEvaluated) {
      const envKey = `FEATURE_${feature.toUpperCase()}`;
      const envValue = this.configService.get<string | number | boolean>(envKey);

      if (envValue !== undefined && envValue !== null) {
        isEnabled = this.coerceBoolean(envValue);
      } else {
        // Default to true if not defined anywhere
        isEnabled = true;
      }
    }

    if (!isEnabled) {
      throw new ForbiddenException(`Feature '${feature}' is currently disabled.`);
    }

    return true;
  }

  /**
   * Helper to coerce loose value types (strings, numbers) into a boolean.
   */
  private coerceBoolean(value: any): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    const strValue = String(value).toLowerCase().trim();
    return strValue === 'true' || strValue === '1';
  }
}

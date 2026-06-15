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
    // 1. Resolve feature flag key metadata set by the @FeatureFlag decorator
    const feature = this.reflector.getAllAndOverride<string>(FEATURE_FLAG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no flag decorator is present, the route is public/always-enabled
    if (!feature) {
      return true;
    }

    let isEnabled = true;
    let isEvaluated = false;

    // 2. CHECK REDIS FIRST (Dynamic Runtime Toggles)
    // Keys in Redis are stored under "feature_flag:<flag_name>" (e.g., "feature_flag:billing").
    // This allows administrators/ops to override flags in real-time without redeploying code.
    const cacheKey = `feature_flag:${feature}`;
    try {
      const cachedValue = await this.cacheService.get<
        string | number | boolean
      >(cacheKey);
      if (cachedValue !== undefined && cachedValue !== null) {
        isEnabled = this.coerceBoolean(cachedValue);
        isEvaluated = true;
      }
    } catch (err: unknown) {
      // RESILIENCE & GRACEFUL DEGRADATION:
      // If Redis goes down, we must NOT throw a 500 error for all feature-flagged routes.
      // Instead, log a warning and fallback gracefully to static environment variables.
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to retrieve feature flag '${feature}' from cache. Falling back to environment variables. Error: ${errorMessage}`,
      );
    }

    // 3. FALLBACK TO STATIC ENVIRONMENT (ConfigService / .env)
    // If there is no cache override or the cache is unavailable, check env configurations.
    // Toggles are mapped to "FEATURE_<UPPERCASE_NAME>" (e.g. FEATURE_BILLING).
    if (!isEvaluated) {
      const envKey = `FEATURE_${feature.toUpperCase()}`;
      const envValue = this.configService.get<string | number | boolean>(
        envKey,
      );

      if (envValue !== undefined && envValue !== null) {
        isEnabled = this.coerceBoolean(envValue);
      } else {
        // DEFAULT STATE: If the flag is not configured anywhere, default to ENABLED (true).
        // This avoids forcing developers to seed configurations when deploying new endpoints.
        isEnabled = true;
      }
    }

    // Block access with a 403 Forbidden exception if the feature is disabled
    if (!isEnabled) {
      throw new ForbiddenException(
        `Feature '${feature}' is currently disabled.`,
      );
    }

    return true;
  }

  /**
   * Helper to coerce loose value types (strings, numbers, booleans) into a boolean.
   * This is critical because environment files load all parameters as strings ("true"/"false"),
   * whereas cache engines or JSON requests might send numbers (1/0) or actual booleans.
   */
  private coerceBoolean(value: any): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    const strValue = String(value).toLowerCase().trim();
    return strValue === 'true' || strValue === '1';
  }
}

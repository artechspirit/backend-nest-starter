import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiKeyService } from '../api-key.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as cacheManager from 'cache-manager';
import { createHash } from 'crypto';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    @Inject(CACHE_MANAGER) private readonly cacheService: cacheManager.Cache,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKeyHeader = request.headers['x-api-key'] as string | undefined;

    if (!apiKeyHeader) {
      throw new UnauthorizedException('API Key is missing');
    }

    // 1. Validate the key hash and retrieve user mapping
    const keyData = await this.apiKeyService.validateKey(apiKeyHeader);

    if (!keyData) {
      throw new UnauthorizedException('Invalid or expired API Key');
    }

    // 2. Perform Redis-based Rate Limiting per API Key
    const keyHash = createHash('sha256').update(apiKeyHeader).digest('hex');
    const currentMinute = Math.floor(Date.now() / 60000); // 1 minute window
    const rateLimitKey = `api_key_limit:${keyHash}:${currentMinute}`;

    const requestsCount = (await this.cacheService.get<number>(rateLimitKey)) ?? 0;

    if (requestsCount >= keyData.rateLimit) {
      throw new HttpException(
        'Rate limit exceeded. Too many requests on this API key.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Increment request count in Redis (60 seconds expiration TTL)
    await this.cacheService.set(rateLimitKey, requestsCount + 1, 60);

    // 3. Attach metadata to the request
    request.user = {
      id: keyData.userId,
      email: keyData.user.email,
      name: keyData.user.name,
      isApiKey: true,
      scopes: keyData.scopes,
    };

    return true;
  }
}

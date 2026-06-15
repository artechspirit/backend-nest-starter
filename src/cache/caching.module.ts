import { CacheModule } from '@nestjs/cache-manager';
import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('app.nodeEnv');

        if (nodeEnv === 'test') {
          // Use in-memory store during testing to avoid ECONNREFUSED
          return {
            ttl: 5 * 60 * 1000,
          };
        }

        const host = configService.get<string>('redis.host') ?? 'localhost';
        const port = configService.get<number>('redis.port') ?? 6379;
        const password = configService.get<string>('redis.password');

        return {
          store: await redisStore({
            socket: {
              host,
              port,
            },
            password,
            ttl: 5 * 60 * 1000, // 5 minutes default TTL
          }),
        };
      },
    }),
  ],
  exports: [CacheModule],
})
export class CachingModule {}

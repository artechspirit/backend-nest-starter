import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { RequestIdMiddleware } from './common/middlewares/request-id.middleware';
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { envSchema } from './config/env.schema';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { HealthModule } from './health/health.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { RolesModule } from './modules/roles/roles.module';
import { cookieConfig } from './config/cookie.config';
import { jwtConfig } from './config/jwt.config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { redisConfig } from './config/redis.config';
import { s3Config } from './config/s3.config';
import { mailConfig } from './config/mail.config';
import { CachingModule } from './cache/caching.module';
import { BullModule } from '@nestjs/bullmq';
import { UploadModule } from './modules/upload/upload.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { QueuesModule } from './modules/queues/queues.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [
        appConfig,
        databaseConfig,
        jwtConfig,
        cookieConfig,
        redisConfig,
        s3Config,
        mailConfig,
      ],
      validate: (config) => envSchema.parse(config),
    }),
    CachingModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host') ?? 'localhost',
          port: configService.get<number>('redis.port') ?? 6379,
          password: configService.get<string>('redis.password'),
        },
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('app.nodeEnv');

        return {
          pinoHttp: {
            level: nodeEnv === 'production' ? 'info' : 'debug',
            transport:
              nodeEnv === 'production'
                ? undefined
                : {
                    target: 'pino-pretty',
                    options: {
                      singleLine: true,
                    },
                  },
            customProps: (req: unknown) => {
              const r = req as {
                raw?: { requestId?: string };
                requestId?: string;
                headers?: Record<string, string>;
              };
              return {
                requestId:
                  r.raw?.requestId ||
                  r.requestId ||
                  r.headers?.['x-request-id'],
              };
            },
          },
        };
      },
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    UsersModule,
    PermissionsModule,
    RolesModule,
    UploadModule,
    AuditLogModule,
    QueuesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}

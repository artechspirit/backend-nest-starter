import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { MailModule } from '../mail/mail.module';
import { QueuesAuthMiddleware } from './queues-auth.middleware';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    BullBoardModule.forRoot({
      route: '/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'mail',

      adapter: BullMQAdapter,
    }),
    MailModule,
    JwtModule.register({}),
  ],
})
export class QueuesModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(QueuesAuthMiddleware).forRoutes('queues', 'queues/*');
  }
}

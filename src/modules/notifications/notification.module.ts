import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JwtModule } from '@nestjs/jwt';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';
import { NotificationProcessor } from './notification.processor';
import { NotificationController } from './notification.controller';
import { MailModule } from '../mail/mail.module';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notifications',
    }),
    JwtModule.register({}),
    MailModule,
  ],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationGateway, NotificationProcessor],
  exports: [NotificationService, BullModule],
})
export class NotificationModule {}

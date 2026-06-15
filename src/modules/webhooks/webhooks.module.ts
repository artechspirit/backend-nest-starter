import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhookService } from './webhook.service';
import { WebhookProcessor } from './webhook.processor';
import { WebhookSubscriptionController } from './webhook-subscription.controller';
import { WebhookListener } from './webhook.listener';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'webhooks',
    }),
  ],
  controllers: [WebhookSubscriptionController],
  providers: [WebhookService, WebhookProcessor, WebhookListener],
  exports: [WebhookService, BullModule],
})
export class WebhooksModule {}

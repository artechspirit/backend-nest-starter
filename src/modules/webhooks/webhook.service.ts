import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { CreateWebhookSubscriptionDto } from './dto/create-webhook-subscription.dto';

@Injectable()
export class WebhookService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('webhooks') private readonly webhookQueue: Queue,
  ) {}

  async createSubscription(userId: string, dto: CreateWebhookSubscriptionDto) {
    const secret = 'whsec_' + randomBytes(32).toString('hex');
    return this.prisma.webhookSubscription.create({
      data: {
        userId,
        url: dto.url,
        secret,
        events: dto.events,
      },
    });
  }

  async listSubscriptions(userId: string) {
    return this.prisma.webhookSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteSubscription(userId: string, id: string) {
    const sub = await this.prisma.webhookSubscription.findFirst({
      where: { id, userId },
    });

    if (!sub) {
      throw new NotFoundException('Webhook subscription not found');
    }

    await this.prisma.webhookSubscription.delete({
      where: { id },
    });

    return { message: 'Webhook subscription deleted successfully' };
  }

  async triggerEvent(event: string, payload: any) {
    const subscriptions = await this.prisma.webhookSubscription.findMany({
      where: {
        isActive: true,
        events: {
          has: event,
        },
      },
    });

    const jobs = subscriptions.map((sub) => ({
      name: 'send-webhook',
      data: {
        subscriptionId: sub.id,
        event,
        payload,
      },
      opts: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5s, 10s, 20s, 40s, 80s
        },
      },
    }));

    if (jobs.length > 0) {
      await this.webhookQueue.addBulk(jobs);
    }
  }
}

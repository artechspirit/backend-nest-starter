import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { createHmac } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { validateUrl } from '../../common/utils/security.util';

@Processor('webhooks')
export class WebhookProcessor extends WorkerHost {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(
    job: Job<{ subscriptionId: string; event: string; payload: any }>,
  ): Promise<any> {
    const { subscriptionId, event, payload } = job.data;

    const sub = await this.prisma.webhookSubscription.findUnique({
      where: { id: subscriptionId },
    });

    if (!sub || !sub.isActive) {
      return;
    }

    try {
      await validateUrl(sub.url);
    } catch (err: any) {
      await this.prisma.webhookDeliveryLog.create({
        data: {
          subscriptionId,
          event,
          payload: payload,
          isSuccess: false,
          errorMessage: `SSRF Blocked: ${err.message}`,
        },
      });
      throw err;
    }

    const timestamp = new Date().toISOString();
    const webhookPayload = {
      event,
      timestamp,
      data: payload,
    };

    const payloadString = JSON.stringify(webhookPayload);
    const signature = createHmac('sha256', sub.secret)
      .update(payloadString)
      .digest('hex');

    const startTime = Date.now();
    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let isSuccess = false;
    let errorMessage: string | null = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

      const response = await fetch(sub.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'NestJS-Webhook-Dispatcher/1.0',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event,
        },
        body: payloadString,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      responseStatus = response.status;
      responseBody = await response.text();

      if (response.ok) {
        isSuccess = true;
      } else {
        errorMessage = `HTTP error status: ${response.status}`;
      }
    } catch (err: any) {
      errorMessage = err.message || 'Unknown network error';
    } finally {
      const durationMs = Date.now() - startTime;

      // Limit response body size stored in DB
      const trimmedResponseBody = responseBody
        ? responseBody.substring(0, 1000)
        : null;

      await this.prisma.webhookDeliveryLog.create({
        data: {
          subscriptionId,
          event,
          payload: payload,
          responseStatus,
          responseBody: trimmedResponseBody,
          durationMs,
          isSuccess,
          errorMessage,
        },
      });
    }

    if (!isSuccess) {
      throw new Error(`Webhook delivery failed: ${errorMessage}`);
    }
  }
}

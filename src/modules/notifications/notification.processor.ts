import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MailService } from '../mail/mail.service';

@Processor('notifications')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {
    super();
  }

  async process(
    job: Job<{ notificationId: string; channels: ('email' | 'push')[] }>,
  ): Promise<any> {
    const { notificationId, channels } = job.data;

    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: {
        user: true,
      },
    });

    if (!notification || !notification.user) {
      return;
    }

    const { user, title, content } = notification;

    for (const channel of channels) {
      try {
        if (channel === 'email') {
          // Send notification email via existing MailModule queue
          await this.mailService.queueMail(
            user.email,
            title,
            'notification', // Needs a template or fallback
            {
              name: user.name,
              title,
              content,
            },
          );
          this.logger.debug(`Enqueued notification email to ${user.email}`);
        } else if (channel === 'push') {
          // Fetch FCM registration tokens for the user
          const devices = await this.prisma.userDevice.findMany({
            where: { userId: user.id },
          });

          if (devices.length === 0) {
            this.logger.debug(
              `No device registered for user ${user.id}, skipping push`,
            );
            continue;
          }

          // Simulate FCM REST call or Firebase Admin SDK push notification
          for (const device of devices) {
            this.logger.debug(
              `[FCM Push] Sending to token ${device.deviceToken.substring(0, 15)}... (${device.deviceType}): ${title} - ${content}`,
            );
          }
        }
      } catch (err: any) {
        this.logger.error(
          `Failed to send notification via ${channel} for job ${job.id}: ${err.message}`,
        );
      }
    }
  }
}

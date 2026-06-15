import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { DeviceTokenDto } from './dto/device-token.dto';
import { NotificationGateway } from './notification.gateway';

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationGateway: NotificationGateway,
    @InjectQueue('notifications') private readonly notificationQueue: Queue,
  ) {}

  async registerDevice(userId: string, dto: DeviceTokenDto) {
    return this.prisma.userDevice.upsert({
      where: { deviceToken: dto.deviceToken },
      create: {
        userId,
        deviceToken: dto.deviceToken,
        deviceType: dto.deviceType,
      },
      update: {
        userId,
        deviceType: dto.deviceType,
      },
    });
  }

  async listNotifications(userId: string, limit = 20, page = 1) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.notification.count({ where: { userId } }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
      },
    };
  }

  async markAsRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    return this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async sendNotification(
    userId: string,
    data: {
      title: string;
      content: string;
      type: string;
      channels: ('in_app' | 'email' | 'push')[];
      metadata?: any;
    },
  ) {
    // 1. Persist notification to database
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title: data.title,
        content: data.content,
        type: data.type,
        metadata: data.metadata || {},
      },
    });

    // 2. Dispatch real-time WebSocket notification if online
    if (data.channels.includes('in_app')) {
      this.notificationGateway.sendToUser(userId, 'notification', notification);
    }

    // 3. Dispatch to BullMQ for asynchronous Email and FCM Push Notifications
    const asyncChannels = data.channels.filter(
      (c) => c === 'email' || c === 'push',
    );
    if (asyncChannels.length > 0) {
      await this.notificationQueue.add('send-notification', {
        notificationId: notification.id,
        channels: asyncChannels,
      });
    }

    return notification;
  }
}

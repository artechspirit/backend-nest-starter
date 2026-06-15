import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../database/prisma.service';
import { UploadService } from '../upload/upload.service';
import { NotificationService } from '../notifications/notification.service';

@Processor('file-jobs')
export class FileJobProcessor extends WorkerHost {
  private readonly logger = new Logger(FileJobProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
    private readonly notificationService: NotificationService,
  ) {
    super();
  }

  async process(job: Job<{ jobId: string }>): Promise<any> {
    const { jobId } = job.data;

    const fileJob = await this.prisma.fileJob.findUnique({
      where: { id: jobId },
    });

    if (!fileJob || fileJob.status !== 'pending') {
      return;
    }

    // 1. Update status to processing
    await this.prisma.fileJob.update({
      where: { id: jobId },
      data: { status: 'processing' },
    });

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Exported Data');

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${fileJob.module}_export_${timestamp}.xlsx`;
      const mimeType =
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      // 2. Fetch data based on module
      if (fileJob.module === 'users') {
        const users = await this.prisma.user.findMany({
          orderBy: { createdAt: 'desc' },
        });

        worksheet.columns = [
          { header: 'ID', key: 'id', width: 40 },
          { header: 'Name', key: 'name', width: 25 },
          { header: 'Email', key: 'email', width: 30 },
          { header: 'Status', key: 'status', width: 15 },
          { header: 'Created At', key: 'createdAt', width: 25 },
        ];

        worksheet.addRows(
          users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            status: u.status,
            createdAt: u.createdAt.toISOString(),
          })),
        );
      } else if (fileJob.module === 'audit_logs') {
        const auditLogs = await this.prisma.auditLog.findMany({
          orderBy: { createdAt: 'desc' },
        });

        worksheet.columns = [
          { header: 'ID', key: 'id', width: 40 },
          { header: 'Actor ID', key: 'actorId', width: 40 },
          { header: 'Action', key: 'action', width: 25 },
          { header: 'Entity Type', key: 'entityType', width: 20 },
          { header: 'Entity ID', key: 'entityId', width: 40 },
          { header: 'IP Address', key: 'ipAddress', width: 20 },
          { header: 'Created At', key: 'createdAt', width: 25 },
        ];

        worksheet.addRows(
          auditLogs.map((l) => ({
            id: l.id,
            actorId: l.actorId || 'N/A',
            action: l.action,
            entityType: l.entityType || 'N/A',
            entityId: l.entityId || 'N/A',
            ipAddress: l.ipAddress || 'N/A',
            createdAt: l.createdAt.toISOString(),
          })),
        );
      }

      // 3. Write Excel to buffer
      const buffer = (await workbook.xlsx.writeBuffer()) as any;

      // 4. Upload file buffer to Object Storage (S3)
      const uploadResult = await this.uploadService.uploadFile(
        buffer,
        filename,
        mimeType,
      );

      // 5. Update FileJob to completed
      await this.prisma.fileJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          fileUrl: uploadResult.url,
        },
      });

      // 6. Notify user via In-App (WebSocket) and Email
      await this.notificationService.sendNotification(fileJob.userId, {
        title: 'File Export Completed',
        content: `Your export file for ${fileJob.module} is ready for download.`,
        type: 'system',
        channels: ['in_app', 'email'],
        metadata: {
          fileJobId: fileJob.id,
          fileUrl: uploadResult.url,
        },
      });

      this.logger.debug(`File job ${jobId} completed successfully`);
    } catch (err: any) {
      this.logger.error(`File job ${jobId} failed: ${err.message}`, err.stack);

      await this.prisma.fileJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          error: err.message || 'Unknown processing error',
        },
      });

      // Notify user of failure
      await this.notificationService.sendNotification(fileJob.userId, {
        title: 'File Export Failed',
        content: `Your export file for ${fileJob.module} failed to process: ${err.message}`,
        type: 'system',
        channels: ['in_app'],
      });
    }
  }
}

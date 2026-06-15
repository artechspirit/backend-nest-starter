import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { CreateExportDto } from './dto/create-export.dto';

@Injectable()
export class FileJobService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('file-jobs') private readonly fileJobQueue: Queue,
  ) {}

  async triggerExport(userId: string, dto: CreateExportDto) {
    // 1. Create pending file job entry
    const job = await this.prisma.fileJob.create({
      data: {
        userId,
        type: 'export',
        module: dto.module,
        status: 'pending',
      },
    });

    // 2. Add to BullMQ queue for processing
    await this.fileJobQueue.add('process-file-job', {
      jobId: job.id,
    });

    return job;
  }

  async listJobs(userId: string) {
    return this.prisma.fileJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getJob(userId: string, id: string) {
    const job = await this.prisma.fileJob.findFirst({
      where: { id, userId },
    });

    if (!job) {
      throw new NotFoundException('File job not found');
    }

    return job;
  }
}

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { FileJobService } from './file-job.service';
import { FileJobProcessor } from './file-job.processor';
import { FileJobController } from './file-job.controller';
import { UploadModule } from '../upload/upload.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'file-jobs',
    }),
    UploadModule,
    NotificationModule,
  ],
  controllers: [FileJobController],
  providers: [FileJobService, FileJobProcessor],
  exports: [FileJobService],
})
export class FileJobsModule {}

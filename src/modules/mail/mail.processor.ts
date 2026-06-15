import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MailService } from './mail.service';
import { readFileSync } from 'fs';
import { join } from 'path';

interface MailJobData {
  to: string;
  subject: string;
  templateName: 'email-verification' | 'password-reset' | 'notification';
  context: Record<string, string>;
}

@Processor('mail')
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job<MailJobData>): Promise<void> {
    const { to, subject, templateName, context } = job.data;
    this.logger.log(`Processing mail job ${job.id} for target: ${to}`);

    try {
      // Resolve path to templates (in dist directory upon compilation)
      const templatePath = join(__dirname, 'templates', `${templateName}.html`);
      let htmlContent = readFileSync(templatePath, 'utf8');

      // Simple regex replacement for placeholders {{key}}
      for (const [key, value] of Object.entries(context)) {
        htmlContent = htmlContent.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }

      await this.mailService.sendMailDirectly(to, subject, htmlContent);
      this.logger.log(`Successfully completed mail job ${job.id}`);
    } catch (error) {
      this.logger.error(`Error processing mail job ${job.id}:`, error);
      throw error;
    }
  }
}

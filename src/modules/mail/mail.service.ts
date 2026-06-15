import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue('mail') private readonly mailQueue: Queue,
  ) {
    const host = this.configService.get<string>('mail.host') ?? 'localhost';
    const port = this.configService.get<number>('mail.port') ?? 1025;
    const user = this.configService.get<string>('mail.user');
    const pass = this.configService.get<string>('mail.password');

    const auth = user && pass ? { user, pass } : undefined;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth,
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  /**
   * Directly sends mail (synchronously blocks, should be processed by worker)
   */
  async sendMailDirectly(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    const from =
      this.configService.get<string>('mail.from') ??
      'Backend Starterkit <noreply@example.com>';
    try {
      await this.transporter.sendMail({
        from,
        to,
        subject,
        html,
      });
      this.logger.log(`Email successfully sent directly to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email directly to ${to}:`, error);
      throw error;
    }
  }

  /**
   * Queues an email job to BullMQ
   */
  async queueMail(
    to: string,
    subject: string,
    templateName: 'email-verification' | 'password-reset' | 'notification',
    context: Record<string, string>,
  ): Promise<void> {
    try {
      await this.mailQueue.add('send', {
        to,
        subject,
        templateName,
        context,
      });
      this.logger.log(
        `Queued email job to ${to} using template: ${templateName}`,
      );
    } catch (error) {
      this.logger.error(`Failed to queue email job to ${to}:`, error);
      throw error;
    }
  }
}

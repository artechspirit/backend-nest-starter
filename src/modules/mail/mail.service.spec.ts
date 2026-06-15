import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';

describe('MailService', () => {
  let service: MailService;
  let mockQueue: {
    add: jest.Mock;
  };
  let mockConfigService: Partial<ConfigService>;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-id' }),
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'mail.host') return 'localhost';
        if (key === 'mail.port') return 1025;
        if (key === 'mail.from')
          return 'Backend Starterkit <noreply@example.com>';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: getQueueToken('mail'), useValue: mockQueue },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('queueMail', () => {
    it('should successfully add a mail job to the queue', async () => {
      await service.queueMail(
        'test@example.com',
        'Test Subject',
        'email-verification',
        {
          name: 'John Doe',
          verificationUrl: 'http://localhost:4000/verify',
        },
      );

      expect(mockQueue.add).toHaveBeenCalledWith('send', {
        to: 'test@example.com',
        subject: 'Test Subject',
        templateName: 'email-verification',
        context: {
          name: 'John Doe',
          verificationUrl: 'http://localhost:4000/verify',
        },
      });
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { UploadService } from './upload.service';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';

jest.mock('@aws-sdk/client-s3');

describe('UploadService', () => {
  let service: UploadService;
  let configService: Partial<ConfigService>;
  let mockS3Send: jest.Mock;

  beforeEach(async () => {
    configService = {
      get: jest.fn().mockImplementation((key) => {
        if (key === 's3.endpoint') return 'http://localhost:9000';
        if (key === 's3.accessKeyId') return 'minioadmin';
        if (key === 's3.secretAccessKey') return 'minioadmin';
        if (key === 's3.bucketName') return 'test-bucket';
        if (key === 's3.region') return 'us-east-1';
        if (key === 's3.publicUrl') return 'http://localhost:9000/test-bucket';
        return null;
      }),
    };

    mockS3Send = jest.fn();
    S3Client.prototype.send = mockS3Send;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<UploadService>(UploadService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadFile', () => {
    it('should throw BadRequestException if file exceeds maxSize', async () => {
      const buffer = Buffer.alloc(10 * 1024 * 1024); // 10MB
      await expect(
        service.uploadFile(
          buffer,
          'test.png',
          'image/png',
          ['image/png'],
          5 * 1024 * 1024,
        ),
      ).rejects.toThrow('File size exceeds limit of 5MB');
    });

    it('should upload successfully if file is within limits', async () => {
      const buffer = Buffer.from('fake-image-bytes');
      mockS3Send.mockResolvedValue({});

      // Mock validateFileSignature to bypass dynamic import of file-type during testing
      jest.spyOn(service, 'validateFileSignature').mockResolvedValue(undefined);

      const result = await service.uploadFile(
        buffer,
        'test.png',
        'image/png',
        ['image/png'],
        5 * 1024 * 1024,
      );

      expect(result).toBeDefined();
      expect(result.key).toContain('uploads/');
      expect(result.url).toBe(
        `http://localhost:9000/test-bucket/${result.key}`,
      );
    });
  });
});

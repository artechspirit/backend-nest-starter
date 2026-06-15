import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class UploadService {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly logger = new Logger(UploadService.name);

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('s3.endpoint');
    const accessKeyId = this.configService.get<string>('s3.accessKeyId');
    const secretAccessKey =
      this.configService.get<string>('s3.secretAccessKey');
    const region = this.configService.get<string>('s3.region') ?? 'us-east-1';

    this.bucketName =
      this.configService.get<string>('s3.bucketName') ?? 'starterkit';

    if (!accessKeyId || !secretAccessKey) {
      this.logger.warn(
        'S3 credentials are not fully configured. Upload features will fail.',
      );
    }

    this.s3Client = new S3Client({
      endpoint,
      credentials: {
        accessKeyId: accessKeyId ?? '',
        secretAccessKey: secretAccessKey ?? '',
      },
      region,
      forcePathStyle: !!endpoint, // Enable path-style routing if custom endpoint is set (e.g. MinIO)
    });
  }

  /**
   * Validates file mime type using magic bytes (file signature)
   */
  async validateFileSignature(
    buffer: Buffer,
    allowedMimeTypes: string[],
  ): Promise<void> {
    try {
      // Dynamic import to prevent CommonJS/ESM compilation issues with 'file-type'
      const { fileTypeFromBuffer } = await (eval(
        'import("file-type")',
      ) as Promise<typeof import('file-type')>);
      const fileType = await fileTypeFromBuffer(buffer);

      if (!fileType) {
        throw new BadRequestException(
          'Could not detect file type from file signature',
        );
      }

      if (!allowedMimeTypes.includes(fileType.mime)) {
        throw new BadRequestException(
          `Invalid file type detected: ${fileType.mime}. Allowed types: ${allowedMimeTypes.join(', ')}`,
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        'Error validating file signature',
        error instanceof Error ? error.stack : error,
      );
      throw new BadRequestException('Error validating file type');
    }
  }

  /**
   * Uploads file to object storage and returns object key and URL
   */
  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    allowedMimeTypes?: string[],
    maxSizeInBytes?: number,
  ): Promise<{ key: string; url: string }> {
    // 1. Enforce size limit
    if (maxSizeInBytes && buffer.length > maxSizeInBytes) {
      throw new BadRequestException(
        `File size exceeds limit of ${Math.round(maxSizeInBytes / 1024 / 1024)}MB`,
      );
    }

    // 2. Validate mime type using magic bytes if whitelist is supplied
    if (allowedMimeTypes && allowedMimeTypes.length > 0) {
      await this.validateFileSignature(buffer, allowedMimeTypes);
    }

    // 3. Generate unique object key
    const extension = originalName.split('.').pop() ?? '';
    const key = `uploads/${randomUUID()}.${extension}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      });

      await this.s3Client.send(command);

      const publicUrl = this.configService.get<string>('s3.publicUrl');
      const url = publicUrl
        ? `${publicUrl}/${key}`
        : await this.getPresignedReadUrl(key, 3600);

      return {
        key,
        url,
      };
    } catch (error) {
      this.logger.error(
        `Failed to upload object to S3: ${key}`,
        error instanceof Error ? error.stack : error,
      );
      throw new BadRequestException('Failed to upload file to Object Storage');
    }
  }

  /**
   * Generates a temporary pre-signed URL for accessing a private object
   */
  async getPresignedReadUrl(
    key: string,
    expiresInSeconds = 3600,
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      return await getSignedUrl(this.s3Client, command, {
        expiresIn: expiresInSeconds,
      });
    } catch (error) {
      this.logger.error(
        `Failed to generate signed URL for key: ${key}`,
        error instanceof Error ? error.stack : error,
      );
      throw new BadRequestException('Failed to generate file access URL');
    }
  }
}

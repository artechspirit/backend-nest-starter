import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse as SwaggerResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadService } from './upload.service';

@ApiTags('Upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @ApiOperation({ summary: 'Upload an image file (stateless Object Storage)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @SwaggerResponse({ status: 201, description: 'File uploaded successfully' })
  @SwaggerResponse({
    status: 400,
    description: 'Invalid file or limit exceeded',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024, // Enforce 5MB limit at middleware/parser level to protect memory
      },
    }),
  )
  async uploadImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Set constraints: allowed image MIME types, max size 5MB
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];
    const maxSize = 5 * 1024 * 1024; // 5MB

    const result = await this.uploadService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      allowedMimeTypes,
      maxSize,
    );

    return {
      message: 'File uploaded successfully',
      data: result,
    };
  }
}

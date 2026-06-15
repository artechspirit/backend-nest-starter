import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  CurrentUser as CurrentUserType,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateExportDto } from './dto/create-export.dto';
import { FileJobService } from './file-job.service';

@ApiTags('File Export & Import')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('file-jobs')
export class FileJobController {
  constructor(private readonly fileJobService: FileJobService) {}

  @Post('export')
  @ApiOperation({ summary: 'Request an asynchronous data export (Excel)' })
  @ApiResponse({
    status: 202,
    description: 'Export request accepted and queued',
  })
  async export(
    @Body() dto: CreateExportDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.fileJobService.triggerExport(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all file export/import jobs' })
  @ApiResponse({ status: 200, description: 'List of jobs retrieved' })
  async findAll(@CurrentUser() user: CurrentUserType) {
    return this.fileJobService.listJobs(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details/status of a specific file job' })
  @ApiResponse({ status: 200, description: 'Job details retrieved' })
  async findOne(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.fileJobService.getJob(user.id, id);
  }
}

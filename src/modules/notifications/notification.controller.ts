import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiQuery } from '@nestjs/swagger';
import { CurrentUser, CurrentUser as CurrentUserType } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DeviceTokenDto } from './dto/device-token.dto';
import { NotificationService } from './notification.service';
import { Type } from 'class-transformer';
import { IsOptional, IsInt, Min } from 'class-validator';

// Standard Pagination Query DTO for controller inputs complying with Type decorators
class NotificationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('devices')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register FCM token for the user device' })
  @ApiResponse({ status: 200, description: 'Device token registered successfully' })
  async registerDevice(
    @Body() dto: DeviceTokenDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.notificationService.registerDevice(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List notifications for the authenticated user' })
  @ApiResponse({ status: 200, description: 'List of notifications retrieved' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Query() query: NotificationQueryDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return this.notificationService.listNotifications(user.id, limit, page);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  async markAsRead(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.notificationService.markAsRead(user.id, id);
  }
}

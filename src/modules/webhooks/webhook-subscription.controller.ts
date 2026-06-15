import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, CurrentUser as CurrentUserType } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateWebhookSubscriptionDto } from './dto/create-webhook-subscription.dto';
import { WebhookService } from './webhook.service';

@ApiTags('Webhooks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('webhooks/subscriptions')
export class WebhookSubscriptionController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new webhook subscription' })
  @ApiResponse({ status: 201, description: 'Webhook subscription successfully created' })
  async create(
    @Body() dto: CreateWebhookSubscriptionDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.webhookService.createSubscription(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all webhook subscriptions for the authenticated user' })
  @ApiResponse({ status: 200, description: 'List of subscriptions retrieved' })
  async findAll(@CurrentUser() user: CurrentUserType) {
    return this.webhookService.listSubscriptions(user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a webhook subscription' })
  @ApiResponse({ status: 200, description: 'Subscription deleted' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.webhookService.deleteSubscription(user.id, id);
  }
}

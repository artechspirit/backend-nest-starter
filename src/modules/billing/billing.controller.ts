import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser, CurrentUser as CurrentUserType } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BillingService } from './billing.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

// Extended request type to include rawBody set by NestJS
interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

@ApiTags('Billing & Payments')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('checkout')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new checkout session' })
  @ApiResponse({ status: 200, description: 'Checkout session created' })
  async createCheckout(
    @Body() dto: CreateCheckoutDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.billingService.createCheckoutSession(user.id, dto);
  }

  @Post('webhooks/stripe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stripe webhook receiver' })
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RequestWithRawBody,
  ) {
    if (!signature) {
      throw new BadRequestException('Stripe signature header is missing');
    }
    
    // Read the raw body preserved by rawBody: true in main.ts
    const rawBody = req.rawBody?.toString('utf8') || '';
    await this.billingService.handleStripeWebhook(signature, rawBody);
    
    return { received: true };
  }

  @Post('webhooks/midtrans')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Midtrans webhook receiver' })
  async handleMidtransWebhook(@Body() payload: any) {
    await this.billingService.handleMidtransWebhook(payload);
    return { received: true };
  }
}

// Helper import for controller error handling
import { BadRequestException } from '@nestjs/common';

import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import * as midtransClient from 'midtrans-client';
import { createHash } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private getStripeClient(): any {
    const secretKey = this.configService.get<string>('billing.stripe.secretKey');
    if (!secretKey) {
      throw new BadRequestException('Stripe secret key is not configured');
    }
    return new Stripe(secretKey, { apiVersion: '2025-01-27.acronyms' as any });
  }

  private getMidtransSnap(): any {
    const serverKey = this.configService.get<string>('billing.midtrans.serverKey');
    const isProduction = this.configService.get<boolean>('billing.midtrans.isProduction') ?? false;
    if (!serverKey) {
      throw new BadRequestException('Midtrans server key is not configured');
    }
    return new midtransClient.Snap({
      isProduction,
      serverKey,
      clientKey: this.configService.get<string>('billing.midtrans.clientKey'),
    });
  }

  async createCheckoutSession(userId: string, dto: CreateCheckoutDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (dto.provider === 'stripe') {
      const stripe = this.getStripeClient();
      const webUrl = this.configService.get<string>('app.webUrl') ?? 'http://localhost:3000';

      // 1. Get or create Stripe Customer
      let subscription = await this.prisma.subscription.findUnique({ where: { userId } });
      let customerId = subscription?.stripeCustomerId;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
        });
        customerId = customer.id;
      }

      // 2. Create Stripe Checkout Session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: dto.planId, // Price ID from Stripe Dashboard
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${webUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${webUrl}/billing/cancel`,
        metadata: {
          userId,
          planId: dto.planId,
        },
      });

      return {
        provider: 'stripe',
        sessionId: session.id,
        url: session.url,
      };
    } else {
      const snap = this.getMidtransSnap();
      const orderId = `bill-${userId.substring(0, 8)}-${Date.now()}`;

      // 3. Define Midtrans Snap transaction parameters
      const parameter = {
        transaction_details: {
          order_id: orderId,
          gross_amount: 150000, // IDR pricing example
        },
        credit_card: {
          secure: true,
        },
        customer_details: {
          first_name: user.name,
          email: user.email,
        },
        metadata: {
          userId,
          planId: dto.planId,
        },
      };

      const transaction = await snap.createTransaction(parameter);
      
      return {
        provider: 'midtrans',
        token: transaction.token,
        url: transaction.redirect_url,
      };
    }
  }

  async handleStripeWebhook(signature: string, rawBody: string) {
    const stripe = this.getStripeClient();
    const webhookSecret = this.configService.get<string>('billing.stripe.webhookSecret');

    if (!webhookSecret) {
      throw new BadRequestException('Stripe webhook secret is not configured');
    }

    let event: any;

    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
      throw new BadRequestException(`Stripe webhook signature verification failed: ${err.message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const userId = session.metadata?.userId;
        const planId = session.metadata?.planId;

        if (userId) {
          await this.prisma.subscription.upsert({
            where: { userId },
            create: {
              userId,
              stripeCustomerId: session.customer as string,
              planId,
              status: 'active',
            },
            update: {
              stripeCustomerId: session.customer as string,
              planId,
              status: 'active',
            },
          });
        }
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;
        
        await this.prisma.subscription.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            status: subscription.status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
        });
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;

        await this.prisma.subscription.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            status: 'canceled',
            planId: null,
            currentPeriodEnd: null,
          },
        });
        break;
      }
    }
  }

  async handleMidtransWebhook(payload: any) {
    const serverKey = this.configService.get<string>('billing.midtrans.serverKey');
    if (!serverKey) {
      throw new BadRequestException('Midtrans is not configured');
    }

    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
    } = payload;

    // 1. Verify Midtrans signature key
    const hashPayload = order_id + status_code + gross_amount + serverKey;
    const computedSignature = createHash('sha512').update(hashPayload).digest('hex');

    if (computedSignature !== signature_key) {
      throw new BadRequestException('Midtrans signature verification failed');
    }

    // 2. Extract userId from order_id (e.g. bill-userId-timestamp)
    const orderParts = order_id.split('-');
    if (orderParts.length < 3) return;

    // For demonstration, let's find the user subscription by parsing the order details
    // If billing is set up properly, you'd track orderIds in a Transaction table.
    // Here we query subscriptions based on customerId mapping or order prefix
    // For this simple boilerplate, let's extract the order prefix or assume a subscription update:
    let isPaid = false;

    if (transaction_status === 'capture') {
      if (fraud_status === 'challenge') {
        // Challenged by fraud system
      } else if (fraud_status === 'accept') {
        isPaid = true;
      }
    } else if (transaction_status === 'settlement') {
      isPaid = true;
    } else if (transaction_status === 'cancel' || transaction_status === 'deny' || transaction_status === 'expire') {
      // Payment failed/canceled
    }

    if (isPaid) {
      // Find subscription by mapping or metadata. In Midtrans snaps, you can map via userId or standard database order
      // Let's assume order_id contains order prefix containing userId reference
      // (Normally order details are stored in DB beforehand)
      // Let's simulate:
      const user = await this.prisma.user.findFirst({
        where: {
          id: {
            startsWith: orderParts[1],
          },
        },
      });

      if (user) {
        await this.prisma.subscription.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            midtransCustomerId: order_id,
            planId: 'midtrans_premium',
            status: 'active',
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          },
          update: {
            midtransCustomerId: order_id,
            planId: 'midtrans_premium',
            status: 'active',
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      }
    }
  }
}

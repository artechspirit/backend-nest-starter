import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCheckoutDto {
  @ApiProperty({
    example: 'price_premium_monthly',
    description: 'Price or Plan ID from the billing configuration',
  })
  @IsString()
  @IsNotEmpty()
  planId!: string;

  @ApiProperty({
    example: 'stripe',
    enum: ['stripe', 'midtrans'],
    description: 'Payment gateway provider',
  })
  @IsEnum(['stripe', 'midtrans'])
  provider!: 'stripe' | 'midtrans';
}

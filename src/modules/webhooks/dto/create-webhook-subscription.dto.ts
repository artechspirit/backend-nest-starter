import {
  IsUrl,
  IsString,
  IsArray,
  IsNotEmpty,
  ArrayMinSize,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWebhookSubscriptionDto {
  @ApiProperty({
    example: 'https://client-app.com/webhooks',
    description: 'Target URL to receive webhook payloads',
  })
  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  url!: string;

  @ApiProperty({
    example: ['user.created', 'password.changed'],
    description: 'Array of event names to subscribe to',
  })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  events!: string[];
}

import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeviceTokenDto {
  @ApiProperty({
    example: 'fcm_token_1234567890',
    description: 'FCM Device Registration Token',
  })
  @IsString()
  @IsNotEmpty()
  deviceToken!: string;

  @ApiProperty({
    example: 'web',
    enum: ['ios', 'android', 'web'],
    required: false,
    description: 'Type of user device',
  })
  @IsEnum(['ios', 'android', 'web'])
  @IsOptional()
  deviceType?: string;
}

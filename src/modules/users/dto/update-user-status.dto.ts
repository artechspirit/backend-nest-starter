import { IsEnum } from 'class-validator';
import { UserStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserStatusDto {
  @ApiProperty({
    enum: UserStatus,
    example: UserStatus.ACTIVE,
    description: 'New status for the user',
  })
  @IsEnum(UserStatus)
  status!: UserStatus;
}

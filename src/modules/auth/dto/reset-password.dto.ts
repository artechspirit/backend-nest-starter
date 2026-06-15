import { IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'new_strong_password123',
    description: 'New password for the account',
  })
  @IsNotEmpty()
  @MinLength(8)
  newPassword!: string;
}

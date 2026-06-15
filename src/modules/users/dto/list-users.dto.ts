import { IsEnum, IsOptional, IsString } from 'class-validator';
import { UserStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListUsersDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'John',
    description: 'Search term for name or email',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: UserStatus,
    description: 'Filter users by status',
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

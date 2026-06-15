import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateExportDto {
  @ApiProperty({
    example: 'users',
    enum: ['users', 'audit_logs'],
    description: 'The entity module name to export data from',
  })
  @IsEnum(['users', 'audit_logs'])
  module!: 'users' | 'audit_logs';
}

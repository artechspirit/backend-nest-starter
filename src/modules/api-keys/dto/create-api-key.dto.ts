import { IsString, IsNotEmpty, IsArray, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiProperty({
    example: 'Staging Server Key',
    description: 'A friendly label to identify this API key',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: ['users.read'],
    description: 'Array of permissions/scopes assigned to this key',
  })
  @IsArray()
  @IsString({ each: true })
  scopes!: string[];
}

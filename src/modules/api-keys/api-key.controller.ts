import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  CurrentUser as CurrentUserType,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiKeyService } from './api-key.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@ApiTags('Developer API Keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new developer API key' })
  @ApiResponse({
    status: 201,
    description: 'API key successfully generated (displayed only once)',
  })
  async create(
    @Body() dto: CreateApiKeyDto,
    @CurrentUser() user: CurrentUserType,
  ) {
    return this.apiKeyService.createKey(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List metadata of developer API keys' })
  @ApiResponse({ status: 200, description: 'List of keys retrieved' })
  async findAll(@CurrentUser() user: CurrentUserType) {
    return this.apiKeyService.listKeys(user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke / delete an API key' })
  @ApiResponse({ status: 200, description: 'API Key revoked successfully' })
  async remove(@Param('id') id: string, @CurrentUser() user: CurrentUserType) {
    return this.apiKeyService.deleteKey(user.id, id);
  }
}

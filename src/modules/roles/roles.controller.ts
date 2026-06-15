import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Permissions('roles.read')
  async findAll() {
    const result = await this.rolesService.findAll();

    return {
      message: 'Roles fetched successfully',
      data: result,
    };
  }

  @Get(':id')
  @Permissions('roles.read')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.rolesService.findById(id);

    return {
      message: 'Role fetched successfully',
      data: result,
    };
  }

  @Post()
  @Permissions('roles.create')
  async create(@Body() dto: CreateRoleDto) {
    const result = await this.rolesService.create(dto);

    return {
      message: 'Role created successfully',
      data: result,
    };
  }

  @Patch(':id')
  @Permissions('roles.update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    const result = await this.rolesService.update(id, dto);

    return {
      message: 'Role updated successfully',
      data: result,
    };
  }

  @Delete(':id')
  @Permissions('roles.delete')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.rolesService.delete(id);

    return {
      message: 'Role deleted successfully',
      data: null,
    };
  }
}

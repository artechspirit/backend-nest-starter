import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  CurrentUser,
  CurrentUser as CurrentUserType,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UsersService } from './users.service';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile successfully retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@CurrentUser() user: CurrentUserType) {
    const result = await this.usersService.getProfile(user.id);

    return {
      message: 'Profile fetched successfully',
      data: result,
    };
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update user profile info' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: UpdateProfileDto,
  ) {
    const result = await this.usersService.updateProfile(user.id, dto);

    return {
      message: 'Profile updated successfully',
      data: result,
    };
  }

  @Patch('me/password')
  @ApiOperation({ summary: 'Change user account password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid current password or new password',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async changePassword(
    @CurrentUser() user: CurrentUserType,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.usersService.changePassword(user.id, dto);

    return {
      message: 'Password changed successfully',
      data: null,
    };
  }

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('users.read')
  @ApiOperation({ summary: 'List active users (paginated)' })
  @ApiResponse({ status: 200, description: 'Users successfully retrieved' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (requires users.read permission)',
  })
  async listUsers(@Query() query: ListUsersDto) {
    const result = await this.usersService.listUsers(query);

    return {
      message: 'Users fetched successfully',
      data: result.data,
      meta: result.meta,
    };
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('users.read')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User fetched successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (requires users.read permission)',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id', ParseUUIDPipe) id: string) {
    const result = await this.usersService.getUserById(id);

    return {
      message: 'User fetched successfully',
      data: result,
    };
  }

  @Patch(':id/status')
  @UseGuards(PermissionsGuard)
  @Permissions('users.update')
  @ApiOperation({ summary: 'Update user status' })
  @ApiResponse({ status: 200, description: 'User status updated successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (requires users.update permission)',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUserStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    const result = await this.usersService.updateUserStatus(id, dto.status);

    return {
      message: 'User status updated successfully',
      data: result,
    };
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('users.delete')
  @ApiOperation({ summary: 'Soft delete user account' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (requires users.delete permission)',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async softDeleteUser(@Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.softDeleteUser(id);

    return {
      message: 'User deleted successfully',
      data: null,
    };
  }
}

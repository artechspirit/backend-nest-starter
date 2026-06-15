import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import {
  CurrentUser,
  CurrentUser as CurrentUserType,
} from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleOauthGuard } from './guards/google-oauth.guard';
import { GithubOauthGuard } from './guards/github-oauth.guard';
import { Audit } from '../../common/decorators/audit.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered' })
  @ApiResponse({
    status: 400,
    description: 'Bad request payload / validation failure',
  })
  @ApiResponse({ status: 409, description: 'Email address already registered' })
  @Audit({ action: 'USER_REGISTER', entityType: 'User' })
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register(dto);

    return {
      message: result.message,
      data: {
        user: result.user,
      },
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({
    status: 200,
    description: 'Successfully logged in and cookies set',
  })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  @Audit({ action: 'USER_LOGIN', entityType: 'User' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    this.setAuthCookies(response, result.accessToken, result.refreshToken);

    return {
      message: 'Logged in successfully',
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    };
  }

  @Get('oauth/google')
  @UseGuards(GoogleOauthGuard)
  @ApiOperation({ summary: 'Initiate Google OAuth2 authentication' })
  async googleAuth() {
    // Handled by Passport
  }

  @Get('oauth/google/callback')
  @UseGuards(GoogleOauthGuard)
  @ApiOperation({ summary: 'Google OAuth2 callback' })
  @Audit({ action: 'USER_OAUTH_LOGIN_GOOGLE', entityType: 'User' })
  async googleAuthRedirect(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.oauthLogin(req.user, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    const webUrl = this.configService.get<string>('app.webUrl') ?? 'http://localhost:3000';
    res.redirect(`${webUrl}/oauth/callback?token=${result.accessToken}`);
  }

  @Get('oauth/github')
  @UseGuards(GithubOauthGuard)
  @ApiOperation({ summary: 'Initiate GitHub OAuth authentication' })
  async githubAuth() {
    // Handled by Passport
  }

  @Get('oauth/github/callback')
  @UseGuards(GithubOauthGuard)
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  @Audit({ action: 'USER_OAUTH_LOGIN_GITHUB', entityType: 'User' })
  async githubAuthRedirect(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.oauthLogin(req.user, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    this.setAuthCookies(res, result.accessToken, result.refreshToken);

    const webUrl = this.configService.get<string>('app.webUrl') ?? 'http://localhost:3000';
    res.redirect(`${webUrl}/oauth/callback?token=${result.accessToken}`);
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access and refresh JWT tokens' })
  @ApiResponse({ status: 200, description: 'Tokens successfully refreshed' })
  @ApiResponse({
    status: 401,
    description: 'Missing, expired, or invalid refresh token',
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const req = request as Request & { cookies?: Record<string, string> };
    const refreshToken =
      (req.cookies?.refresh_token as string | undefined) ||
      req.headers.authorization?.replace('Bearer ', '');

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const result = await this.authService.refresh(refreshToken, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    this.setAuthCookies(response, result.accessToken, result.refreshToken);

    return {
      message: 'Token refreshed successfully',
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @ApiOperation({ summary: 'Logout active session' })
  @ApiResponse({
    status: 200,
    description: 'Successfully logged out and session revoked',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Audit({ action: 'USER_LOGOUT', entityType: 'User' })
  async logout(
    @CurrentUser() user: CurrentUserType,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(user.sessionId);

    this.clearAuthCookies(response);

    return {
      message: 'Logged out successfully',
      data: null,
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get profile of authenticated user' })
  @ApiResponse({ status: 200, description: 'Profile successfully retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async me(@CurrentUser() user: CurrentUserType) {
    const result = await this.authService.me(user.id);

    return {
      message: 'Current user fetched successfully',
      data: result,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('email/request-verification')
  @ApiOperation({ summary: 'Request email verification token link' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email'],
      properties: {
        email: {
          type: 'string',
          example: 'user@example.com',
          description: 'User email',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Verification link queued and sent successfully',
  })
  async requestEmailVerification(@Body('email') email: string) {
    const result = await this.authService.requestEmailVerification(email);
    return {
      message: result.message,
      data: null,
    };
  }

  @Get('email/verify')
  @ApiOperation({ summary: 'Verify email using verification token' })
  @ApiQuery({
    name: 'token',
    type: 'string',
    description: 'Email verification token',
  })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired verification token',
  })
  @Audit({ action: 'USER_EMAIL_VERIFY', entityType: 'User' })
  async verifyEmail(@Query('token') token: string) {
    const result = await this.authService.verifyEmail(token);
    return {
      message: result.message,
      data: null,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('password/forgot')
  @ApiOperation({ summary: 'Request password reset link' })
  @ApiResponse({
    status: 200,
    description: 'Password reset link sent to email if registered',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const result = await this.authService.forgotPassword(dto);
    return {
      message: result.message,
      data: null,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('password/reset')
  @ApiOperation({ summary: 'Reset account password using token' })
  @ApiQuery({
    name: 'token',
    type: 'string',
    description: 'Password reset token',
  })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset token' })
  @Audit({ action: 'USER_PASSWORD_RESET', entityType: 'User' })
  async resetPassword(
    @Query('token') token: string,
    @Body() dto: ResetPasswordDto,
  ) {
    const result = await this.authService.resetPassword(token, dto);
    return {
      message: result.message,
      data: null,
    };
  }

  private setAuthCookies(
    response: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    const isSecure = this.configService.get<boolean>('cookie.secure') ?? false;
    const domain = this.configService.get<string>('cookie.domain');

    response.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      domain: domain === 'localhost' ? undefined : domain,
      path: '/',
      maxAge: 15 * 60 * 1000,
    });

    response.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'strict',
      domain: domain === 'localhost' ? undefined : domain,
      path: '/api/v1/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearAuthCookies(response: Response) {
    const domain = this.configService.get<string>('cookie.domain');

    response.clearCookie('access_token', {
      domain: domain === 'localhost' ? undefined : domain,
      path: '/',
    });

    response.clearCookie('refresh_token', {
      domain: domain === 'localhost' ? undefined : domain,
      path: '/api/v1/auth/refresh',
    });
  }
}

import {
  ConflictException,
  Injectable,
  Inject,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtPayload } from './types/jwt-payload.type';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import * as cacheManager from 'cache-manager';
import { CacheKeys } from '../../cache/cache.keys';
import { MailService } from '../mail/mail.service';

type RequestMeta = {
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheService: cacheManager.Cache,
    private readonly mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          name: dto.name.trim(),
          email,
          passwordHash,
          status: 'PENDING_VERIFICATION',
        },
      });

      const defaultRole = await tx.role.findUnique({
        where: { name: 'user' },
      });

      if (defaultRole) {
        await tx.userRole.create({
          data: {
            userId: createdUser.id,
            roleId: defaultRole.id,
          },
        });
      }

      return createdUser;
    });

    // Generate verification token
    const token = randomBytes(32).toString('hex');
    const tokenKey = CacheKeys.emailVerificationToken(token);

    // Save to Redis (TTL 24 hours = 86400 seconds)
    await this.cacheService.set(tokenKey, user.id, 86400);

    const appUrl =
      this.configService.get<string>('app.url') ?? 'http://localhost:4000';
    const prefix = this.configService.get<string>('app.prefix') ?? 'api/v1';
    const verificationUrl = `${appUrl}/${prefix}/auth/email/verify?token=${token}`;

    // Queue the verification email
    await this.mailService.queueMail(
      user.email,
      'Verify your email address',
      'email-verification',
      {
        name: user.name,
        verificationUrl,
      },
    );

    return {
      message:
        'Registration successful. Please check your email to verify your account.',
      user: this.sanitizeUser(user),
    };
  }

  async login(dto: LoginDto, meta: RequestMeta) {
    const email = dto.email.toLowerCase().trim();

    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User is not active');
    }

    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const sessionResult = await this.createSession(user.id, meta);

    const accessToken = await this.generateAccessToken({
      sub: user.id,
      email: user.email,
      sessionId: sessionResult.session.id,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken: sessionResult.refreshToken,
    };
  }

  async refresh(refreshToken: string, meta: RequestMeta) {
    const parts = refreshToken.split('.');
    if (parts.length !== 2) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const [sessionId, tokenValue] = parts;

    const session = await this.prisma.session.findUnique({
      where: {
        id: sessionId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    });

    if (!session || !session.user || session.user.deletedAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (session.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User is not active');
    }

    const isMatch = await argon2.verify(session.refreshTokenHash, tokenValue);

    if (!isMatch) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    await this.cacheService.del(CacheKeys.sessionUser(session.id));

    const newSessionResult = await this.createSession(session.user.id, meta);

    const accessToken = await this.generateAccessToken({
      sub: session.user.id,
      email: session.user.email,
      sessionId: newSessionResult.session.id,
    });

    return {
      user: this.sanitizeUser(session.user),
      accessToken,
      refreshToken: newSessionResult.refreshToken,
    };
  }

  async logout(sessionId: string) {
    await this.prisma.session.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    await this.cacheService.del(CacheKeys.sessionUser(sessionId));

    return null;
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    return this.sanitizeUser(user);
  }

  private async createSession(userId: string, meta: RequestMeta) {
    const sessionId = randomUUID();
    const tokenValue = randomBytes(64).toString('hex');
    const refreshToken = `${sessionId}.${tokenValue}`;
    const refreshTokenHash = await argon2.hash(tokenValue);

    const refreshExpiresInDays =
      this.configService.get<number>('jwt.refreshExpiresInDays') ?? 7;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + refreshExpiresInDays);

    const session = await this.prisma.session.create({
      data: {
        id: sessionId,
        userId,
        refreshTokenHash,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt,
      },
    });

    return {
      session,
      refreshToken,
    };
  }

  private async generateAccessToken(payload: JwtPayload) {
    const accessExpiresIn =
      this.configService.get<string>('jwt.accessExpiresIn') ?? '15m';

    return this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessExpiresIn as JwtSignOptions['expiresIn'],
    });
  }

  private generateRefreshToken() {
    return randomBytes(64).toString('hex');
  }

  async requestEmailVerification(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email already verified');
    }

    const token = randomBytes(32).toString('hex');
    const tokenKey = CacheKeys.emailVerificationToken(token);

    // Save token to Redis cache with a 24-hour expiration (86400 seconds)
    await this.cacheService.set(tokenKey, user.id, 86400);

    const appUrl =
      this.configService.get<string>('app.url') ?? 'http://localhost:4000';
    const prefix = this.configService.get<string>('app.prefix') ?? 'api/v1';
    const verificationUrl = `${appUrl}/${prefix}/auth/email/verify?token=${token}`;

    // Queue verification email job
    await this.mailService.queueMail(
      user.email,
      'Verify your email address',
      'email-verification',
      {
        name: user.name,
        verificationUrl,
      },
    );

    return { message: 'Verification email has been sent.' };
  }

  async verifyEmail(token: string) {
    const tokenKey = CacheKeys.emailVerificationToken(token);
    const userId = await this.cacheService.get<string>(tokenKey);

    if (!userId) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerifiedAt: new Date(),
        status: 'ACTIVE',
      },
    });

    await this.cacheService.del(tokenKey);

    return { message: 'Email verified successfully. You can now log in.' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // Prevent user enumeration by returning generic message
    if (!user || user.deletedAt) {
      return {
        message: 'If the email exists, a password reset link has been sent.',
      };
    }

    const token = randomBytes(32).toString('hex');
    const tokenKey = CacheKeys.passwordResetToken(token);

    // Save reset token to Redis cache with 15-minute expiration (900 seconds)
    await this.cacheService.set(tokenKey, user.id, 900);

    const webUrl =
      this.configService.get<string>('app.webUrl') ?? 'http://localhost:3000';
    const resetUrl = `${webUrl}/reset-password?token=${token}`;

    // Queue reset password email job
    await this.mailService.queueMail(
      user.email,
      'Reset your password',
      'password-reset',
      {
        name: user.name,
        resetUrl,
      },
    );

    return {
      message: 'If the email exists, a password reset link has been sent.',
    };
  }

  async resetPassword(token: string, dto: ResetPasswordDto) {
    const tokenKey = CacheKeys.passwordResetToken(token);
    const userId = await this.cacheService.get<string>(tokenKey);

    if (!userId) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const passwordHash = await argon2.hash(dto.newPassword);

    await this.prisma.$transaction(async (tx) => {
      // 1. Update password
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      // 2. Revoke all active sessions for this user
      const activeSessions = await tx.session.findMany({
        where: { userId, revokedAt: null },
      });

      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      // 3. Invalidate Redis session caches
      for (const sess of activeSessions) {
        await this.cacheService.del(CacheKeys.sessionUser(sess.id));
      }
    });

    await this.cacheService.del(tokenKey);

    return {
      message:
        'Password reset successfully. Please log in with your new password.',
    };
  }

  private sanitizeUser<T extends { passwordHash?: string }>(user: T) {
    const safeUser = { ...user };
    delete safeUser.passwordHash;

    return safeUser;
  }
}

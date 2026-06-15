import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { GithubStrategy } from './strategies/github.strategy';
import { AuthorizationService } from './services/authorization.service';
import { MailModule } from '../mail/mail.module';

@Global()
@Module({
  imports: [PassportModule, JwtModule.register({}), MailModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    GithubStrategy,
    AuthorizationService,
  ],
  exports: [AuthService, AuthorizationService],
})
export class AuthModule {}

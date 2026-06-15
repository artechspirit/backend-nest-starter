import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthorizationService } from './services/authorization.service';
import { MailModule } from '../mail/mail.module';

@Global()
@Module({
  imports: [PassportModule, JwtModule.register({}), MailModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, AuthorizationService],
  exports: [AuthService, AuthorizationService],
})
export class AuthModule {}

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
/**
 * JwtAuthGuard triggers Passport's 'jwt' validation strategy automatically.
 * Under the hood, it extracts the JWT (from headers or cookies), validates its signature,
 * resolves session caching (in JwtStrategy), and populates `request.user`.
 *
 * Usage: `@UseGuards(JwtAuthGuard)` on routes or controllers to restrict access to authenticated users.
 */
export class JwtAuthGuard extends AuthGuard('jwt') {}

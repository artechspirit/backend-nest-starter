import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthorizationService } from '../../modules/auth/services/authorization.service';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    // Reflector is a utility helper to extract custom metadata (like permissions) from controller decorators
    private readonly reflector: Reflector,
    // AuthorizationService acts as the orchestrator to resolve user permissions, using Redis for high performance
    private readonly authorizationService: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Extract required permissions from the handler (method) or class (controller).
    // getAllAndOverride gives precedence to method-level annotations over class-level annotations.
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    // If no permission decorator is present, let the request pass through (RBAC is opt-in)
    if (requiredPermissions.length === 0) {
      return true;
    }

    // 2. Fetch the authenticated user from the Request object (populated previously by JwtAuthGuard)
    const request = context
      .switchToHttp()
      .getRequest<{ user?: { id?: string } }>();
    const user = request.user;

    if (!user?.id) {
      throw new ForbiddenException('User not authenticated');
    }

    // 3. Resolve user's actual permissions.
    // Under the hood, authorizationService resolves this from Redis.
    // Cache is automatically invalidated if the user's role or permissions change.
    const uniquePermissions =
      await this.authorizationService.getUserPermissions(user.id);

    // 4. Assert that the user possesses ALL the required permissions to access this endpoint
    const hasAllPermissions = requiredPermissions.every((permission) =>
      uniquePermissions.includes(permission),
    );

    if (!hasAllPermissions) {
      throw new ForbiddenException('Insufficient permission');
    }

    return true;
  }
}

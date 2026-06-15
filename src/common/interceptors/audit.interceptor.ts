import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  AUDIT_METADATA_KEY,
  AuditOptions,
} from '../decorators/audit.decorator';
import { AuditLogService } from '../../modules/audit-log/audit-log.service';
import type { Request } from 'express';

interface UserRequest extends Request {
  user?: {
    id: string;
  };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const auditOptions = this.reflector.getAllAndOverride<AuditOptions>(
      AUDIT_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!auditOptions) {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<UserRequest>();

    return next.handle().pipe(
      tap((response: unknown) => {
        this.runAsyncAudit(request, response, auditOptions).catch((error) => {
          console.error('Failed to write audit log:', error);
        });
      }),
    );
  }

  private async runAsyncAudit(
    request: UserRequest,
    response: unknown,
    auditOptions: AuditOptions,
  ): Promise<void> {
    try {
      const actorId = request.user?.id;
      const ipAddress = request.ip;
      const userAgent = request.headers['user-agent'];

      const resObj = response as Record<string, unknown> | null;

      // Extract entity ID from request params or response body
      let entityId: string | undefined = undefined;
      const paramId = request.params?.id;
      if (typeof paramId === 'string') {
        entityId = paramId;
      } else if (Array.isArray(paramId) && paramId.length > 0) {
        entityId = paramId[0];
      }

      if (resObj) {
        if (resObj.data && typeof resObj.data === 'object') {
          const resData = resObj.data as Record<string, unknown>;
          if (typeof resData.id === 'string') {
            entityId = resData.id;
          }
        } else if (typeof resObj.id === 'string') {
          entityId = resObj.id;
        }
      }

      // Build metadata object (excluding sensitive data)
      const reqBody = request.body as Record<string, unknown> | null;
      const bodyCopy = reqBody ? { ...reqBody } : {};

      // Sanitize sensitive credentials
      delete bodyCopy.password;
      delete bodyCopy.newPassword;
      delete bodyCopy.currentPassword;

      const metadata: Record<string, unknown> = {
        query: request.query,
        params: request.params,
        body: bodyCopy,
      };

      await this.auditLogService.create({
        actorId,
        action: auditOptions.action,
        entityType: auditOptions.entityType,
        entityId,
        metadata,
        ipAddress,
        userAgent,
      });
    } catch (error) {
      console.error('Failed to write audit log in background:', error);
    }
  }
}

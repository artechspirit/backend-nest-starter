import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode } from '../constants/error-code.constant';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    const isHttpException = exception instanceof HttpException;

    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttpException ? exception.getResponse() : null;

    let message = 'Internal server error';
    let details: unknown = undefined;

    if (isHttpException) {
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resObj = exceptionResponse as Record<string, unknown>;
        const msg = resObj.message;
        message = Array.isArray(msg)
          ? msg.map(String).join(', ')
          : typeof msg === 'string'
            ? msg
            : exception.message;
        details = resObj;
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Determine error code based on HTTP status
    const code = this.getErrorCode(status);

    // Hide internal server details in production environment
    const isProduction = process.env.NODE_ENV === 'production';
    const cleanMessage =
      isProduction && status === 500 // Internal Server Error
        ? 'Internal server error'
        : message;

    const cleanDetails =
      isProduction && status === 500 // Internal Server Error
        ? undefined
        : details;

    // Log the error details on the server
    this.logger.error(
      `${request.method} ${request.url} - Status: ${status} - Error: ${
        exception instanceof Error ? exception.message : String(exception)
      }`,
      exception instanceof Error ? exception.stack : undefined,
    );

    const body = {
      success: false,
      data: null,
      error: {
        code,
        message: cleanMessage,
        details: cleanDetails,
      },
    };

    response.status(status).json(body);
  }

  private getErrorCode(status: number): string {
    switch (status) {
      case 400: // Bad Request
        return ErrorCode.BAD_REQUEST;
      case 401: // Unauthorized
        return ErrorCode.UNAUTHORIZED;
      case 403: // Forbidden
        return ErrorCode.FORBIDDEN;
      case 404: // Not Found
        return ErrorCode.NOT_FOUND;
      case 409: // Conflict
        return ErrorCode.CONFLICT;
      case 429: // Too Many Requests
        return ErrorCode.RATE_LIMITED;
      default:
        return ErrorCode.INTERNAL_SERVER_ERROR;
    }
  }
}

import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(
    request: Request & { requestId?: string },
    response: Response,
    next: NextFunction,
  ) {
    const requestId =
      request.headers['x-request-id']?.toString() ?? randomUUID();

    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);

    next();
  }
}

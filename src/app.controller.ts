import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { join } from 'path';
import { existsSync } from 'fs';

@Controller()
export class AppController {
  @Get()
  getDocs(@Res() res: Response) {
    const prodPath = join(__dirname, '..', 'docs', 'index.html');
    const devPath = join(__dirname, 'docs', 'index.html');
    const docsPath = existsSync(prodPath) ? prodPath : devPath;

    return res.sendFile(docsPath);
  }
}

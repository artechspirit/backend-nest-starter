import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';

async function generateOpenApiSpec() {
  console.log('Building NestJS application context to generate OpenAPI spec...');
  
  // Disable logging to keep stdout clean
  const app = await NestFactory.create(AppModule, { logger: false });
  
  // Set up prefix if required
  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('Backend Starterkit')
    .setDescription('Auto-generated OpenAPI documentation for the backend services')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const outputPath = path.join(__dirname, '..', 'openapi.json');
  fs.writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf8');
  
  console.log(`\n\x1b[32m[SUCCESS]\x1b[0m OpenAPI specification exported successfully to: \x1b[36m${outputPath}\x1b[0m`);
  
  await app.close();
  process.exit(0);
}

generateOpenApiSpec().catch((err) => {
  console.error('\x1b[31m[ERROR] Failed to generate OpenAPI spec:\x1b[0m', err);
  process.exit(1);
});

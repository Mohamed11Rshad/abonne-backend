import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { I18nValidationPipe, I18nValidationExceptionFilter } from 'nestjs-i18n';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global configuration
  app.setGlobalPrefix('api');
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalPipes(new I18nValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(
    new AllExceptionsFilter(),
    new I18nValidationExceptionFilter({
      detailedErrors: true,
      responseBodyFormatter: (host, exc, formattedErrors: any) => {
        let messageStr = 'Validation Error';
        const msgs: string[] = [];
        const extractErrors = (errors: any[], prefix = '') => {
          if (!Array.isArray(errors)) return;
          for (const err of errors) {
            const field = prefix ? `${prefix}.${err.property}` : err.property;
            if (err.constraints) {
              for (const msg of Object.values(err.constraints)) {
                msgs.push(`${field}: ${msg}`);
              }
            }
            if (err.children && err.children.length > 0) {
              extractErrors(err.children, field);
            }
          }
        };
        
        if (Array.isArray(formattedErrors)) {
          extractErrors(formattedErrors);
          if (msgs.length > 0) {
            messageStr = msgs.join(' | ');
          }
        }
        
        return {
          message: messageStr,
          status: exc.getStatus(),
          data: null,
        };
      },
    }),
  );
  app.enableCors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:3000',
      'http://localhost:8000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Accept-Language'],
  });

  const config = new DocumentBuilder()
    .setTitle('API Docs')
    .setDescription('The API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  if (process.env.NODE_ENV !== 'production') {
    fs.writeFileSync('./openapi.json', JSON.stringify(document, null, 2));
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

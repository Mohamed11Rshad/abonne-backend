import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { I18nModule, AcceptLanguageResolver } from 'nestjs-i18n';
import * as path from 'path';
import { CloudnairyModule } from './common/cloudnairy/cloudinary.module';
import { DrizzleModule } from './drizzle/drizzle.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'ar',
      loaderOptions: {
        path: path.join(__dirname, '/i18n/'),
        watch: true,
      },
      resolvers: [AcceptLanguageResolver],
    }),
    DrizzleModule,
    CloudnairyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}


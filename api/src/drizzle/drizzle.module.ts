import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DRIZZLE, drizzleProvider } from './drizzle.provider';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [drizzleProvider],
  exports: [DRIZZLE],
})
export class DrizzleModule {}

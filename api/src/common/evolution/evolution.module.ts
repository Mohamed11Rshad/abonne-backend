import { Global, Module } from '@nestjs/common';
import { EvolutionService } from './evolution.service';

@Global()
@Module({
  providers: [EvolutionService],
  exports: [EvolutionService],
})
export class EvolutionModule {}

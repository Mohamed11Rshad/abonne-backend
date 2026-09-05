import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SecurityService } from '../../common/security/security.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, SecurityService],
})
export class AuthModule {}

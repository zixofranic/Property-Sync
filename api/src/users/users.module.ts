import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PlanLimitsService } from './plan-limits.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService, PlanLimitsService],
  exports: [UsersService, PlanLimitsService],
})
export class UsersModule {}

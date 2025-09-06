import { Module } from '@nestjs/common';
import { SparkService } from './spark.service';
import { SparkController } from './spark.controller';
import { ConfigModule } from '@nestjs/config';
import { TimelinesModule } from '../timelines/timelines.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, TimelinesModule, PrismaModule],
  controllers: [SparkController],
  providers: [SparkService],
  exports: [SparkService],
})
export class SparkModule {}
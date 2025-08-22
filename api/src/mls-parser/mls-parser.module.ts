import { Module } from '@nestjs/common';
import { MLSParserService } from './mls-parser.service';
import { MLSParserController } from './mls-parser.controller';
import { BatchController } from './batch.controller';
import { BatchManagementService } from './batch-management.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [MLSParserService, BatchManagementService, PrismaService],
  controllers: [MLSParserController, BatchController],
  exports: [MLSParserService, BatchManagementService],
})
export class MLSParserModule {}

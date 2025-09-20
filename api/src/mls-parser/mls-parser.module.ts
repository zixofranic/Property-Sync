import { Module } from '@nestjs/common';
import { MLSParserService } from './mls-parser.service';
import { MLSParserController } from './mls-parser.controller';
import { BatchController } from './batch.controller';
import { BatchManagementService } from './batch-management.service';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingModule } from '../messaging/messaging.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [MessagingModule, PrismaModule],
  providers: [MLSParserService, BatchManagementService],
  controllers: [MLSParserController, BatchController],
  exports: [MLSParserService, BatchManagementService],
})
export class MLSParserModule {}

import { Module } from '@nestjs/common';
import { MLSParserService } from './mls-parser.service';
import { MLSParserController } from './mls-parser.controller';
import { BatchController } from './batch.controller';
import { BatchManagementService } from './batch-management.service';
import { PrismaService } from '../prisma/prisma.service';
// MessagingModule removed - already available globally via app.module.ts
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [MLSParserService, BatchManagementService],
  controllers: [MLSParserController, BatchController],
  exports: [MLSParserService, BatchManagementService],
})
export class MLSParserModule {}

import { Module, forwardRef } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { MLSParserService } from './mls-parser.service';
import { MLSParserController } from './mls-parser.controller';
import { BatchController } from './batch.controller';
import { BatchManagementService } from './batch-management.service';
import { PrismaService } from '../prisma/prisma.service';
// MessagingModule removed - already available globally via app.module.ts
import { PrismaModule } from '../prisma/prisma.module';
import { SiteDetectorService } from './site-detector.service';
import { FlexmlsParser } from './parsers/flexmls.parser';
import { ZillowParser } from './parsers/zillow.parser';
import { RealtorParser } from './parsers/realtor.parser';
import { TruliaParser } from './parsers/trulia.parser';
import { ParserFactoryService } from './parser-factory.service';
import { RapidAPIService } from './rapidapi.service';
import { TimelinesModule } from '../timelines/timelines.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => TimelinesModule),
    CacheModule.register(),
  ],
  providers: [
    MLSParserService,
    BatchManagementService,
    SiteDetectorService,
    FlexmlsParser,
    ZillowParser,
    RealtorParser,
    TruliaParser,
    ParserFactoryService,
    RapidAPIService, // NEW: RapidAPI integration
  ],
  controllers: [MLSParserController, BatchController],
  exports: [MLSParserService, BatchManagementService, RapidAPIService],
})
export class MLSParserModule {}

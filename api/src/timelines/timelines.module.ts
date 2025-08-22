import { Module } from '@nestjs/common';
import { TimelinesController } from './timelines.controller';
import { TimelinesService } from './timelines.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { MLSParserModule } from '../mls-parser/mls-parser.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PrismaModule, EmailModule, MLSParserModule, UsersModule],
  controllers: [TimelinesController],
  providers: [TimelinesService],
  exports: [TimelinesService],
})
export class TimelinesModule {}

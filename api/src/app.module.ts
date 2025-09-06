import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { TimelinesModule } from './timelines/timelines.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ShareModule } from './share/share.module';
import { AgentModule } from './agent/agent.module'; // Add this import
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { EmailModule } from './email/email.module';
import { MLSParserModule } from './mls-parser/mls-parser.module';
import { SparkModule } from './spark/spark.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    TimelinesModule,
    AnalyticsModule,
    ShareModule,
    AgentModule,
    EmailModule,
    MLSParserModule,
    SparkModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}

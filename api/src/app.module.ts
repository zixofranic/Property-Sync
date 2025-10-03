import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'; // SECURITY: Rate limiting
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
import { MessagingModule } from './messaging/messaging.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { EmailModule } from './email/email.module';
import { MLSParserModule } from './mls-parser/mls-parser.module';
import { SparkModule } from './spark/spark.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // SECURITY: Rate limiting configuration
    ThrottlerModule.forRoot([{
      ttl: 60000, // Time window: 60 seconds
      limit: 100, // Default: 100 requests per minute (general endpoints)
    }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    EmailModule,
    MessagingModule.forRoot(),
    TimelinesModule,
    AnalyticsModule,
    ShareModule,
    AgentModule,
    MLSParserModule,
    SparkModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    // SECURITY: Apply throttling globally (can be overridden per endpoint)
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Auth guard applied after throttler
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
// Trigger restart

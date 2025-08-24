import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get('health')
  async getHealth(): Promise<{ status: string; timestamp: string; database?: string }> {
    try {
      // Quick database connectivity check
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
      };
    } catch (error) {
      // Still return 200 OK but indicate database issue
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
      };
    }
  }

  @Public()
  @Get('db-status')
  async getDatabaseStatus(): Promise<any> {
    try {
      // Check if tables exist and get counts
      const userCount = await this.prisma.user.count();
      const profileCount = await this.prisma.profile.count();
      const clientCount = await this.prisma.client.count();
      
      return {
        status: 'ok',
        tables: {
          users: userCount,
          profiles: profileCount,
          clients: clientCount,
        },
        database: 'tables_exist'
      };
    } catch (error) {
      console.error('Database status error:', error);
      return {
        status: 'error',
        error: error.message,
        database: 'tables_missing_or_error'
      };
    }
  }

  @Public()
  @Get('db-init')
  async initializeDatabase(): Promise<any> {
    try {
      console.log('Creating all required database tables...');
      
      // 1. Create Users table
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "users" (
          "id" TEXT NOT NULL,
          "email" TEXT NOT NULL,
          "password" TEXT NOT NULL,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "emailVerified" BOOLEAN NOT NULL DEFAULT false,
          "verificationToken" TEXT,
          "verificationExpiry" TIMESTAMP(3),
          "resetToken" TEXT,
          "resetExpiry" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "users_pkey" PRIMARY KEY ("id")
        )
      `);

      // 2. Create Profiles table
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "profiles" (
          "id" TEXT NOT NULL,
          "firstName" TEXT NOT NULL,
          "lastName" TEXT NOT NULL,
          "company" TEXT,
          "phone" TEXT,
          "website" TEXT,
          "licenseNumber" TEXT,
          "avatar" TEXT,
          "bio" TEXT,
          "timezone" TEXT,
          "specialties" TEXT[],
          "yearsExperience" INTEGER,
          "notifications" JSONB,
          "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
          "emailTemplateStyle" TEXT DEFAULT 'modern',
          "notificationEmail" BOOLEAN NOT NULL DEFAULT true,
          "notificationDesktop" BOOLEAN NOT NULL DEFAULT true,
          "notificationFeedback" BOOLEAN NOT NULL DEFAULT true,
          "notificationNewProperties" BOOLEAN NOT NULL DEFAULT true,
          "theme" TEXT NOT NULL DEFAULT 'dark',
          "soundEnabled" BOOLEAN NOT NULL DEFAULT true,
          "logo" TEXT,
          "brandColor" TEXT DEFAULT '#0ea5e9',
          "preferredEmailTemplate" TEXT DEFAULT 'modern',
          "plan" TEXT NOT NULL DEFAULT 'FREE',
          "subscriptionStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
          "clientLimit" INTEGER NOT NULL DEFAULT 1,
          "propertyLimit" INTEGER NOT NULL DEFAULT 20,
          "stripeCustomerId" TEXT,
          "subscriptionId" TEXT,
          "subscriptionItemId" TEXT,
          "billingCycleStart" TIMESTAMP(3),
          "billingCycleEnd" TIMESTAMP(3),
          "currentMonthProperties" INTEGER NOT NULL DEFAULT 0,
          "lastUsageReset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          "userId" TEXT NOT NULL,
          CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
        )
      `);

      // 3. Create Clients table
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "clients" (
          "id" TEXT NOT NULL,
          "firstName" TEXT NOT NULL,
          "lastName" TEXT NOT NULL,
          "email" TEXT NOT NULL,
          "spouseEmail" TEXT,
          "phone" TEXT,
          "notes" TEXT,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "totalViews" INTEGER NOT NULL DEFAULT 0,
          "avgResponseTime" INTEGER NOT NULL DEFAULT 0,
          "feedbackRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
          "lastActivity" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          "agentId" TEXT NOT NULL,
          CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
        )
      `);

      // 4. Create Timelines table
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "timelines" (
          "id" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "description" TEXT,
          "shareToken" TEXT NOT NULL,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "totalViews" INTEGER NOT NULL DEFAULT 0,
          "lastViewed" TIMESTAMP(3),
          "viewHistory" JSONB,
          "agentToken" TEXT,
          "tokenExpiry" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          "agentId" TEXT NOT NULL,
          "clientId" TEXT NOT NULL,
          CONSTRAINT "timelines_pkey" PRIMARY KEY ("id")
        )
      `);

      // 5. Create Properties table
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "properties" (
          "id" TEXT NOT NULL,
          "mlsId" TEXT,
          "address" TEXT NOT NULL,
          "city" TEXT,
          "state" TEXT,
          "zipCode" TEXT,
          "price" INTEGER NOT NULL,
          "bedrooms" INTEGER,
          "bathrooms" DOUBLE PRECISION,
          "squareFootage" INTEGER,
          "propertyType" TEXT,
          "description" TEXT,
          "imageUrls" TEXT[],
          "listingUrl" TEXT,
          "mlsSource" TEXT,
          "originalMlsUrl" TEXT,
          "parsedData" JSONB,
          "parseTimestamp" TIMESTAMP(3),
          "imageCount" INTEGER NOT NULL DEFAULT 0,
          "parseErrors" TEXT[],
          "addressNormalized" TEXT,
          "priceRange" TEXT,
          "batchId" TEXT,
          "importStatus" TEXT NOT NULL DEFAULT 'completed',
          "isQuickParsed" BOOLEAN NOT NULL DEFAULT false,
          "isFullyParsed" BOOLEAN NOT NULL DEFAULT true,
          "loadingProgress" INTEGER NOT NULL DEFAULT 100,
          "agentNotes" TEXT,
          "isHighlighted" BOOLEAN NOT NULL DEFAULT false,
          "position" INTEGER NOT NULL DEFAULT 0,
          "isViewed" BOOLEAN NOT NULL DEFAULT false,
          "viewedAt" TIMESTAMP(3),
          "isQueued" BOOLEAN NOT NULL DEFAULT false,
          "queuedForEmail" BOOLEAN NOT NULL DEFAULT false,
          "emailSent" BOOLEAN NOT NULL DEFAULT false,
          "emailSentAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          "timelineId" TEXT NOT NULL,
          CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
        )
      `);

      // Create indexes
      await this.prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email")
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "users_verificationToken_key" ON "users"("verificationToken")
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "users_resetToken_key" ON "users"("resetToken")
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "profiles_userId_key" ON "profiles"("userId")
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "timelines_shareToken_key" ON "timelines"("shareToken")
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "timelines_agentToken_key" ON "timelines"("agentToken")
      `);

      // Create foreign key constraints
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "profiles" DROP CONSTRAINT IF EXISTS "profiles_userId_fkey"
      `);
      
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      `);

      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_agentId_fkey"
      `);
      
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "clients" ADD CONSTRAINT "clients_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      `);

      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "timelines" DROP CONSTRAINT IF EXISTS "timelines_agentId_fkey"
      `);
      
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "timelines" ADD CONSTRAINT "timelines_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
      `);

      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "timelines" DROP CONSTRAINT IF EXISTS "timelines_clientId_fkey"
      `);
      
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "timelines" ADD CONSTRAINT "timelines_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE
      `);

      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "properties" DROP CONSTRAINT IF EXISTS "properties_timelineId_fkey"
      `);
      
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "properties" ADD CONSTRAINT "properties_timelineId_fkey" FOREIGN KEY ("timelineId") REFERENCES "timelines"("id") ON DELETE CASCADE ON UPDATE CASCADE
      `);

      return {
        status: 'success',
        message: 'Complete Property Sync database created: users, profiles, clients, timelines, properties',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Database initialization error:', error);
      return {
        status: 'error',
        error: error.message,
        message: 'Failed to initialize database'
      };
    }
  }
}
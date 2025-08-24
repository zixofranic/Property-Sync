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
      console.log('Running Prisma schema push to create all tables...');
      
      // Create only users table first to test basic registration
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

      await this.prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email")
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "users_verificationToken_key" ON "users"("verificationToken")
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "users_resetToken_key" ON "users"("resetToken")
      `);

      return {
        status: 'success',
        message: 'Basic database tables created successfully - users table ready',
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
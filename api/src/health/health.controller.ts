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
}
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  /**
   * Get the frontend URL for sharing links
   * In development: Uses environment variable or localhost
   * In production: Must be set to actual domain
   */
  getFrontendUrl(): string {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');

    // In production, FRONTEND_URL must be set to actual domain
    if (nodeEnv === 'production') {
      if (!frontendUrl || frontendUrl.includes('localhost')) {
        throw new Error(
          'FRONTEND_URL must be set to your actual domain in production'
        );
      }
      return frontendUrl;
    }

    // In development, provide helpful fallback
    return frontendUrl || 'http://localhost:3000';
  }

  /**
   * Generate a shareable timeline URL
   */
  getTimelineShareUrl(shareToken: string, clientCode: string): string {
    const baseUrl = this.getFrontendUrl();
    return `${baseUrl}/timeline/${shareToken}?client=${clientCode}`;
  }

  /**
   * Generate email verification URL
   */
  getEmailVerificationUrl(token: string): string {
    const baseUrl = this.getFrontendUrl();
    return `${baseUrl}/verify-email?token=${token}`;
  }

  /**
   * Get dashboard URL
   */
  getDashboardUrl(): string {
    const baseUrl = this.getFrontendUrl();
    return `${baseUrl}/dashboard`;
  }

  /**
   * Check if running in development mode
   */
  isDevelopment(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'development';
  }

  /**
   * Check if running in production mode
   */
  isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }
}
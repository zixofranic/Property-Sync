import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { ClientSessionGuard } from './client-session.guard';

/**
 * PHASE 1 - AUTH BRIDGE: HybridAuthGuard
 *
 * Combines JWT authentication (for agents) and ClientSession authentication (for clients).
 * Tries JWT first, falls back to ClientSession if JWT fails.
 *
 * This allows endpoints to accept both agent JWT tokens AND client session tokens.
 *
 * Usage: Apply to endpoints that should be accessible by both agents and clients
 * Example: @UseGuards(HybridAuthGuard)
 */
@Injectable()
export class HybridAuthGuard implements CanActivate {
  private readonly logger = new Logger('HybridAuthGuard');

  constructor(
    private jwtGuard: JwtAuthGuard,
    private clientSessionGuard: ClientSessionGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Check which auth method is being used
    const hasJwtToken = !!request.headers.authorization?.startsWith('Bearer ');
    const hasSessionToken = !!(request.headers['x-session-token'] || request.headers['x-client-session-token']);

    this.logger.log(`🔐 HYBRID AUTH: hasJWT=${hasJwtToken}, hasSession=${hasSessionToken}`);

    // Try JWT authentication first (for agents)
    if (hasJwtToken) {
      try {
        this.logger.log('🔐 HYBRID AUTH: Attempting JWT authentication...');
        const result = await this.jwtGuard.canActivate(context);
        if (result) {
          this.logger.log('✅ HYBRID AUTH: JWT authentication successful (AGENT)');
          return true;
        }
      } catch (error) {
        this.logger.log('⚠️ HYBRID AUTH: JWT authentication failed, trying client session...');
        // JWT failed, try client session next
      }
    }

    // Try client session authentication (for clients)
    if (hasSessionToken) {
      try {
        this.logger.log('🔐 HYBRID AUTH: Attempting client session authentication...');
        const result = await this.clientSessionGuard.canActivate(context);
        if (result) {
          this.logger.log('✅ HYBRID AUTH: Client session authentication successful (CLIENT)');
          return true;
        }
      } catch (error) {
        this.logger.log('⚠️ HYBRID AUTH: Client session authentication failed');
        // Both failed, throw error below
      }
    }

    // Both authentication methods failed
    this.logger.warn('❌ HYBRID AUTH: All authentication methods failed');
    throw new UnauthorizedException('Authentication required - provide either JWT token or client session token');
  }
}

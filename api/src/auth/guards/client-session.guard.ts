import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * PHASE 1 - AUTH BRIDGE: ClientSessionGuard
 *
 * Custom authentication guard for client HTTP requests.
 * Validates client session tokens stored in ClientAuth table.
 *
 * Clients use sessionToken (not JWT) for authentication.
 * This guard bridges the gap between client auth and REST API endpoints.
 *
 * Usage: Apply to endpoints that accept client authentication
 */
@Injectable()
export class ClientSessionGuard implements CanActivate {
  private readonly logger = new Logger('ClientSessionGuard');

  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Extract session token from header
    const sessionToken = request.headers['x-session-token'] ||
                        request.headers['x-client-session-token'];

    if (!sessionToken) {
      this.logger.warn('❌ CLIENT AUTH: No session token provided in headers');
      throw new UnauthorizedException('Client session token required');
    }

    try {
      this.logger.log(`🔐 CLIENT AUTH: Validating session token: ${sessionToken.substring(0, 10)}...`);

      // Validate session token against ClientAuth table
      const clientAuth = await this.prisma.clientAuth.findUnique({
        where: {
          sessionToken,
          isActive: true, // Only allow active sessions
        },
        include: {
          timeline: {
            include: {
              client: true, // Get the actual Client record
            },
          },
        },
      });

      if (!clientAuth) {
        this.logger.warn(`❌ CLIENT AUTH: Invalid or inactive session token`);
        throw new UnauthorizedException('Invalid or expired session token');
      }

      // Check if session is stale (>30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      if (clientAuth.lastAccess < thirtyDaysAgo) {
        this.logger.warn(`❌ CLIENT AUTH: Session token expired (>30 days old)`);
        throw new UnauthorizedException('Session token expired - please log in again');
      }

      // Get client ID from timeline
      const clientId = clientAuth.timeline.client?.id;

      if (!clientId) {
        this.logger.error(`❌ CLIENT AUTH: No client found for timeline: ${clientAuth.timelineId}`);
        throw new UnauthorizedException('Client not found for this timeline');
      }

      this.logger.log(`✅ CLIENT AUTH: Validated client ${clientId} for timeline ${clientAuth.timelineId}`);

      // Inject client information into request.user (matching AuthenticatedRequest interface)
      request.user = {
        id: clientId,
        userType: 'CLIENT' as const,
        timelineId: clientAuth.timelineId,
        sessionToken: sessionToken, // Include for potential future use
      };

      // Update last access time (fire-and-forget, don't await)
      this.prisma.clientAuth.update({
        where: { id: clientAuth.id },
        data: { lastAccess: new Date() },
      }).catch((error) => {
        this.logger.warn(`Failed to update lastAccess for client ${clientId}:`, error);
      });

      return true;

    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error; // Re-throw our custom exceptions
      }

      this.logger.error(`❌ CLIENT AUTH: Validation error:`, error);
      throw new UnauthorizedException('Client authentication failed');
    }
  }
}

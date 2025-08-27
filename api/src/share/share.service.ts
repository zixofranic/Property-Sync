import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { ClientLoginDto } from './dto/client-login.dto';
import { ClientSessionDto } from './dto/client-session.dto';

@Injectable()
export class ShareService {
  constructor(
    private prisma: PrismaService,
    private analyticsService: AnalyticsService,
  ) {}

  // Client authentication with firstName + last 4 phone digits
  async authenticateClient(
    shareToken: string,
    clientLoginDto: ClientLoginDto,
    request?: any,
  ): Promise<ClientSessionDto> {
    // Find timeline by share token
    const timeline = await this.prisma.timeline.findUnique({
      where: { shareToken },
      include: {
        client: true,
        agent: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!timeline || !timeline.isActive) {
      throw new NotFoundException('Timeline not found or no longer active');
    }

    // Validate client credentials
    const client = timeline.client;
    const isValidName = this.validateClientName(
      clientLoginDto.clientName,
      client.firstName,
    );
    const isValidPhone = this.validatePhoneLastFour(
      clientLoginDto.phoneLastFour,
      client.phone || undefined,
    );

    if (!isValidName || !isValidPhone) {
      // Track failed login attempt
      await this.analyticsService.trackEvent(
        shareToken,
        {
          eventType: 'auth_failed',
          metadata: {
            attemptedName: clientLoginDto.clientName,
            reason: !isValidName ? 'invalid_name' : 'invalid_phone',
          },
        },
        request,
      );

      throw new UnauthorizedException('Invalid client credentials');
    }

    // Check for existing active session
    const existingAuth = await this.prisma.clientAuth.findFirst({
      where: {
        timelineId: timeline.id,
        clientName: clientLoginDto.clientName,
        isActive: true,
      },
    });

    let finalAuth;

    if (existingAuth) {
      // Update existing session
      finalAuth = await this.prisma.clientAuth.update({
        where: { id: existingAuth.id },
        data: { lastAccess: new Date() },
      });
    } else {
      // Create new session
      finalAuth = await this.prisma.clientAuth.create({
        data: {
          clientName: clientLoginDto.clientName,
          phoneLastFour: clientLoginDto.phoneLastFour,
          timelineId: timeline.id,
        },
      });
    }

    // Track successful login
    await this.analyticsService.trackEvent(
      shareToken,
      {
        eventType: 'client_login',
        metadata: {
          clientName: clientLoginDto.clientName,
          sessionId: finalAuth.sessionToken,
        },
      },
      request,
    );

    return {
      sessionToken: finalAuth.sessionToken,
      clientName: finalAuth.clientName,
      timelineId: timeline.id,
      shareToken: timeline.shareToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    };
  }

  // Get timeline data for authenticated client
  async getClientTimeline(shareToken: string, sessionToken?: string) {
    // Find timeline
    const timeline = await this.prisma.timeline.findUnique({
      where: { shareToken },
      include: {
        client: true,
        agent: {
          include: {
            profile: true,
          },
        },
        properties: {
          where: { isQueued: false }, // Only show sent properties
          include: {
            feedback: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!timeline || !timeline.isActive) {
      throw new NotFoundException('Timeline not found or no longer active');
    }

    // If session token provided, validate it
    let authenticatedClient: any = null;
    if (sessionToken) {
      const authRecord = await this.prisma.clientAuth.findFirst({
        where: {
          sessionToken,
          timelineId: timeline.id,
          isActive: true,
        },
      });

      if (authRecord) {
        // Update last access
        await this.prisma.clientAuth.update({
          where: { id: authRecord.id },
          data: { lastAccess: new Date() },
        });
        authenticatedClient = authRecord;
      }
    }

    // Format response
    return {
      timeline: {
        id: timeline.id,
        title: timeline.title,
        description: timeline.description,
        shareToken: timeline.shareToken,
        totalViews: timeline.totalViews,
        lastViewed: timeline.lastViewed,
      },
      client: {
        firstName: timeline.client.firstName,
        lastName: timeline.client.lastName,
        email: timeline.client.email,
      },
      agent: {
        firstName: timeline.agent.profile?.firstName,
        lastName: timeline.agent.profile?.lastName,
        name: timeline.agent.profile
          ? `${timeline.agent.profile.firstName} ${timeline.agent.profile.lastName}`
          : 'Your Agent',
        company: timeline.agent.profile?.company,
        phone: timeline.agent.profile?.phone,
        email: timeline.agent.email,
        avatar: timeline.agent.profile?.avatar,
        logo: timeline.agent.profile?.logo,
        brandColor: timeline.agent.profile?.brandColor,
        yearsExperience: timeline.agent.profile?.yearsExperience,
        specialties: timeline.agent.profile?.specialties,
        bio: timeline.agent.profile?.bio,
        license: timeline.agent.profile?.licenseNumber,
        website: timeline.agent.profile?.website,
      },
      properties: timeline.properties.map((property) => ({
        id: property.id,
        mlsId: property.mlsId,
        address: property.address,
        city: property.city,
        state: property.state,
        zipCode: property.zipCode,
        price: property.price,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        squareFootage: property.squareFootage,
        propertyType: property.propertyType,
        description: property.description,
        imageUrls: property.imageUrls,
        listingUrl: property.listingUrl,
        isViewed: property.isViewed,
        viewedAt: property.viewedAt,
        createdAt: property.createdAt,
        feedback: property.feedback.map((fb) => ({
          id: fb.id,
          feedback: fb.feedback,
          notes: fb.notes,
          createdAt: fb.createdAt,
        })),
      })),
      isAuthenticated: !!authenticatedClient,
      authRequired: this.isAuthRequired(timeline),
    };
  }

  // Submit property feedback
  async submitPropertyFeedback(
    shareToken: string,
    propertyId: string,
    feedbackData: {
      feedback: 'love' | 'like' | 'dislike';
      notes?: string;
      clientName: string;
      clientEmail: string;
    },
    request?: any,
  ) {
    // Verify timeline and property exist
    const timeline = await this.prisma.timeline.findUnique({
      where: { shareToken },
      include: {
        properties: {
          where: { id: propertyId },
        },
      },
    });

    if (!timeline || timeline.properties.length === 0) {
      throw new NotFoundException('Property not found in timeline');
    }

    const property = timeline.properties[0];

    // Create feedback record
    const feedback = await this.prisma.feedback.create({
      data: {
        feedback: feedbackData.feedback,
        notes: feedbackData.notes,
        clientName: feedbackData.clientName,
        clientEmail: feedbackData.clientEmail,
        propertyId: property.id,
        clientId: timeline.clientId,
        respondedAt: new Date(),
      },
    });

    // Track feedback submission
    await this.analyticsService.trackEvent(
      shareToken,
      {
        eventType: 'feedback_submit',
        propertyId: property.id,
        metadata: {
          feedbackType: feedbackData.feedback, // ✅ CORRECT - use 'feedback' field
          hasNotes: !!feedbackData.notes,
          clientName: feedbackData.clientName,
        },
      },
      request,
    );

    return feedback;
  }

  // Revoke timeline access (Agent only)
  async revokeAccess(
    agentId: string,
    shareToken: string,
  ): Promise<{ message: string }> {
    // Verify agent owns this timeline
    const timeline = await this.prisma.timeline.findFirst({
      where: {
        shareToken,
        agentId,
      },
    });

    if (!timeline) {
      throw new NotFoundException('Timeline not found');
    }

    // Deactivate timeline and all client sessions
    await this.prisma.$transaction([
      this.prisma.timeline.update({
        where: { id: timeline.id },
        data: { isActive: false },
      }),
      this.prisma.clientAuth.updateMany({
        where: { timelineId: timeline.id },
        data: { isActive: false },
      }),
    ]);

    return { message: 'Timeline access revoked successfully' };
  }

  // Get sharing statistics (Agent only)
  async getShareStats(agentId: string, shareToken: string) {
    // Verify agent owns this timeline
    const timeline = await this.prisma.timeline.findFirst({
      where: {
        shareToken,
        agentId,
      },
      include: {
        _count: {
          select: {
            clientAuth: true,
            analytics: true,
          },
        },
      },
    });

    if (!timeline) {
      throw new NotFoundException('Timeline not found');
    }

    // Get recent activity (last 7 days)
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentActivity = await this.prisma.clientAnalytics.findMany({
      where: {
        timelineId: timeline.id,
        timestamp: { gte: lastWeek },
      },
      orderBy: { timestamp: 'desc' },
      take: 20,
    });

    // Get feedback summary
    const feedbackSummary = await this.prisma.feedback.groupBy({
      by: ['feedback'],
      where: {
        property: {
          timelineId: timeline.id,
        },
      },
      _count: { feedback: true },
    });

    return {
      timeline: {
        id: timeline.id,
        title: timeline.title,
        shareToken: timeline.shareToken,
        totalViews: timeline.totalViews,
        lastViewed: timeline.lastViewed,
        isActive: timeline.isActive,
      },
      stats: {
        totalSessions: timeline._count.clientAuth,
        totalEvents: timeline._count.analytics,
        recentActivity: recentActivity.length,
        feedbackSummary: {
          love:
            feedbackSummary.find((f) => f.feedback === 'love')?._count
              .feedback || 0,
          like:
            feedbackSummary.find((f) => f.feedback === 'like')?._count
              .feedback || 0,
          dislike:
            feedbackSummary.find((f) => f.feedback === 'dislike')?._count
              .feedback || 0,
        },
      },
      recentActivity: recentActivity.map((activity) => ({
        eventType: activity.eventType,
        timestamp: activity.timestamp,
        metadata: activity.metadata,
      })),
    };
  }

  // Validate client session
  async validateClientSession(sessionToken: string): Promise<boolean> {
    const clientAuth = await this.prisma.clientAuth.findUnique({
      where: { sessionToken },
    });

    if (!clientAuth || !clientAuth.isActive) {
      return false;
    }

    // Check if session is still valid (30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (clientAuth.lastAccess < thirtyDaysAgo) {
      // Deactivate expired session
      await this.prisma.clientAuth.update({
        where: { id: clientAuth.id },
        data: { isActive: false },
      });
      return false;
    }

    return true;
  }

  // Helper methods
  private validateClientName(
    inputName: string,
    actualFirstName: string,
  ): boolean {
    const cleanInput = inputName
      .toLowerCase()
      .trim()
      .replace(/[^a-z]/g, '');
    const cleanActual = actualFirstName
      .toLowerCase()
      .trim()
      .replace(/[^a-z]/g, '');

    // Allow exact match or partial match (minimum 3 characters)
    return (
      cleanInput === cleanActual ||
      (cleanInput.length >= 3 && cleanActual.startsWith(cleanInput))
    );
  }

  private validatePhoneLastFour(
    inputDigits: string,
    actualPhone?: string,
  ): boolean {
    if (!actualPhone) {
      // If no phone number stored, be more lenient
      return inputDigits.length === 4 && /^\d{4}$/.test(inputDigits);
    }

    const phoneDigits = actualPhone.replace(/[^\d]/g, '');
    const lastFour = phoneDigits.slice(-4);

    return inputDigits === lastFour;
  }

  private isAuthRequired(timeline: any): boolean {
    // For now, always require auth for security
    // Could be made configurable per agent in the future
    return true;
  }
}

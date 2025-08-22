import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackEventDto } from './dto/track-event.dto';
import { AnalyticsResponseDto } from './dto/analytics-response.dto';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  // Track client events (called from client timeline)
  async trackEvent(
    shareToken: string,
    trackEventDto: TrackEventDto,
    request?: any,
  ) {
    // Verify timeline exists
    const timeline = await this.prisma.timeline.findUnique({
      where: { shareToken },
    });

    if (!timeline) {
      throw new NotFoundException('Timeline not found');
    }

    // Extract IP and user agent for analytics
    const ipAddress = request?.ip || request?.connection?.remoteAddress;
    const userAgent = request?.headers?.['user-agent'];

    // Create analytics record
    const analyticsRecord = await this.prisma.clientAnalytics.create({
      data: {
        timelineId: timeline.id,
        eventType: trackEventDto.eventType,
        propertyId: trackEventDto.propertyId || null,
        metadata: {
          ...trackEventDto.metadata,
          ipAddress,
          userAgent,
        },
        timestamp: new Date(),
      },
    });

    // Update timeline view count if it's a timeline view
    if (trackEventDto.eventType === 'timeline_view') {
      await this.prisma.timeline.update({
        where: { id: timeline.id },
        data: {
          totalViews: { increment: 1 },
          lastViewed: new Date(),
        },
      });
    }

    // Update property view count if it's a property view
    if (
      trackEventDto.eventType === 'property_view' &&
      trackEventDto.propertyId
    ) {
      await this.prisma.property.update({
        where: { id: trackEventDto.propertyId },
        data: {
          isViewed: true,
          viewedAt: new Date(),
        },
      });
    }

    return analyticsRecord;
  }

  // Get recent activity for agent dashboard (REST polling)
  async getAgentRecentActivity(
    agentId: string,
    since?: Date,
  ): Promise<AnalyticsResponseDto[]> {
    const sinceDate = since || new Date(Date.now() - 300000); // Last 5 minutes by default

    const recentActivity = await this.prisma.clientAnalytics.findMany({
      where: {
        timeline: {
          agentId,
        },
        timestamp: {
          gte: sinceDate,
        },
      },
      include: {
        timeline: {
          include: {
            client: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: 50, // Limit for performance
    });

    return recentActivity.map(this.formatAnalyticsResponse);
  }

  // Get specific client activity
  async getClientActivity(
    agentId: string,
    clientId: string,
    limit = 20,
  ): Promise<AnalyticsResponseDto[]> {
    const timeline = await this.prisma.timeline.findFirst({
      where: {
        clientId,
        agentId,
      },
    });

    if (!timeline) {
      throw new NotFoundException('Client timeline not found');
    }

    const activity = await this.prisma.clientAnalytics.findMany({
      where: {
        timelineId: timeline.id,
      },
      include: {
        timeline: {
          include: {
            client: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: limit,
    });

    return activity.map(this.formatAnalyticsResponse);
  }

  // Get dashboard stats for Mission Control
  async getDashboardStats(agentId: string) {
    // Get all timelines for this agent
    const timelines = await this.prisma.timeline.findMany({
      where: { agentId },
      include: {
        client: true,
        _count: {
          select: {
            properties: true,
            analytics: true,
          },
        },
      },
    });

    // Get recent activity (last 24 hours)
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentActivity = await this.prisma.clientAnalytics.count({
      where: {
        timeline: {
          agentId,
        },
        timestamp: {
          gte: last24Hours,
        },
      },
    });

    // Get feedback stats
    const feedbackStats = await this.prisma.feedback.groupBy({
      by: ['feedback'],
      where: {
        property: {
          timeline: {
            agentId,
          },
        },
        createdAt: {
          gte: last24Hours,
        },
      },
      _count: {
        feedback: true,
      },
    });

    return {
      totalClients: timelines.length,
      totalProperties: timelines.reduce(
        (sum, t) => sum + t._count.properties,
        0,
      ),
      totalViews: timelines.reduce((sum, t) => sum + t.totalViews, 0),
      recentActivity,
      feedbackStats: {
        love:
          feedbackStats.find((f) => f.feedback === 'love')?._count.feedback ||
          0,
        like:
          feedbackStats.find((f) => f.feedback === 'like')?._count.feedback ||
          0,
        dislike:
          feedbackStats.find((f) => f.feedback === 'dislike')?._count
            .feedback || 0,
      },
      activeTimelines: timelines.filter(
        (t) => t.lastViewed && t.lastViewed > last24Hours,
      ).length,
    };
  }

  // Get timeline stats for client view
  async getTimelineStats(shareToken: string) {
    const timeline = await this.prisma.timeline.findUnique({
      where: { shareToken },
      include: {
        _count: {
          select: {
            properties: true,
            analytics: true,
          },
        },
      },
    });

    if (!timeline) {
      throw new NotFoundException('Timeline not found');
    }

    return {
      totalViews: timeline.totalViews,
      totalProperties: timeline._count.properties,
      lastViewed: timeline.lastViewed,
    };
  }

  // Helper method to format analytics response
  private formatAnalyticsResponse = (analytics: any): AnalyticsResponseDto => {
    return {
      id: analytics.id,
      eventType: analytics.eventType,
      propertyId: analytics.propertyId,
      timestamp: analytics.timestamp,
      clientName: analytics.timeline?.client
        ? `${analytics.timeline.client.firstName} ${analytics.timeline.client.lastName}`
        : 'Unknown Client',
      metadata: analytics.metadata,
    };
  };
}

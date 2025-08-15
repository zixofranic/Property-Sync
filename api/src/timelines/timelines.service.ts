import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PropertyResponseDto } from './dto/property-response.dto';
import { PropertyFeedbackDto } from './dto/property-feedback.dto';

@Injectable()
export class TimelinesService {
  constructor(private prisma: PrismaService) {}

  // 🔄 UPDATED: Frontend-compatible timeline response
  async getTimelineByShareToken(shareToken: string, clientCode?: string) {
    const timeline = await this.prisma.timeline.findUnique({
      where: { shareToken },
      include: {
        client: true,
        agent: {
          include: { profile: true }
        },
        properties: {
          orderBy: { position: 'asc' },
          include: {
            feedback: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!timeline || !timeline.isActive) {
      throw new NotFoundException('Timeline not found or inactive');
    }

    // If client code provided, validate it
    if (clientCode) {
      const expectedClientCode = this.generateClientLoginCode(
        timeline.client.firstName,
        timeline.client.phone || undefined
      );
      
      if (clientCode.toLowerCase() !== expectedClientCode.toLowerCase()) {
        throw new UnauthorizedException('Invalid client access code');
      }

      // Track timeline view
      await this.trackTimelineView(timeline.id);
    }

    // 🆕 RETURN FRONTEND-COMPATIBLE FORMAT
    return {
      id: timeline.id,
      title: timeline.title,
      description: timeline.description,
      shareToken: timeline.shareToken,
      isPublic: timeline.isActive, // Frontend expects isPublic
      totalViews: timeline.totalViews,
      lastViewed: timeline.lastViewed?.toISOString(),
      createdAt: timeline.createdAt.toISOString(),
      updatedAt: timeline.updatedAt.toISOString(),
      
      client: {
        id: timeline.client.id,
        firstName: timeline.client.firstName,
        lastName: timeline.client.lastName,
        name: `${timeline.client.firstName} ${timeline.client.lastName}`.trim(), // 🆕 Combined name
      },
      
      agent: {
        firstName: timeline.agent.profile?.firstName || '',
        lastName: timeline.agent.profile?.lastName || '',
        company: timeline.agent.profile?.company || '',
        brandColor: timeline.agent.profile?.brandColor || '#0ea5e9',
        logo: timeline.agent.profile?.logo,
      },
      
      // 🆕 FRONTEND-COMPATIBLE PROPERTIES
      properties: timeline.properties.map(property => 
        this.formatPropertyResponse(property, timeline.client.id)
      ),
    };
  }

  async validateClientAccess(shareToken: string, clientCode: string) {
    const timeline = await this.prisma.timeline.findUnique({
      where: { shareToken },
      include: { client: true },
    });

    if (!timeline) {
      throw new NotFoundException('Timeline not found');
    }

    const expectedClientCode = this.generateClientLoginCode(
      timeline.client.firstName,
      timeline.client.phone || undefined
    );

    const isValid = clientCode.toLowerCase() === expectedClientCode.toLowerCase();

    return {
      valid: isValid,
      clientName: isValid ? `${timeline.client.firstName} ${timeline.client.lastName}` : null,
    };
  }

  // 🆕 NEW METHOD: Get Timeline for Agent (Backend Integration)
  async getAgentTimeline(agentId: string, clientId: string) {
    const timeline = await this.prisma.timeline.findFirst({
      where: { 
        agentId,
        clientId,
        isActive: true 
      },
      include: {
        properties: {
          orderBy: { position: 'asc' },
          include: {
            feedback: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!timeline) {
      // Return empty timeline structure for frontend
      return {
        id: null,
        clientId,
        properties: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        shareToken: null,
        isPublic: false,
      };
    }

    // Return in frontend format
    return {
      id: timeline.id,
      clientId: timeline.clientId,
      properties: timeline.properties.map(property => 
        this.formatPropertyResponse(property, clientId)
      ),
      createdAt: timeline.createdAt.toISOString(),
      updatedAt: timeline.updatedAt.toISOString(),
      shareToken: timeline.shareToken,
      isPublic: timeline.isActive,
    };
  }

  // 🆕 NEW METHOD: Add Property to Timeline (Backend Integration)
  async addPropertyToTimeline(agentId: string, timelineId: string, propertyData: any) {
    // Verify timeline ownership
    const timeline = await this.prisma.timeline.findFirst({
      where: { id: timelineId, agentId },
    });

    if (!timeline) {
      throw new NotFoundException('Timeline not found');
    }

    // Get next position
    const lastProperty = await this.prisma.property.findFirst({
      where: { timelineId },
      orderBy: { position: 'desc' },
    });

    const newProperty = await this.prisma.property.create({
      data: {
    address: propertyData.address,
    price: propertyData.price,
    description: propertyData.description,
    imageUrls: [propertyData.imageUrl], // Store as array
    listingUrl: propertyData.mlsLink || null, // Map mlsLink to listingUrl
    timelineId,
    position: (lastProperty?.position || 0) + 1,
    },
    });

    // Return in frontend format
    return this.formatPropertyResponse(newProperty, timeline.clientId);
  }

  // 🆕 UPDATE PROPERTY
  async updateProperty(agentId: string, propertyId: string, updateData: any) {
    // Verify property ownership through timeline
    const property = await this.prisma.property.findFirst({
      where: { 
        id: propertyId,
        timeline: { agentId }
      },
      include: {
        timeline: true,
        feedback: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const updatedProperty = await this.prisma.property.update({
      where: { id: propertyId },
      data: updateData,
      include: {
        feedback: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return this.formatPropertyResponse(updatedProperty, property.timeline.clientId);
  }

  // 🆕 DELETE PROPERTY
  async deleteProperty(agentId: string, propertyId: string) {
    // Verify property ownership through timeline
    const property = await this.prisma.property.findFirst({
      where: { 
        id: propertyId,
        timeline: { agentId }
      },
      include: { timeline: true },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Hard delete
    await this.prisma.property.delete({
      where: { id: propertyId },
    });

    return { 
      message: 'Property deleted successfully',
      propertyId,
      address: property.address 
    };
  }

  // 🆕 SUBMIT PROPERTY FEEDBACK
  async submitPropertyFeedback(
    shareToken: string, 
    propertyId: string, 
    feedbackDto: PropertyFeedbackDto, 
    clientCode?: string
  ) {
    // Verify timeline exists and client access
    const timeline = await this.prisma.timeline.findUnique({
      where: { shareToken },
      include: { client: true },
    });

    if (!timeline || !timeline.isActive) {
      throw new NotFoundException('Timeline not found or inactive');
    }

    // Validate client access if code provided
    if (clientCode) {
      const expectedClientCode = this.generateClientLoginCode(
        timeline.client.firstName,
        timeline.client.phone || undefined
      );
      
      if (clientCode.toLowerCase() !== expectedClientCode.toLowerCase()) {
        throw new UnauthorizedException('Invalid client access code');
      }
    }

    // Verify property belongs to this timeline
    const property = await this.prisma.property.findFirst({
      where: { 
        id: propertyId,
        timelineId: timeline.id 
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found in this timeline');
    }

    // Create or update feedback
    const feedback = await this.prisma.feedback.upsert({
      where: {
      propertyId_clientId: {
        propertyId,
        clientId: timeline.clientId,
      },
    },
      update: {
        feedback: feedbackDto.feedback,
        notes: feedbackDto.notes,
        updatedAt: new Date(),
      },
      create: {
        propertyId,
        clientId: timeline.clientId,
        feedback: feedbackDto.feedback,
        notes: feedbackDto.notes,
        clientName: `${timeline.client.firstName} ${timeline.client.lastName}`,
        clientEmail: timeline.client.email,
      },
    });

    // Update client engagement metrics
    await this.updateClientEngagement(timeline.clientId, feedbackDto.feedback);

    // Track analytics event
    await this.trackAnalyticsEvent(timeline.clientId, 'property_feedback', {
      propertyId,
      feedback: feedbackDto.feedback,
      hasNotes: !!feedbackDto.notes,
    });

    return {
      message: 'Feedback submitted successfully',
      feedback: {
        id: feedback.id,
        feedback: feedback.feedback,
        notes: feedback.notes,
        createdAt: feedback.createdAt.toISOString(),
      },
    };
  }

  // 🆕 SEND TIMELINE EMAIL
  async sendTimelineEmail(agentId: string, timelineId: string) {
    const timeline = await this.prisma.timeline.findFirst({
      where: { 
        id: timelineId, 
        agentId 
      },
      include: {
        client: true,
        agent: {
          include: { profile: true }
        },
        properties: true,
      },
    });

    if (!timeline) {
      throw new NotFoundException('Timeline not found');
    }

    const clientLoginCode = this.generateClientLoginCode(
      timeline.client.firstName,
      timeline.client.phone || undefined
    );

    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/timeline/${timeline.shareToken}?client=${clientLoginCode}`;

    // TODO: Integrate with your email service (Resend, etc.)
    // For now, return success with email details
    const emailData = {
      to: timeline.client.email,
      spouseTo: timeline.client.spouseEmail, // 🆕 Spouse email support
      subject: `${timeline.agent.profile?.firstName || 'Your Agent'} sent you ${timeline.properties.length} properties`,
      shareUrl,
      clientCode: clientLoginCode,
      propertyCount: timeline.properties.length,
      agentName: `${timeline.agent.profile?.firstName || ''} ${timeline.agent.profile?.lastName || ''}`.trim(),
      companyName: timeline.agent.profile?.company || '',
    };

    // Track email sent
    await this.trackAnalyticsEvent(timeline.clientId, 'timeline_email_sent', {
      timelineId,
      propertyCount: timeline.properties.length,
      hasSpouseEmail: !!timeline.client.spouseEmail,
    });

    return {
      message: 'Timeline email sent successfully',
      sentTo: timeline.client.email,
      spouseSentTo: timeline.client.spouseEmail,
      propertyCount: timeline.properties.length,
      shareUrl,
    };
  }

  // 🆕 REVOKE TIMELINE ACCESS
  async revokeTimelineAccess(agentId: string, timelineId: string) {
    const timeline = await this.prisma.timeline.findFirst({
      where: { 
        id: timelineId, 
        agentId 
      },
    });

    if (!timeline) {
      throw new NotFoundException('Timeline not found');
    }

    // Generate new share token to invalidate old links
    const newShareToken = await this.prisma.timeline.update({
      where: { id: timelineId },
      data: {
        shareToken: this.generateNewShareToken(),
      },
    });

    return {
      message: 'Timeline access revoked successfully',
      newShareToken: newShareToken.shareToken,
    };
  }

  // 🆕 CHECK MLS DUPLICATE
  async checkMLSDuplicate(agentId: string, clientId: string, mlsLink: string): Promise<boolean> {
    if (!mlsLink) return false;

    const existingProperty = await this.prisma.property.findFirst({
      where: {
        listingUrl: mlsLink,
        timeline: {
          agentId,
          clientId,
        },
      },
    });

    return !!existingProperty;
  }

  // 🔧 PRIVATE HELPER METHODS

  // 🆕 PROPERTY TRANSFORMATION METHOD
  private formatPropertyResponse(property: any, clientId: string): PropertyResponseDto {
    // Combine address parts into single string (frontend format)
    const addressParts = [
      property.address,
      property.city,
      property.state,
      property.zipCode
    ].filter(Boolean);
    const combinedAddress = addressParts.join(', ');

    // Get primary image (first in array)
    const primaryImage = Array.isArray(property.imageUrls) && property.imageUrls.length > 0
      ? property.imageUrls[0]
      : property.imageUrl || '/api/placeholder/400/300';

    // Format latest feedback
    const latestFeedback = property.feedback && property.feedback.length > 0 
      ? property.feedback[0] 
      : null;

    return {
      id: property.id,
      clientId: clientId,

      // 🆕 FRONTEND-COMPATIBLE FIELDS
      address: combinedAddress,
      price: property.price,
      description: property.description,
      imageUrl: primaryImage,
      mlsLink: property.listingUrl || undefined,
      addedAt: property.createdAt.toISOString(),
      clientFeedback: latestFeedback?.feedback || undefined,
      notes: latestFeedback?.notes || undefined,
      isActive: true, // Frontend expects this

      // 🆕 ENHANCED BACKEND DATA (for future features)
      city: property.city || undefined,
      state: property.state || undefined,
      zipCode: property.zipCode || undefined,
      bedrooms: property.bedrooms || undefined,
      bathrooms: property.bathrooms || undefined,
      squareFootage: property.squareFootage || undefined,
      propertyType: property.propertyType || undefined,
      imageUrls: property.imageUrls || [primaryImage],
      listingUrl: property.listingUrl || undefined,
      isHighlighted: property.isHighlighted,
      position: property.position,
      isViewed: property.isViewed,
      viewedAt: property.viewedAt?.toISOString(),
      createdAt: property.createdAt.toISOString(),
      updatedAt: property.updatedAt.toISOString(),

      // 🆕 FEEDBACK DATA
      feedback: latestFeedback ? {
        id: latestFeedback.id,
        feedback: latestFeedback.feedback,
        notes: latestFeedback.notes || undefined,
        createdAt: latestFeedback.createdAt.toISOString(),
      } : undefined,
    };
  }

  private async trackTimelineView(timelineId: string) {
    await this.prisma.timeline.update({
      where: { id: timelineId },
      data: {
        totalViews: { increment: 1 },
        lastViewed: new Date(),
      },
    });
  }

  private generateClientLoginCode(firstName: string, phone?: string): string {
    const cleanFirstName = firstName.replace(/[^a-zA-Z]/g, '').toLowerCase();
    
    if (!phone) {
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      return `${cleanFirstName}${randomDigits}`;
    }

    const digits = phone.replace(/[^\d]/g, '');
    const lastFourDigits = digits.slice(-4) || '0000';
    
    return `${cleanFirstName}${lastFourDigits}`;
  }

  // Helper: Update client engagement metrics
  private async updateClientEngagement(clientId: string, feedback: string) {
    const engagementPoints = {
      love: 10,
      like: 5,
      dislike: 1, // Still engagement, just negative preference
    };

    await this.prisma.client.update({
      where: { id: clientId },
      data: {
        lastActivity: new Date(),
        // Increment engagement based on feedback type
        feedbackRate: {
          increment: engagementPoints[feedback as keyof typeof engagementPoints] || 0,
        },
      },
    });
  }

  // Helper: Track analytics events
  private async trackAnalyticsEvent(clientId: string, eventType: string, metadata: any) {
    await this.prisma.trackEvent.create({
      data: {
        clientId,
        eventType,
        metadata,
        timestamp: new Date(),
      },
    });
  }

  // Helper: Generate new share token
  private generateNewShareToken(): string {
    return require('crypto').randomBytes(16).toString('hex');
  }
}
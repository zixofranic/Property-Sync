import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService, TimelineEmailData } from '../email/email.service';
import { PropertyResponseDto } from './dto/property-response.dto';
import { PropertyFeedbackDto } from './dto/property-feedback.dto';

@Injectable()
export class TimelinesService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  // 📄 UPDATED: Frontend-compatible timeline response
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

    const newProperty = await this.prisma.property.create({
      data: {
        address: propertyData.address,
        price: propertyData.price,
        description: propertyData.description,
        imageUrls: [propertyData.imageUrl],
        listingUrl: propertyData.mlsLink || null,
        timelineId,
        position: (await this.getLastPropertyPosition(timelineId)) + 1,
      },
    });

    // Optional: Send immediate notification (can be made configurable)
    try {
      await this.sendPropertyNotification(agentId, newProperty.id);
    } catch (error) {
      // Don't fail the property creation if notification fails
      console.warn('Property notification failed:', error.message);
    }

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

  // 🆕 ENHANCED: Send Timeline Email with Complete Data Transformation
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
        properties: {
          where: { isQueued: false }, // Only count sent properties
        },
      },
    });

    if (!timeline) {
      throw new NotFoundException('Timeline not found');
    }

    // Build client login code for timeline access
    const clientLoginCode = this.generateClientLoginCode(
      timeline.client.firstName,
      timeline.client.phone || undefined
    );

    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/timeline/${timeline.shareToken}?client=${clientLoginCode}`;

    // Transform data for enhanced email service
    const emailData: TimelineEmailData = {
      clientEmail: timeline.client.email,
      clientName: `${timeline.client.firstName} ${timeline.client.lastName}`.trim(),
      agentName: timeline.agent.profile ? 
        `${timeline.agent.profile.firstName} ${timeline.agent.profile.lastName}`.trim() : 
        'Your Agent',
      agentCompany: timeline.agent.profile?.company || 'Real Estate Professional',
      timelineUrl: shareUrl,
      propertyCount: timeline.properties.length,
      spouseEmail: timeline.client.spouseEmail || undefined,
      agentPhoto: timeline.agent.profile?.logo || undefined,
      brandColor: timeline.agent.profile?.brandColor || '#3b82f6',
      templateStyle: (timeline.agent.profile?.emailTemplateStyle as 'modern' | 'classical') || 'modern',
    };

    try {
      // Use enhanced email service with Resend + fallback
      const emailResult = await this.emailService.sendTimelineEmail(emailData);
      
      if (emailResult.success) {
        // Track email sent in analytics
        await this.trackAnalyticsEvent(timeline.clientId, 'timeline_email_sent', {
          timelineId,
          propertyCount: timeline.properties.length,
          hasSpouseEmail: !!timeline.client.spouseEmail,
          emailProvider: emailResult.provider,
          messageId: emailResult.messageId,
        });

        return {
          message: 'Timeline email sent successfully',
          sentTo: timeline.client.email,
          spouseSentTo: timeline.client.spouseEmail,
          propertyCount: timeline.properties.length,
          shareUrl,
          provider: emailResult.provider,
          messageId: emailResult.messageId,
        };
      } else {
        throw new Error(emailResult.error || 'Email sending failed');
      }
    } catch (error) {
      // Log the error but don't expose internal details
      console.error('Timeline email failed:', error);
      throw new Error('Failed to send timeline email. Please try again.');
    }
  }

  // NEW: Send Property Update Notification
  async sendPropertyNotification(agentId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { 
        id: propertyId,
        timeline: { agentId }
      },
      include: {
        timeline: {
          include: {
            client: true,
            agent: { include: { profile: true } }
          }
        }
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const timeline = property.timeline;
    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/timeline/${timeline.shareToken}`;

    const notificationData = {
      clientEmail: timeline.client.email,
      clientName: `${timeline.client.firstName} ${timeline.client.lastName}`.trim(),
      agentName: timeline.agent.profile ? 
        `${timeline.agent.profile.firstName} ${timeline.agent.profile.lastName}`.trim() : 
        'Your Agent',
      propertyAddress: property.address,
      propertyPrice: property.price,
      propertyDescription: property.description || 'New property added to your timeline',
      propertyImageUrl: property.imageUrls[0] || '/api/placeholder/400/300',
      timelineUrl: shareUrl,
      spouseEmail: timeline.client.spouseEmail || undefined,
    };

    try {
      const emailResult = await this.emailService.sendPropertyNotification(notificationData);
      
      if (emailResult.success) {
        // Track notification sent
        await this.trackAnalyticsEvent(timeline.clientId, 'property_notification_sent', {
          propertyId,
          propertyAddress: property.address,
          emailProvider: emailResult.provider,
        });

        return {
          message: 'Property notification sent successfully',
          sentTo: timeline.client.email,
          propertyAddress: property.address,
          provider: emailResult.provider,
        };
      } else {
        throw new Error('Property notification failed');
      }
    } catch (error) {
      console.error('Property notification failed:', error);
      throw new Error('Failed to send property notification');
    }
  }

  // NEW: Send Feedback Reminder
  async sendFeedbackReminder(agentId: string, clientId: string) {
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, agentId },
      include: {
        agent: { include: { profile: true } },
        timelines: {
          include: {
            properties: {
              include: {
                feedback: true
              }
            }
          }
        }
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const timeline = client.timelines[0]; // Assuming one timeline per client
    if (!timeline) {
      throw new NotFoundException('No timeline found for client');
    }

    // Count properties without feedback
    const pendingPropertiesCount = timeline.properties.filter(
      property => property.feedback.length === 0
    ).length;

    if (pendingPropertiesCount === 0) {
      return {
        message: 'No pending feedback required',
        pendingCount: 0,
      };
    }

    // Calculate days since last activity
    const daysSinceLastActivity = client.lastActivity 
      ? Math.floor((Date.now() - new Date(client.lastActivity).getTime()) / (1000 * 60 * 60 * 24))
      : 30;

    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/timeline/${timeline.shareToken}`;

    const reminderData = {
      clientEmail: client.email,
      clientName: `${client.firstName} ${client.lastName}`.trim(),
      agentName: client.agent.profile ? 
        `${client.agent.profile.firstName} ${client.agent.profile.lastName}`.trim() : 
        'Your Agent',
      pendingPropertiesCount,
      timelineUrl: shareUrl,
      daysSinceLastActivity,
    };

    try {
      const emailResult = await this.emailService.sendFeedbackReminder(reminderData);
      
      if (emailResult.success) {
        // Track reminder sent
        await this.trackAnalyticsEvent(clientId, 'feedback_reminder_sent', {
          pendingPropertiesCount,
          daysSinceLastActivity,
          emailProvider: emailResult.provider,
        });

        return {
          message: 'Feedback reminder sent successfully',
          sentTo: client.email,
          pendingPropertiesCount,
          provider: emailResult.provider,
        };
      } else {
        throw new Error('Feedback reminder failed');
      }
    } catch (error) {
      console.error('Feedback reminder failed:', error);
      throw new Error('Failed to send feedback reminder');
    }
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

  // Helper: Get last property position
  private async getLastPropertyPosition(timelineId: string): Promise<number> {
    const lastProperty = await this.prisma.property.findFirst({
      where: { timelineId },
      orderBy: { position: 'desc' },
    });
    return lastProperty?.position || 0;
  }
}
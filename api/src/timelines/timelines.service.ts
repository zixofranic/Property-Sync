import { Injectable, NotFoundException, UnauthorizedException} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { PropertyResponseDto } from './dto/property-response.dto';
import { PropertyFeedbackDto } from './dto/property-feedback.dto';

@Injectable()
export class TimelinesService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  // Keep all existing methods unchanged until sendTimelineEmail
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

    if (clientCode) {
      const expectedClientCode = this.generateClientLoginCode(
        timeline.client.firstName,
        timeline.client.phone || undefined
      );
      
      if (clientCode.toLowerCase() !== expectedClientCode.toLowerCase()) {
        throw new UnauthorizedException('Invalid client access code');
      }

      await this.trackTimelineView(timeline.id);
    }

    return {
      id: timeline.id,
      title: timeline.title,
      description: timeline.description,
      shareToken: timeline.shareToken,
      isPublic: timeline.isActive,
      totalViews: timeline.totalViews,
      lastViewed: timeline.lastViewed?.toISOString(),
      createdAt: timeline.createdAt.toISOString(),
      updatedAt: timeline.updatedAt.toISOString(),
      
      client: {
        id: timeline.client.id,
        firstName: timeline.client.firstName,
        lastName: timeline.client.lastName,
        name: `${timeline.client.firstName} ${timeline.client.lastName}`.trim(),
      },
      
      agent: {
        firstName: timeline.agent.profile?.firstName || '',
        lastName: timeline.agent.profile?.lastName || '',
        company: timeline.agent.profile?.company || '',
        brandColor: timeline.agent.profile?.brandColor || '#0ea5e9',
        logo: timeline.agent.profile?.logo,
      },
      
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

  // FIXED: Property creation with corrected notification call
  async addPropertyToTimeline(agentId: string, timelineId: string, propertyData: any) {
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

    // FIXED: Correct method call with proper parameters
    try {
      await this.sendPropertyNotification(agentId, timelineId, newProperty.id);
    } catch (error) {
      console.warn('Property notification failed:', error.message);
    }

    return this.formatPropertyResponse(newProperty, timeline.clientId);
  }

  async updateProperty(agentId: string, propertyId: string, updateData: any) {
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

  async deleteProperty(agentId: string, propertyId: string) {
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

    await this.prisma.property.delete({
      where: { id: propertyId },
    });

    return { 
      message: 'Property deleted successfully',
      propertyId,
      address: property.address 
    };
  }

  async submitPropertyFeedback(
    shareToken: string, 
    propertyId: string, 
    feedbackDto: PropertyFeedbackDto, 
    clientCode?: string
  ) {
    const timeline = await this.prisma.timeline.findUnique({
      where: { shareToken },
      include: { client: true },
    });

    if (!timeline || !timeline.isActive) {
      throw new NotFoundException('Timeline not found or inactive');
    }

    if (clientCode) {
      const expectedClientCode = this.generateClientLoginCode(
        timeline.client.firstName,
        timeline.client.phone || undefined
      );
      
      if (clientCode.toLowerCase() !== expectedClientCode.toLowerCase()) {
        throw new UnauthorizedException('Invalid client access code');
      }
    }

    const property = await this.prisma.property.findFirst({
      where: { 
        id: propertyId,
        timelineId: timeline.id 
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found in this timeline');
    }

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

    await this.updateClientEngagement(timeline.clientId, feedbackDto.feedback);
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

  // FIXED: Send Timeline Email with proper error handling
  async sendTimelineEmail(
  agentId: string, 
  timelineId: string, 
  emailOptions?: { templateStyle?: 'modern' | 'classical' }
) {
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

  const agentProfile = timeline.agent.profile;
  const templateStyle: 'modern' | 'classical' = (emailOptions?.templateStyle || 
                                             agentProfile?.preferredEmailTemplate || 
                                             'modern') as 'modern' | 'classical';

  const clientLoginCode = this.generateClientLoginCode(
    timeline.client.firstName,
    timeline.client.phone || undefined
  );

  const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/timeline/${timeline.shareToken}?client=${clientLoginCode}`;

  try {
    // Call EmailService which handles Resend + Nodemailer fallback automatically
    const emailResult = await this.emailService.sendTimelineEmail({
      clientEmail: timeline.client.email,
      clientName: `${timeline.client.firstName} ${timeline.client.lastName}`.trim(),
      agentName: `${agentProfile?.firstName || ''} ${agentProfile?.lastName || ''}`.trim() || 'Your Agent',
      agentCompany: agentProfile?.company || 'Real Estate Professional',
      timelineUrl: shareUrl,
      propertyCount: timeline.properties.length,
      spouseEmail: timeline.client.spouseEmail || undefined,
      agentPhoto: agentProfile?.logo || undefined,
      brandColor: agentProfile?.brandColor || '#3b82f6',
      templateStyle: templateStyle,
    });

    // Check final result (after Resend attempt + potential Nodemailer fallback)
    if (!emailResult.success) {
      throw new Error(`Failed to send timeline email: ${emailResult.error || 'Unknown error'}`);
    }

    // Track successful email send
    await this.trackAnalyticsEvent(timeline.clientId, 'timeline_email_sent', {
      timelineId,
      propertyCount: timeline.properties.length,
      hasSpouseEmail: !!timeline.client.spouseEmail,
      provider: emailResult.provider, // 'resend' or 'nodemailer'
      templateStyle,
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

} catch (error) {
  console.error('Timeline email send failed:', {
    timelineId,
    clientEmail: timeline.client.email,
    error: error.message,
  });
  
  // Re-throw with more context
  throw new Error(`Timeline email delivery failed: ${error.message}`);
}
}

  // FIXED: Property notification with correct method signature
  async sendPropertyNotification(agentId: string, timelineId: string, propertyId: string) {
    const timeline = await this.prisma.timeline.findFirst({
      where: { id: timelineId, agentId },
      include: {
        client: true,
        agent: { include: { profile: true } },
        properties: { where: { id: propertyId } },
      },
    });

    if (!timeline || timeline.properties.length === 0) {
      throw new NotFoundException('Timeline or property not found');
    }

    const property = timeline.properties[0];
    const agentProfile = timeline.agent.profile;
    const clientLoginCode = this.generateClientLoginCode(
      timeline.client.firstName,
      timeline.client.phone || undefined
    );
    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/timeline/${timeline.shareToken}?client=${clientLoginCode}`;

    const emailResult = await this.emailService.sendPropertyNotification({
      clientEmail: timeline.client.email,
      clientName: `${timeline.client.firstName} ${timeline.client.lastName}`.trim(),
      agentName: `${agentProfile?.firstName || ''} ${agentProfile?.lastName || ''}`.trim() || 'Your Agent',
      propertyAddress: property.address,
      propertyPrice: property.price,
      propertyDescription: property.description || 'New property added to your timeline',
      propertyImageUrl: property.imageUrls[0] || '/api/placeholder/400/300',
      timelineUrl: shareUrl,
      spouseEmail: timeline.client.spouseEmail || undefined,
    });

    if (!emailResult.success) {
      throw new Error('Failed to send property notification');
    }

    return {
      message: 'Property notification sent successfully',
      sentTo: timeline.client.email,
      spouseSentTo: timeline.client.spouseEmail,
      propertyAddress: property.address,
      emailProvider: emailResult.provider,
      messageId: emailResult.messageId,
    };
  }

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

  async checkMLSDuplicate(agentId: string, clientId: string, mlsLink: string): Promise<boolean> {
  if (!mlsLink) return false;

  const existingProperty = await this.prisma.property.findFirst({
    where: {
      listingUrl: mlsLink.trim(),
      timeline: {
        agentId,
        clientId,
        isActive: true,
      },
    },
  });

  return !!existingProperty;
}

  // PRIVATE HELPER METHODS
  private formatPropertyResponse(property: any, clientId: string): PropertyResponseDto {
    const addressParts = [
      property.address,
      property.city,
      property.state,
      property.zipCode
    ].filter(Boolean);
    const combinedAddress = addressParts.join(', ');

    const primaryImage = Array.isArray(property.imageUrls) && property.imageUrls.length > 0
      ? property.imageUrls[0]
      : property.imageUrl || '/api/placeholder/400/300';

    const latestFeedback = property.feedback && property.feedback.length > 0 
      ? property.feedback[0] 
      : null;

    return {
      id: property.id,
      clientId: clientId,
      address: combinedAddress,
      price: property.price,
      description: property.description,
      imageUrl: primaryImage,
      mlsLink: property.listingUrl || undefined,
      addedAt: property.createdAt.toISOString(),
      clientFeedback: latestFeedback?.feedback || undefined,
      notes: latestFeedback?.notes || undefined,
      isActive: true,
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

  private async updateClientEngagement(clientId: string, feedback: string) {
    const engagementPoints = {
      love: 10,
      like: 5,
      dislike: 1,
    };

    await this.prisma.client.update({
      where: { id: clientId },
      data: {
        lastActivity: new Date(),
        feedbackRate: {
          increment: engagementPoints[feedback as keyof typeof engagementPoints] || 0,
        },
      },
    });
  }

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

  private generateNewShareToken(): string {
    return require('crypto').randomBytes(16).toString('hex');
  }

  private async getLastPropertyPosition(timelineId: string): Promise<number> {
    const lastProperty = await this.prisma.property.findFirst({
      where: { timelineId },
      orderBy: { position: 'desc' },
    });
    return lastProperty?.position || 0;
  }
}
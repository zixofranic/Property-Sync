import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { MLSParserService } from '../mls-parser/mls-parser.service';
import { BatchManagementService } from '../mls-parser/batch-management.service';
import { UsersService } from '../users/users.service';
import { AppConfigService } from '../config/app.config';
import { PropertyResponseDto } from './dto/property-response.dto';
import { PropertyFeedbackDto } from './dto/property-feedback.dto';
import { MessagingService } from '../messaging/messaging.service';

@Injectable()
export class TimelinesService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private mlsParser: MLSParserService,
    private batchService: BatchManagementService,
    private usersService: UsersService,
    private appConfig: AppConfigService,
    private messagingService: MessagingService,
  ) {}

  // Keep all existing methods unchanged until sendTimelineEmail
  async getTimelineByShareToken(shareToken: string, clientCode?: string) {
    const timeline = await this.prisma.timeline.findUnique({
      where: { shareToken },
      include: {
        client: true,
        agent: {
          include: { profile: true },
        },
        properties: {
          orderBy: { position: 'asc' },
          include: {
            feedback: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            conversations: {
              take: 1,
              orderBy: { createdAt: 'desc' },
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
        timeline.client.phone || undefined,
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
        firstName: timeline.agent.profile?.firstName,
        lastName: timeline.agent.profile?.lastName,
        company: timeline.agent.profile?.company,
        brandColor: timeline.agent.profile?.brandColor,
        avatar: timeline.agent.profile?.avatar,
        yearsExperience: timeline.agent.profile?.yearsExperience,
        specialties: timeline.agent.profile?.specialties
          ? (typeof timeline.agent.profile.specialties === 'string'
             ? JSON.parse(timeline.agent.profile.specialties)
             : timeline.agent.profile.specialties)
          : [],
        bio: timeline.agent.profile?.bio,
        license: timeline.agent.profile?.licenseNumber,
        website: timeline.agent.profile?.website,
      },

      properties: timeline.properties.map((property) =>
        this.formatPropertyResponse(property, timeline.client.id),
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
      timeline.client.phone || undefined,
    );

    const isValid =
      clientCode.toLowerCase() === expectedClientCode.toLowerCase();

    return {
      valid: isValid,
      clientName: isValid
        ? `${timeline.client.firstName} ${timeline.client.lastName}`
        : null,
    };
  }

  async getAgentTimeline(agentId: string, clientId: string) {
    const timeline = await this.prisma.timeline.findFirst({
      where: {
        agentId,
        clientId,
        isActive: true,
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
      properties: timeline.properties.map((property) =>
        this.formatPropertyResponse(property, clientId),
      ),
      createdAt: timeline.createdAt.toISOString(),
      updatedAt: timeline.updatedAt.toISOString(),
      shareToken: timeline.shareToken,
      isPublic: timeline.isActive,
    };
  }

  // FIXED: Property creation with corrected notification call
  async addPropertyToTimeline(
    agentId: string,
    timelineId: string,
    propertyData: any,
  ) {
    // Check plan limits before adding property
    const canAdd = await this.usersService.checkCanAddProperties(agentId, 1);
    if (!canAdd.canAdd) {
      throw new BadRequestException(canAdd.reason);
    }

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
        imageUrls: JSON.stringify([propertyData.imageUrl]),
        listingUrl: propertyData.mlsLink || null,
        timelineId,
        position: (await this.getLastPropertyPosition(timelineId)) + 1,
      },
    });

    // Create conversation for this property automatically
    let conversationId: string | null = null;
    try {
      const conversation = await this.messagingService.createOrGetConversation({
        agentId,
        clientId: timeline.clientId,
        timelineId,
        propertyId: newProperty.id,
      });
      conversationId = conversation.id;
      console.log(`Created conversation ${conversationId} for property ${newProperty.id}`);
    } catch (error) {
      console.warn('Conversation creation failed:', error.message);
    }

    // FIXED: Correct method call with proper parameters
    try {
      await this.sendPropertyNotification(agentId, timelineId, newProperty.id);
    } catch (error) {
      console.warn('Property notification failed:', error.message);
    }

    const formattedProperty = this.formatPropertyResponse(newProperty, timeline.clientId);

    // Add conversationId to the response
    if (conversationId) {
      (formattedProperty as any).conversationId = conversationId;
    }

    return formattedProperty;
  }

  async updateProperty(agentId: string, propertyId: string, updateData: any) {
    const property = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        timeline: { agentId },
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

    return this.formatPropertyResponse(
      updatedProperty,
      property.timeline.clientId,
    );
  }

  async deleteProperty(agentId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        timeline: { agentId },
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
      address: property.address,
    };
  }

  async deletePropertyPhoto(agentId: string, propertyId: string, photoUrl: string) {
    // Verify the agent owns this property
    const property = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        timeline: { agentId },
      },
      include: { timeline: true },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Remove the photo URL from the imageUrls array
    let currentImages: string[] = [];
    try {
      currentImages = property.imageUrls ? JSON.parse(property.imageUrls) : [];
      // Ensure it's an array
      if (!Array.isArray(currentImages)) {
        currentImages = [];
      }
    } catch (error) {
      currentImages = [];
    }
    const updatedImages = currentImages.filter(url => url !== photoUrl);

    // Update the property with the new image array
    const updatedProperty = await this.prisma.property.update({
      where: { id: propertyId },
      data: {
        imageUrls: JSON.stringify(updatedImages),
        updatedAt: new Date(),
      },
    });

    return {
      message: 'Photo deleted successfully',
      propertyId,
      deletedPhotoUrl: photoUrl,
      remainingPhotos: updatedImages.length,
    };
  }

  async submitPropertyFeedback(
    shareToken: string,
    propertyId: string,
    feedbackDto: PropertyFeedbackDto,
    clientCode?: string,
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
        timeline.client.phone || undefined,
      );

      if (clientCode.toLowerCase() !== expectedClientCode.toLowerCase()) {
        throw new UnauthorizedException('Invalid client access code');
      }
    }

    const property = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        timelineId: timeline.id,
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

  // ENHANCED: Send Timeline Email with email type detection and tracking
  async sendTimelineEmail(
    agentId: string,
    timelineId: string,
    emailOptions?: { 
      templateStyle?: 'modern' | 'classical';
      emailType?: 'initial' | 'reminder';
    },
  ) {
    const timeline = await this.prisma.timeline.findFirst({
      where: {
        id: timelineId,
        agentId,
      },
      include: {
        client: true,
        agent: {
          include: { profile: true },
        },
        properties: true,
      },
    });

    if (!timeline) {
      throw new NotFoundException('Timeline not found');
    }

    // ENHANCED: Validate properties exist before sending email
    if (timeline.properties.length === 0) {
      throw new Error('Cannot send email: Timeline has no properties');
    }

    // ENHANCED: Determine email type (initial or reminder)
    const emailType = emailOptions?.emailType || (timeline.initialEmailSent ? 'reminder' : 'initial');
    const newPropertyCount = timeline.properties.length - timeline.lastEmailPropertyCount;

    const agentProfile = timeline.agent.profile;
    const templateStyle: 'modern' | 'classical' =
      (emailOptions?.templateStyle ||
        agentProfile?.emailTemplateStyle ||
        'modern') as 'modern' | 'classical';

    // DEBUG: Log template selection
    console.log('🎨 Email Template Selection Debug:', {
      emailOptionsTemplate: emailOptions?.templateStyle,
      agentProfileTemplate: agentProfile?.emailTemplateStyle,
      finalTemplate: templateStyle,
      agentId: agentId,
      timelineId: timelineId
    });

    const clientLoginCode = this.generateClientLoginCode(
      timeline.client.firstName,
      timeline.client.phone || undefined,
    );

    const shareUrl = this.appConfig.getTimelineShareUrl(timeline.shareToken, clientLoginCode);

    try {
      // Call EmailService which handles Resend + Nodemailer fallback automatically
      const emailResult = await this.emailService.sendTimelineEmail({
        clientEmail: timeline.client.email,
        clientName:
          `${timeline.client.firstName} ${timeline.client.lastName}`.trim(),
        clientPhone: timeline.client.phone || undefined,
        agentName:
          `${agentProfile?.firstName || ''} ${agentProfile?.lastName || ''}`.trim() ||
          'Your Agent',
        agentCompany: agentProfile?.company || 'Realtor',
        agentEmail: timeline.agent.email || undefined,
        agentPhone: timeline.agent.profile?.phone || undefined,
        timelineUrl: shareUrl,
        propertyCount: timeline.properties.length,
        spouseEmail: timeline.client.spouseEmail || undefined,
        agentPhoto: agentProfile?.logo || undefined,
        companyLogo: agentProfile?.companyLogo || undefined,
        brandColor: agentProfile?.brandColor || '#3b82f6',
        templateStyle: templateStyle,
        emailType: emailType,
      });

      // Check final result (after Resend attempt + potential Nodemailer fallback)
      if (!emailResult.success) {
        throw new Error(
          `Failed to send timeline email: ${emailResult.error || 'Unknown error'}`,
        );
      }

      // ENHANCED: Update email tracking fields
      await this.prisma.timeline.update({
        where: { id: timelineId },
        data: {
          initialEmailSent: true,
          lastEmailSent: new Date(),
          lastEmailPropertyCount: timeline.properties.length,
        },
      });

      // Track successful email send with enhanced analytics
      await this.trackAnalyticsEvent(timeline.clientId, 'timeline_email_sent', {
        timelineId,
        propertyCount: timeline.properties.length,
        emailType,
        newPropertyCount: emailType === 'reminder' ? newPropertyCount : timeline.properties.length,
        hasSpouseEmail: !!timeline.client.spouseEmail,
        provider: emailResult.provider, // 'resend' or 'nodemailer'
        templateStyle,
      });

      return {
        message: `${emailType === 'initial' ? 'Initial timeline' : 'Reminder'} email sent successfully`,
        emailType,
        sentTo: timeline.client.email,
        spouseSentTo: timeline.client.spouseEmail,
        propertyCount: timeline.properties.length,
        newPropertyCount: emailType === 'reminder' ? newPropertyCount : timeline.properties.length,
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

  // NEW: Get timeline email state for UI
  async getTimelineEmailState(agentId: string, timelineId: string) {
    const timeline = await this.prisma.timeline.findFirst({
      where: { id: timelineId, agentId },
      include: { 
        properties: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
    });

    if (!timeline) {
      throw new NotFoundException('Timeline not found');
    }

    // Get total property count (we need all properties for count, not just the latest)
    const totalProperties = await this.prisma.property.count({
      where: { timelineId }
    });

    const propertyCount = totalProperties;
    const newPropertyCount = propertyCount - timeline.lastEmailPropertyCount;
    
    // Get the most recent property addition date
    const latestProperty = timeline.properties[0];
    const lastPropertyAddedDate = latestProperty?.createdAt;
    
    // Enhanced logic: Only suggest email if client hasn't viewed timeline since new properties were added
    const clientHasSeenNewProperties = timeline.lastViewed && 
                                      lastPropertyAddedDate && 
                                      timeline.lastViewed >= lastPropertyAddedDate;
    
    return {
      canSendInitial: propertyCount > 0 && !timeline.initialEmailSent,
      canSendReminder: timeline.initialEmailSent && 
                      newPropertyCount > 0 && 
                      !clientHasSeenNewProperties,
      propertyCount,
      newPropertyCount,
      lastEmailDate: timeline.lastEmailSent,
      lastEmailPropertyCount: timeline.lastEmailPropertyCount,
      initialEmailSent: timeline.initialEmailSent,
      lastViewed: timeline.lastViewed,
      clientHasSeenNewProperties,
    };
  }

  // FIXED: Property notification with correct method signature
  async sendPropertyNotification(
    agentId: string,
    timelineId: string,
    propertyId: string,
  ) {
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
      timeline.client.phone || undefined,
    );
    const shareUrl = this.appConfig.getTimelineShareUrl(timeline.shareToken, clientLoginCode);

    const emailResult = await this.emailService.sendPropertyNotification({
      clientEmail: timeline.client.email,
      clientName:
        `${timeline.client.firstName} ${timeline.client.lastName}`.trim(),
      agentName:
        `${agentProfile?.firstName || ''} ${agentProfile?.lastName || ''}`.trim() ||
        'Your Agent',
      propertyAddress: property.address,
      propertyPrice: property.price,
      propertyDescription:
        property.description || 'New property added to your timeline',
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
        agentId,
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

  // Enhanced MLS duplicate checking (replaces your current method)
  async checkMLSDuplicate(
    agentId: string,
    clientId: string,
    mlsLink: string,
  ): Promise<boolean> {
    if (!mlsLink) return false;

    // Check by exact URL match
    const existingByUrl = await this.prisma.property.findFirst({
      where: {
        OR: [
          { listingUrl: mlsLink.trim() },
          { originalMlsUrl: mlsLink.trim() },
        ],
        timeline: {
          agentId,
          clientId,
          isActive: true,
        },
      },
    });

    if (existingByUrl) return true;

    // Enhanced check: try to parse the URL and check by normalized address
    try {
      if (mlsLink.includes('flexmls.com')) {
        const parseResult = await this.mlsParser.parseSingleMLS(mlsLink);

        if (parseResult.success) {
          if (parseResult.data) {
            const duplicateCheck = await this.mlsParser.checkEnhancedDuplicate(
              agentId,
              clientId,
              parseResult.data,
            );
            return duplicateCheck.isDuplicate;
          }
        }
      }
    } catch (error) {
      console.warn(
        'Enhanced duplicate check failed, falling back to URL check:',
        error,
      );
    }

    return false;
  }

  // Create batch and start parsing MLS URLs
  // NEW: Create instant batch - properties appear immediately, parse in background
  async createInstantBatch(
    agentId: string,
    clientId: string,
    timelineId: string,
    mlsUrls: string[],
  ) {
    try {
      let timeline;

      // If no timeline ID provided or empty, find or create one
      if (!timelineId || timelineId.trim() === '') {
        timeline = await this.prisma.timeline.findFirst({
          where: {
            agentId,
            clientId,
            isActive: true,
          },
          include: {
            client: true,
            agent: { include: { profile: true } },
          },
        });

        // Create timeline if none exists
        if (!timeline) {
          const client = await this.prisma.client.findFirst({
            where: { id: clientId, agentId },
          });

          if (!client) {
            throw new NotFoundException('Client not found or access denied');
          }

          timeline = await this.prisma.timeline.create({
            data: {
              agentId,
              clientId,
              title: `Properties for ${client.firstName} ${client.lastName}`,
              description: 'Property timeline created automatically',
              isActive: true,
              shareToken: this.generateNewShareToken(),
            },
            include: {
              client: true,
              agent: { include: { profile: true } },
            },
          });
        }
      } else {
        // Validate provided timeline belongs to agent
        timeline = await this.prisma.timeline.findFirst({
          where: {
            id: timelineId,
            client: { agentId },
          },
          include: {
            client: true,
            agent: { include: { profile: true } },
          },
        });

        if (!timeline) {
          throw new NotFoundException('Timeline not found or access denied');
        }
      }

      // Create batch
      const batch = await this.batchService.createPropertyBatch(
        agentId,
        clientId,
        timeline.id,
      );

      // Add URLs to batch
      await this.batchService.addMLSUrlsToBatch(batch.id, mlsUrls);

      // Create properties instantly and start background parsing
      const result = await this.batchService.createInstantBatch(batch.id);

      return {
        success: true,
        message: 'Properties created instantly, parsing in background',
        batchId: batch.id,
        properties: result.properties,
        instantCreationCompleted: true,
        backgroundParsingStarted: true,
      };
    } catch (error) {
      console.error('Instant batch creation error:', error);
      return {
        success: false,
        error: error.message || 'Failed to create instant batch',
      };
    }
  }

  async createAndParseBatch(
    agentId: string,
    clientId: string,
    timelineId: string,
    mlsUrls: string[],
  ) {
    try {
      // Validate timeline belongs to agent
      const timeline = await this.prisma.timeline.findFirst({
        where: {
          id: timelineId,
          agentId,
          clientId,
          isActive: true,
        },
      });

      if (!timeline) {
        throw new Error('Timeline not found or access denied');
      }

      // Create batch
      const batch = await this.batchService.createPropertyBatch(
        agentId,
        clientId,
        timelineId,
      );

      // Add URLs to batch
      await this.batchService.addMLSUrlsToBatch(batch.id, mlsUrls);

      // Start parsing in background
      this.batchService.parseBatchProperties(batch.id).catch((error) => {
        console.error(
          `Background parsing failed for batch ${batch.id}:`,
          error,
        );
      });

      return {
        batchId: batch.id,
        message: 'Batch created and parsing started',
        totalUrls: mlsUrls.length,
      };
    } catch (error) {
      throw new Error(`Failed to create batch: ${error.message}`);
    }
  }

  // Get batch status with parsed properties
  async getBatchStatus(agentId: string, batchId: string) {
    const batch = await this.prisma.propertyBatch.findFirst({
      where: {
        id: batchId,
        agentId,
      },
      include: {
        batchProperties: {
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    // Transform batch properties for frontend
    const properties = batch.batchProperties.map((bp) => ({
      id: bp.id,
      mlsUrl: bp.mlsUrl,
      parseStatus: bp.parseStatus,
      parseError: bp.parseError,
      position: bp.position,
      parsedData: bp.parsedData
        ? {
            address: (bp.parsedData as any).address?.full,
            price: (bp.parsedData as any).pricing?.listPrice,
            priceNumeric: (bp.parsedData as any).pricing?.priceNumeric,
            beds: (bp.parsedData as any).propertyDetails?.beds,
            baths: (bp.parsedData as any).propertyDetails?.baths,
            sqft: (bp.parsedData as any).propertyDetails?.sqft,
            imageCount: (bp.parsedData as any).images?.length || 0,
            images: (bp.parsedData as any).images
              ?.slice(0, 3)
              .map((img: any) => img.url), // First 3 images for preview
          }
        : null,
    }));

    return {
      id: batch.id,
      status: batch.status,
      totalProperties: batch.totalProperties,
      successCount: batch.successCount,
      failureCount: batch.failureCount,
      startedAt: batch.startedAt?.toISOString(),
      completedAt: batch.completedAt?.toISOString(),
      properties,
    };
  }

  // Import selected properties from batch
  async importBatchProperties(
    agentId: string,
    batchId: string,
    propertySelections: {
      batchPropertyId: string;
      customDescription?: string;
      agentNotes?: string;
    }[],
  ) {
    try {
      // Validate batch belongs to agent
      const batch = await this.prisma.propertyBatch.findFirst({
        where: { id: batchId, agentId },
      });

      if (!batch) {
        throw new Error('Batch not found or access denied');
      }

      // Import properties
      const importResults = await this.batchService.importParsedProperties(
        batchId,
        propertySelections,
      );

      // Send email notifications for successfully imported properties
      const successfulImports = importResults.importResults.filter(
        (r) => r.success,
      );

      // NOTE: Automatic email sending has been disabled for batch imports
      // Agents must manually send emails via "Share Timeline" button
      // This gives agents full control over when and what type of email to send to clients

      return {
        message: `Successfully imported ${successfulImports.length} properties`,
        ...importResults,
      };
    } catch (error) {
      throw new Error(`Failed to import properties: ${error.message}`);
    }
  }

  // Send notification email for batch import
  private async sendBatchImportNotification(
    timeline: any,
    importedProperties: any[],
  ) {
    const agentProfile = timeline.agent.profile;
    const clientLoginCode = this.generateClientLoginCode(
      timeline.client.firstName,
      timeline.client.phone || undefined,
    );

    const shareUrl = this.appConfig.getTimelineShareUrl(timeline.shareToken, clientLoginCode);

    const emailResult = await this.emailService.sendBatchImportNotification({
      clientEmail: timeline.client.email,
      clientName:
        `${timeline.client.firstName} ${timeline.client.lastName}`.trim(),
      agentName:
        `${agentProfile?.firstName || ''} ${agentProfile?.lastName || ''}`.trim() ||
        'Your Agent',
      propertyCount: importedProperties.length,
      timelineUrl: shareUrl,
      spouseEmail: timeline.client.spouseEmail || undefined,
      propertyAddresses: importedProperties.map((p) => p.address).slice(0, 5), // First 5 addresses
    });

    return emailResult;
  }

  // Delete batch (cleanup)
  async deleteBatch(agentId: string, batchId: string) {
    const batch = await this.prisma.propertyBatch.findFirst({
      where: { id: batchId, agentId },
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    await this.prisma.propertyBatch.delete({
      where: { id: batchId },
    });

    return { message: 'Batch deleted successfully' };
  }

  // Get agent's recent batches
  async getAgentBatches(agentId: string) {
    const batches = await this.prisma.propertyBatch.findMany({
      where: { agentId },
      include: {
        client: {
          select: { firstName: true, lastName: true },
        },
        _count: {
          select: { batchProperties: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return batches.map((batch) => ({
      id: batch.id,
      status: batch.status,
      clientName: `${batch.client.firstName} ${batch.client.lastName}`,
      totalProperties: batch.totalProperties,
      successCount: batch.successCount,
      failureCount: batch.failureCount,
      createdAt: batch.createdAt.toISOString(),
      completedAt: batch.completedAt?.toISOString(),
    }));
  }

  // PRIVATE HELPER METHODS
  private formatPropertyResponse(
    property: any,
    clientId: string,
  ): PropertyResponseDto {
    // property.address already contains the full address string
    // (e.g., "2508 Boulevard Napoleon, Louisville, KY 40205")
    // so we don't need to concatenate it with city, state, and zip
    const combinedAddress = property.address || '';

    const primaryImage =
      Array.isArray(property.imageUrls) && property.imageUrls.length > 0
        ? property.imageUrls[0]
        : property.imageUrl || '/api/placeholder/400/300';

    const latestFeedback =
      property.feedback && property.feedback.length > 0
        ? property.feedback[0]
        : null;

    const latestConversation =
      property.conversations && property.conversations.length > 0
        ? property.conversations[0]
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
      loadingProgress: property.loadingProgress || 100,
      isFullyParsed: property.isFullyParsed !== false,
      updatedAt: property.updatedAt.toISOString(),
      feedback: latestFeedback
        ? {
            id: latestFeedback.id,
            feedback: latestFeedback.feedback,
            notes: latestFeedback.notes || undefined,
            createdAt: latestFeedback.createdAt.toISOString(),
          }
        : undefined,
      conversationId: latestConversation?.id || undefined,
    } as PropertyResponseDto;
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
          increment:
            engagementPoints[feedback as keyof typeof engagementPoints] || 0,
        },
      },
    });
  }

  private async trackAnalyticsEvent(
    clientId: string,
    eventType: string,
    metadata: any,
  ) {
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

  // Get client notifications for a timeline
  async getClientNotifications(shareToken: string, clientCode?: string) {
    // Verify timeline exists
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
      throw new NotFoundException('Timeline not found or inactive');
    }

    // Get agent name from profile
    const agentName = timeline.agent.profile
      ? `${timeline.agent.profile.firstName} ${timeline.agent.profile.lastName}`
      : timeline.agent.email;

    // Get properties to check for new/unfeedback properties
    const properties = await this.prisma.property.findMany({
      where: { timelineId: timeline.id },
      include: {
        feedback: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate properties added in last 24 hours without feedback
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const newPropertiesWithoutFeedback = properties.filter(property => 
      new Date(property.createdAt) > twentyFourHoursAgo && 
      (!property.feedback || property.feedback.length === 0)
    );

    const notifications: any[] = [];

    // Only add new properties notification if there are actually new properties without feedback
    if (newPropertiesWithoutFeedback.length > 0) {
      // Format property addresses as "number + first word" (e.g., "3215 Autumn", "3456 Main")
      const formatPropertyAddress = (address: string): string => {
        const parts = address.trim().split(/\s+/);
        if (parts.length >= 2) {
          return `${parts[0]} ${parts[1]}`;
        }
        return parts[0] || address;
      };

      const propertyAddresses = newPropertiesWithoutFeedback
        .map(p => formatPropertyAddress(p.address))
        .slice(0, 3); // Show max 3 addresses

      // Create client name from timeline.client
      const clientName = `${timeline.client.firstName} ${timeline.client.lastName}`.trim();

      let message: string;
      if (newPropertiesWithoutFeedback.length === 1) {
        message = `New property: ${propertyAddresses[0]} added for ${clientName} by ${agentName}`;
      } else if (newPropertiesWithoutFeedback.length <= 3) {
        message = `New properties: ${propertyAddresses.join(', ')} added for ${clientName} by ${agentName}`;
      } else {
        const remainingCount = newPropertiesWithoutFeedback.length - 3;
        message = `New properties: ${propertyAddresses.join(', ')} and ${remainingCount} more added for ${clientName} by ${agentName}`;
      }

      notifications.push({
        id: 1,
        message,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        isRead: false,
        type: 'property'
      });
    }

    return notifications;
  }

  /**
   * Normalize an address for comparison and duplicate detection
   */
  private normalizeAddress(address: string): string {
    return address
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async getLastPropertyPosition(timelineId: string): Promise<number> {
    const lastProperty = await this.prisma.property.findFirst({
      where: { timelineId },
      orderBy: { position: 'desc' },
    });
    return lastProperty?.position || 0;
  }

  // NEW: Add RapidAPI property to timeline with all enriched data
  async addRapidAPIPropertyToTimeline(
    agentId: string,
    timelineId: string,
    rapidAPIData: any, // ParsedMLSProperty from RapidAPIService
  ) {
    // Check plan limits before adding property
    const canAdd = await this.usersService.checkCanAddProperties(agentId, 1);
    if (!canAdd.canAdd) {
      throw new BadRequestException(canAdd.reason);
    }

    const timeline = await this.prisma.timeline.findFirst({
      where: { id: timelineId, agentId },
    });

    if (!timeline) {
      throw new NotFoundException('Timeline not found');
    }

    // Transform RapidAPI data to database format
    const newProperty = await this.prisma.property.create({
      data: {
        // Basic property info
        address: rapidAPIData.address.full,
        city: rapidAPIData.address.city,
        state: rapidAPIData.address.state,
        zipCode: rapidAPIData.address.zipCode,
        price: rapidAPIData.pricing.priceNumeric,
        description: rapidAPIData.description || 'Property details loading...',

        // Property details
        bedrooms: parseInt(rapidAPIData.propertyDetails.beds) || null,
        bathrooms: parseFloat(rapidAPIData.propertyDetails.baths) || null,
        squareFootage: parseInt(rapidAPIData.propertyDetails.sqft?.replace(/,/g, '')) || null,
        propertyType: rapidAPIData.propertyDetails.propertyType || null,

        // Images and listing
        imageUrls: JSON.stringify(rapidAPIData.images || []),
        listingUrl: rapidAPIData.rawData.href || rapidAPIData.rawData.permalink || undefined,

        // MLS Parser Integration (for duplicate detection)
        originalMlsUrl: rapidAPIData.sourceUrl || undefined,
        addressNormalized: this.normalizeAddress(rapidAPIData.address.full),

        // RapidAPI-specific fields
        rapidapi_property_id: rapidAPIData.shareId,
        rapidapi_permalink: rapidAPIData.rawData.permalink || undefined,
        tax_history: rapidAPIData.rawData.tax_history ? JSON.stringify(rapidAPIData.rawData.tax_history) : undefined,
        nearby_schools: rapidAPIData.rawData.nearby_schools ? JSON.stringify(rapidAPIData.rawData.nearby_schools) : undefined,
        flood_risk: rapidAPIData.rawData.flood_risk ? JSON.stringify(rapidAPIData.rawData.flood_risk) : undefined,
        fire_risk: rapidAPIData.rawData.fire_risk ? JSON.stringify(rapidAPIData.rawData.fire_risk) : undefined,
        noise_score: rapidAPIData.rawData.noise_score ? JSON.stringify({ score: rapidAPIData.rawData.noise_score }) : undefined,
        last_sold_price: rapidAPIData.rawData.last_sold_price || undefined,
        last_sold_date: rapidAPIData.rawData.last_sold_date ? new Date(rapidAPIData.rawData.last_sold_date) : undefined,

        // Timeline and position
        timelineId,
        position: (await this.getLastPropertyPosition(timelineId)) + 1,
        isFullyParsed: true, // RapidAPI data is always fully parsed
      },
    });

    // Create conversation for this property automatically
    let conversationId: string | null = null;
    try {
      const conversation = await this.messagingService.createOrGetConversation({
        agentId,
        clientId: timeline.clientId,
        timelineId,
        propertyId: newProperty.id,
      });
      conversationId = conversation.id;
      console.log(`Created conversation ${conversationId} for RapidAPI property ${newProperty.id}`);
    } catch (error) {
      console.warn('Conversation creation failed:', error.message);
    }

    // Send property notification
    try {
      await this.sendPropertyNotification(agentId, timelineId, newProperty.id);
    } catch (error) {
      console.warn('Property notification failed:', error.message);
    }

    const formattedProperty = this.formatPropertyResponse(newProperty, timeline.clientId);

    // Add conversationId to the response
    if (conversationId) {
      (formattedProperty as any).conversationId = conversationId;
    }

    return formattedProperty;
  }
}

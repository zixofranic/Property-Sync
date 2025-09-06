import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { TimelinesService } from './timelines.service';
import { PropertyFeedbackDto } from './dto/property-feedback.dto';

@Controller('api/v1/timelines')
export class TimelinesController {
  constructor(private readonly timelinesService: TimelinesService) {}

  // CRITICAL FIX: Move all specific routes BEFORE parameterized routes

  // Check MLS duplicate - MOVED TO TOP
  @UseGuards(JwtAuthGuard)
  @Get('check-duplicate')
  async checkMLSDuplicate(
    @Request() req,
    @Query('clientId') clientId: string,
    @Query('mlsLink') mlsLink: string,
  ) {
    if (!clientId || !mlsLink) {
      return {
        error: 'Missing clientId or mlsLink parameter',
      };
    }

    try {
      const agentId = req.user.id;
      const isDuplicate = await this.timelinesService.checkMLSDuplicate(
        agentId,
        clientId,
        mlsLink,
      );
      return { isDuplicate };
    } catch (error) {
      console.error('MLS duplicate check error:', error);
      return {
        error: 'Failed to check for duplicates',
      };
    }
  }

  // Create batch and parse MLS URLs
  @UseGuards(JwtAuthGuard)
  // NEW: Instant batch creation - properties appear immediately
  @Post('batch/create-instant')
  async createInstantBatch(
    @Request() req,
    @Body()
    batchData: {
      clientId: string;
      timelineId: string;
      mlsUrls: string[];
    },
  ) {
    const agentId = req.user.id;
    return this.timelinesService.createInstantBatch(
      agentId,
      batchData.clientId,
      batchData.timelineId,
      batchData.mlsUrls,
    );
  }

  @Post('batch/create-and-parse')
  async createAndParseBatch(
    @Request() req,
    @Body()
    batchData: {
      clientId: string;
      timelineId: string;
      mlsUrls: string[];
    },
  ) {
    console.log('req.user:', req.user);
    console.log('req.user.id:', req.user?.id);
    const agentId = req.user?.id;
    
    if (!agentId) {
      throw new Error('User ID not found in request');
    }
    
    return this.timelinesService.createAndParseBatch(
      agentId,
      batchData.clientId,
      batchData.timelineId,
      batchData.mlsUrls,
    );
  }

  // Get batch status
  @UseGuards(JwtAuthGuard)
  @Get('batch/:batchId/status')
  async getBatchStatus(@Request() req, @Param('batchId') batchId: string) {
    const agentId = req.user.id;
    return this.timelinesService.getBatchStatus(agentId, batchId);
  }

  // Import selected properties from batch
  @UseGuards(JwtAuthGuard)
  @Post('batch/:batchId/import')
  async importBatchProperties(
    @Request() req,
    @Param('batchId') batchId: string,
    @Body()
    importData: {
      properties: {
        batchPropertyId: string;
        customDescription?: string;
        agentNotes?: string;
      }[];
    },
  ) {
    const agentId = req.user.id;
    return this.timelinesService.importBatchProperties(
      agentId,
      batchId,
      importData.properties,
    );
  }

  // Delete batch
  @UseGuards(JwtAuthGuard)
  @Delete('batch/:batchId')
  async deleteBatch(@Request() req, @Param('batchId') batchId: string) {
    const agentId = req.user.id;
    return this.timelinesService.deleteBatch(agentId, batchId);
  }

  // Get agent's batches
  @UseGuards(JwtAuthGuard)
  @Get('batches')
  async getAgentBatches(@Request() req) {
    const agentId = req.user.id;
    return this.timelinesService.getAgentBatches(agentId);
  }

  // Get agent timeline for specific client - MOVED UP
  @UseGuards(JwtAuthGuard)
  @Get('agent/:clientId')
  async getAgentTimeline(@Request() req, @Param('clientId') clientId: string) {
    const agentId = req.user.id;
    return this.timelinesService.getAgentTimeline(agentId, clientId);
  }

  // NOW the parameterized routes that can catch anything:

  // Get timeline by share token (for clients)
  @Public()
  @Get(':shareToken')
  async getTimelineByShareToken(
    @Param('shareToken') shareToken: string,
    @Query('client') clientCode?: string,
  ) {
    return this.timelinesService.getTimelineByShareToken(
      shareToken,
      clientCode,
    );
  }

  // Validate client access
  @Public()
  @Get(':shareToken/validate-client')
  async validateClientAccess(
    @Param('shareToken') shareToken: string,
    @Query('client') clientCode: string,
  ) {
    return this.timelinesService.validateClientAccess(shareToken, clientCode);
  }

  // Get client notifications (public)
  @Public()
  @Get(':shareToken/notifications')
  async getClientNotifications(
    @Param('shareToken') shareToken: string,
    @Query('client') clientCode?: string,
  ) {
    return this.timelinesService.getClientNotifications(shareToken, clientCode);
  }

  // Submit property feedback (public)
  @Public()
  @Post(':shareToken/properties/:propertyId/feedback')
  async submitPropertyFeedback(
    @Param('shareToken') shareToken: string,
    @Param('propertyId') propertyId: string,
    @Body() feedbackDto: PropertyFeedbackDto,
    @Query('client') clientCode?: string,
  ) {
    return this.timelinesService.submitPropertyFeedback(
      shareToken,
      propertyId,
      feedbackDto,
      clientCode,
    );
  }

  // Add property to timeline
  @UseGuards(JwtAuthGuard)
  @Post(':timelineId/properties')
  async addProperty(
    @Request() req,
    @Param('timelineId') timelineId: string,
    @Body() propertyData: any,
  ) {
    const agentId = req.user.id;
    return this.timelinesService.addPropertyToTimeline(
      agentId,
      timelineId,
      propertyData,
    );
  }

  // Update property
  @UseGuards(JwtAuthGuard)
  @Patch('properties/:propertyId')
  async updateProperty(
    @Request() req,
    @Param('propertyId') propertyId: string,
    @Body() updateData: any,
  ) {
    const agentId = req.user.id;
    return this.timelinesService.updateProperty(
      agentId,
      propertyId,
      updateData,
    );
  }

  // Delete property
  @UseGuards(JwtAuthGuard)
  @Delete('properties/:propertyId')
  async deleteProperty(
    @Request() req,
    @Param('propertyId') propertyId: string,
  ) {
    const agentId = req.user.id;
    return this.timelinesService.deleteProperty(agentId, propertyId);
  }

  // Delete specific photo from property
  @UseGuards(JwtAuthGuard)
  @Delete('properties/:propertyId/photos')
  async deletePropertyPhoto(
    @Request() req,
    @Param('propertyId') propertyId: string,
    @Body() deleteData: { photoUrl: string },
  ) {
    const agentId = req.user.id;
    return this.timelinesService.deletePropertyPhoto(
      agentId,
      propertyId,
      deleteData.photoUrl,
    );
  }

  // Get email state
  @UseGuards(JwtAuthGuard)
  @Get(':timelineId/email-state')
  async getTimelineEmailState(
    @Request() req,
    @Param('timelineId') timelineId: string,
  ) {
    const agentId = req.user.id;
    return this.timelinesService.getTimelineEmailState(agentId, timelineId);
  }

  // Send timeline email
  @UseGuards(JwtAuthGuard)
  @Post(':timelineId/send-email')
  async sendTimelineEmail(
    @Request() req,
    @Param('timelineId') timelineId: string,
    @Body() emailOptions?: { 
      templateStyle?: 'modern' | 'classical';
      emailType?: 'initial' | 'reminder';
    },
  ) {
    const agentId = req.user.id;
    return this.timelinesService.sendTimelineEmail(
      agentId,
      timelineId,
      emailOptions,
    );
  }

  // Send property notification
  @UseGuards(JwtAuthGuard)
  @Post(':timelineId/send-property-notification')
  async sendPropertyNotification(
    @Request() req,
    @Param('timelineId') timelineId: string,
    @Body() notificationData: { propertyId: string },
  ) {
    const agentId = req.user.id;
    return this.timelinesService.sendPropertyNotification(
      agentId,
      timelineId,
      notificationData.propertyId,
    );
  }

  // Revoke timeline access
  @UseGuards(JwtAuthGuard)
  @Post(':timelineId/revoke-access')
  async revokeTimelineAccess(
    @Request() req,
    @Param('timelineId') timelineId: string,
  ) {
    const agentId = req.user.id;
    return this.timelinesService.revokeTimelineAccess(agentId, timelineId);
  }
}

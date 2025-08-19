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
  NotFoundException 
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
    @Query('mlsLink') mlsLink: string
  ) {
    if (!clientId || !mlsLink) {
      return {
        error: 'Missing clientId or mlsLink parameter',
      };
    }

    try {
      const agentId = req.user.id;
      const isDuplicate = await this.timelinesService.checkMLSDuplicate(agentId, clientId, mlsLink);
      return { isDuplicate };
    } catch (error) {
      console.error('MLS duplicate check error:', error);
      return {
        error: 'Failed to check for duplicates',
      };
    }
  }

  // Get agent timeline for specific client - MOVED UP
  @UseGuards(JwtAuthGuard)
  @Get('agent/:clientId')
  async getAgentTimeline(
    @Request() req,
    @Param('clientId') clientId: string
  ) {
    const agentId = req.user.id;
    return this.timelinesService.getAgentTimeline(agentId, clientId);
  }

  // NOW the parameterized routes that can catch anything:

  // Get timeline by share token (for clients)
  @Public()
  @Get(':shareToken')
  async getTimelineByShareToken(
    @Param('shareToken') shareToken: string,
    @Query('client') clientCode?: string
  ) {
    return this.timelinesService.getTimelineByShareToken(shareToken, clientCode);
  }

  // Validate client access
  @Public()
  @Get(':shareToken/validate-client')
  async validateClientAccess(
    @Param('shareToken') shareToken: string,
    @Query('client') clientCode: string
  ) {
    return this.timelinesService.validateClientAccess(shareToken, clientCode);
  }

  // Submit property feedback (public)
  @Public()
  @Post(':shareToken/properties/:propertyId/feedback')
  async submitPropertyFeedback(
    @Param('shareToken') shareToken: string,
    @Param('propertyId') propertyId: string,
    @Body() feedbackDto: PropertyFeedbackDto,
    @Query('client') clientCode?: string
  ) {
    return this.timelinesService.submitPropertyFeedback(shareToken, propertyId, feedbackDto, clientCode);
  }

  // Add property to timeline
  @UseGuards(JwtAuthGuard)
  @Post(':timelineId/properties')
  async addProperty(
    @Request() req,
    @Param('timelineId') timelineId: string,
    @Body() propertyData: any
  ) {
    const agentId = req.user.id;
    return this.timelinesService.addPropertyToTimeline(agentId, timelineId, propertyData);
  }

  // Update property
  @UseGuards(JwtAuthGuard)
  @Patch('properties/:propertyId')
  async updateProperty(
    @Request() req,
    @Param('propertyId') propertyId: string,
    @Body() updateData: any
  ) {
    const agentId = req.user.id;
    return this.timelinesService.updateProperty(agentId, propertyId, updateData);
  }

  // Delete property
  @UseGuards(JwtAuthGuard)
  @Delete('properties/:propertyId')
  async deleteProperty(
    @Request() req,
    @Param('propertyId') propertyId: string
  ) {
    const agentId = req.user.id;
    return this.timelinesService.deleteProperty(agentId, propertyId);
  }

  // Send timeline email
  @UseGuards(JwtAuthGuard)
  @Post(':timelineId/send-email')
  async sendTimelineEmail(
    @Request() req,
    @Param('timelineId') timelineId: string,
    @Body() emailOptions?: { templateStyle?: 'modern' | 'classical' }
  ) {
    const agentId = req.user.id;
    return this.timelinesService.sendTimelineEmail(agentId, timelineId, emailOptions);
  }

  // Send property notification
  @UseGuards(JwtAuthGuard)
  @Post(':timelineId/send-property-notification')
  async sendPropertyNotification(
    @Request() req,
    @Param('timelineId') timelineId: string,
    @Body() notificationData: { propertyId: string }
  ) {
    const agentId = req.user.id;
    return this.timelinesService.sendPropertyNotification(agentId, timelineId, notificationData.propertyId);
  }

  // Revoke timeline access
  @UseGuards(JwtAuthGuard)
  @Post(':timelineId/revoke-access')
  async revokeTimelineAccess(
    @Request() req,
    @Param('timelineId') timelineId: string
  ) {
    const agentId = req.user.id;
    return this.timelinesService.revokeTimelineAccess(agentId, timelineId);
  }
}
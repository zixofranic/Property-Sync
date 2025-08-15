import { 
  Controller, 
  Get, 
  Post,
  Patch,
  Delete,
  Param, 
  Query, 
  Body,
  Request,
  UseGuards,
  NotFoundException 
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';        
import { TimelinesService } from './timelines.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { PropertyFeedbackDto } from './dto/property-feedback.dto';

@Controller('api/v1/timelines')
export class TimelinesController {
  constructor(private readonly timelinesService: TimelinesService) {}

  // Get timeline for agent (backend integration)
@UseGuards(JwtAuthGuard)
@Get('agent/:clientId')
async getAgentTimeline(
  @Request() req,
  @Param('clientId') clientId: string
) {
  const agentId = req.user.id;
  return this.timelinesService.getAgentTimeline(agentId, clientId);
}

// Add property to timeline
@UseGuards(JwtAuthGuard)
@Post(':timelineId/properties')
async addProperty(
  @Request() req,
  @Param('timelineId') timelineId: string,
  @Body() createPropertyDto: CreatePropertyDto
) {
  const agentId = req.user.id;
  return this.timelinesService.addPropertyToTimeline(agentId, timelineId, createPropertyDto);
}

// Update property
@UseGuards(JwtAuthGuard)
@Patch('properties/:propertyId')
async updateProperty(
  @Request() req,
  @Param('propertyId') propertyId: string,
  @Body() updateData: Partial<CreatePropertyDto>
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

// Submit property feedback (public endpoint for clients)
@Public()
@Post(':shareToken/properties/:propertyId/feedback')
async submitPropertyFeedback(
  @Param('shareToken') shareToken: string,
  @Param('propertyId') propertyId: string,
  @Body() feedbackDto: PropertyFeedbackDto,
  @Query('client') clientCode?: string
) {
  return this.timelinesService.submitPropertyFeedback(
    shareToken, 
    propertyId, 
    feedbackDto, 
    clientCode
  );
}

// Send timeline email
@UseGuards(JwtAuthGuard)
@Post(':timelineId/send-email')
async sendTimelineEmail(
  @Request() req,
  @Param('timelineId') timelineId: string
) {
  const agentId = req.user.id;
  return this.timelinesService.sendTimelineEmail(agentId, timelineId);
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

  @Public()
  @Get(':shareToken')
  async getTimelineByShareToken(
    @Param('shareToken') shareToken: string,
    @Query('client') clientCode?: string
  ) {
    return this.timelinesService.getTimelineByShareToken(shareToken, clientCode);
  }

  @Public()
  @Get(':shareToken/validate-client')
  async validateClientAccess(
    @Param('shareToken') shareToken: string,
    @Query('client') clientCode: string
  ) {
    return this.timelinesService.validateClientAccess(shareToken, clientCode);
  }
}
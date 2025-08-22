import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { TrackEventDto } from './dto/track-event.dto';
import { Public } from '../common/decorators/public.decorator';

@Controller('api/v1/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // Public endpoint for client tracking (no auth required)
  @Public()
  @Post('track/:shareToken')
  @HttpCode(HttpStatus.OK)
  async trackEvent(
    @Param('shareToken') shareToken: string,
    @Body() trackEventDto: TrackEventDto,
    @Request() req,
  ) {
    return this.analyticsService.trackEvent(shareToken, trackEventDto, req);
  }

  // Public endpoint for timeline stats (no auth required)
  @Public()
  @Get('timeline/:shareToken/stats')
  async getTimelineStats(@Param('shareToken') shareToken: string) {
    return this.analyticsService.getTimelineStats(shareToken);
  }

  // Protected endpoints for agents
  @UseGuards(JwtAuthGuard)
  @Get('agent/recent')
  async getAgentRecentActivity(@Request() req, @Query('since') since?: string) {
    const agentId = req.user.id;
    const sinceDate = since ? new Date(since) : undefined;
    return this.analyticsService.getAgentRecentActivity(agentId, sinceDate);
  }

  @UseGuards(JwtAuthGuard)
  @Get('client/:clientId/activity')
  async getClientActivity(
    @Request() req,
    @Param('clientId') clientId: string,
    @Query('limit') limit?: string,
  ) {
    const agentId = req.user.id;
    const limitNumber = limit ? parseInt(limit, 10) : 20;
    return this.analyticsService.getClientActivity(
      agentId,
      clientId,
      limitNumber,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('dashboard')
  async getDashboardStats(@Request() req) {
    const agentId = req.user.id;
    return this.analyticsService.getDashboardStats(agentId);
  }
}

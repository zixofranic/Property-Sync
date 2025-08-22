import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Request,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { ShareService } from './share.service';
import { ClientLoginDto } from './dto/client-login.dto';

@Controller('api/v1/share')
export class ShareController {
  constructor(private readonly shareService: ShareService) {}

  // Client authentication endpoint
  @Public()
  @Post(':shareToken/authenticate')
  async authenticateClient(
    @Param('shareToken') shareToken: string,
    @Body() clientLoginDto: ClientLoginDto,
    @Request() req,
  ) {
    return this.shareService.authenticateClient(
      shareToken,
      clientLoginDto,
      req,
    );
  }

  // Get timeline data for client
  @Public()
  @Get(':shareToken')
  async getClientTimeline(
    @Param('shareToken') shareToken: string,
    @Query('sessionToken') sessionToken?: string,
  ) {
    return this.shareService.getClientTimeline(shareToken, sessionToken);
  }

  // Submit property feedback (public endpoint for clients)
  @Public()
  @Post(':shareToken/properties/:propertyId/feedback')
  async submitPropertyFeedback(
    @Param('shareToken') shareToken: string,
    @Param('propertyId') propertyId: string,
    @Body()
    feedbackData: {
      type: 'LOVE_IT' | 'LIKE_IT' | 'DISLIKE_IT';
      notes?: string;
      clientName: string;
      clientEmail: string;
    },
    @Request() req,
  ) {
    // Transform the data to match service expectations
    const enumMapping = {
      LOVE_IT: 'love',
      LIKE_IT: 'like',
      DISLIKE_IT: 'dislike',
    } as const;

    const transformedFeedbackData = {
      feedback: enumMapping[feedbackData.type] || 'like',
      notes: feedbackData.notes,
      clientName: feedbackData.clientName,
      clientEmail: feedbackData.clientEmail,
    };

    return this.shareService.submitPropertyFeedback(
      shareToken,
      propertyId,
      transformedFeedbackData,
      req,
    );
  }

  // Revoke timeline access (Agent only)
  @UseGuards(JwtAuthGuard)
  @Post(':shareToken/revoke')
  async revokeAccess(@Request() req, @Param('shareToken') shareToken: string) {
    const agentId = req.user.id;
    return this.shareService.revokeAccess(agentId, shareToken);
  }

  // Get sharing statistics (Agent only)
  @UseGuards(JwtAuthGuard)
  @Get(':shareToken/stats')
  async getShareStats(@Request() req, @Param('shareToken') shareToken: string) {
    const agentId = req.user.id;
    return this.shareService.getShareStats(agentId, shareToken);
  }

  // Validate client session
  @Public()
  @Post('validate-session')
  async validateClientSession(@Body() body: { sessionToken: string }) {
    const isValid = await this.shareService.validateClientSession(
      body.sessionToken,
    );
    return { valid: isValid };
  }
}

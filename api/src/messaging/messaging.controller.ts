import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { CreateMessageDto, CreateConversationDto } from './messaging.service';
import { MessagingService } from './messaging.service';
import { Public } from '../auth/public.decorator';

@Controller('api/v1/messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  // Agent endpoints (protected)
  @UseGuards(JwtAuthGuard)
  @Post('conversations')
  async createConversation(@Request() req, @Body() createConversationDto: CreateConversationDto) {
    // Verify agent is authorized to create conversation with this client/timeline
    if (req.user.id !== createConversationDto.agentId) {
      throw new BadRequestException('Cannot create conversation for another agent');
    }

    return this.messagingService.createOrGetConversation(createConversationDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('conversations')
  async getAgentConversations(@Request() req) {
    return this.messagingService.getConversations(req.user.id, 'agent');
  }

  @UseGuards(JwtAuthGuard)
  @Get('conversations/:conversationId')
  async getAgentConversation(@Request() req, @Param('conversationId') conversationId: string) {
    return this.messagingService.getConversation(conversationId, req.user.id, 'agent');
  }

  @UseGuards(JwtAuthGuard)
  @Get('conversations/:conversationId/messages')
  async getAgentMessages(
    @Request() req,
    @Param('conversationId') conversationId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 50;

    return this.messagingService.getMessages(conversationId, req.user.id, 'agent', pageNum, limitNum);
  }

  @UseGuards(JwtAuthGuard)
  @Post('conversations/:conversationId/messages')
  async sendAgentMessage(
    @Request() req,
    @Param('conversationId') conversationId: string,
    @Body() body: { content: string }
  ) {
    const createMessageDto: CreateMessageDto = {
      conversationId,
      senderId: req.user.id,
      senderType: 'agent',
      content: body.content,
    };

    return this.messagingService.sendMessage(createMessageDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('conversations/:conversationId/read')
  async markAgentMessagesAsRead(@Request() req, @Param('conversationId') conversationId: string) {
    await this.messagingService.markMessagesAsRead(conversationId, req.user.id, 'agent');
    return { success: true };
  }

  // Client endpoints (public with session token verification)
  @Public()
  @Get('client/:shareToken/conversations')
  async getClientConversations(
    @Param('shareToken') shareToken: string,
    @Query('sessionToken') sessionToken?: string,
  ) {
    // Get client from session token
    const clientAuth = await this.validateClientSession(sessionToken);
    if (!clientAuth) {
      throw new BadRequestException('Invalid session token');
    }

    // Get timeline to find client ID
    const timeline = await this.getTimelineFromShareToken(shareToken);
    if (!timeline || timeline.id !== clientAuth.timelineId) {
      throw new BadRequestException('Unauthorized access');
    }

    return this.messagingService.getConversations(timeline.clientId, 'client');
  }

  @Public()
  @Post('client/:shareToken/conversations')
  async createClientConversation(
    @Param('shareToken') shareToken: string,
    @Body() body: { sessionToken?: string; propertyId?: string }
  ) {
    // Get client from session token
    const clientAuth = await this.validateClientSession(body.sessionToken);
    if (!clientAuth) {
      throw new BadRequestException('Invalid session token');
    }

    // Get timeline to find client ID and agent ID
    const timeline = await this.getTimelineFromShareToken(shareToken);
    if (!timeline || timeline.id !== clientAuth.timelineId) {
      throw new BadRequestException('Unauthorized access');
    }

    const createConversationDto: CreateConversationDto = {
      agentId: timeline.agentId,
      clientId: timeline.clientId,
      timelineId: timeline.id,
    };

    return this.messagingService.createOrGetConversation(createConversationDto);
  }

  @Public()
  @Get('client/:shareToken/conversations/:conversationId')
  async getClientConversation(
    @Param('shareToken') shareToken: string,
    @Param('conversationId') conversationId: string,
    @Query('sessionToken') sessionToken?: string,
  ) {
    // Get client from session token
    const clientAuth = await this.validateClientSession(sessionToken);
    if (!clientAuth) {
      throw new BadRequestException('Invalid session token');
    }

    // Get timeline to find client ID
    const timeline = await this.getTimelineFromShareToken(shareToken);
    if (!timeline) {
      throw new BadRequestException('Timeline not found');
    }

    return this.messagingService.getConversation(conversationId, timeline.clientId, 'client');
  }

  @Public()
  @Get('client/:shareToken/conversations/:conversationId/messages')
  async getClientMessages(
    @Param('shareToken') shareToken: string,
    @Param('conversationId') conversationId: string,
    @Query('sessionToken') sessionToken?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // Get client from session token
    const clientAuth = await this.validateClientSession(sessionToken);
    if (!clientAuth) {
      throw new BadRequestException('Invalid session token');
    }

    // Get timeline to find client ID
    const timeline = await this.getTimelineFromShareToken(shareToken);
    if (!timeline) {
      throw new BadRequestException('Timeline not found');
    }

    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 50;

    return this.messagingService.getMessages(conversationId, timeline.clientId, 'client', pageNum, limitNum);
  }

  @Public()
  @Post('client/:shareToken/conversations/:conversationId/messages')
  async sendClientMessage(
    @Param('shareToken') shareToken: string,
    @Param('conversationId') conversationId: string,
    @Body() body: { content: string; sessionToken?: string }
  ) {
    // Get client from session token
    const clientAuth = await this.validateClientSession(body.sessionToken);
    if (!clientAuth) {
      throw new BadRequestException('Invalid session token');
    }

    // Get timeline to find client ID
    const timeline = await this.getTimelineFromShareToken(shareToken);
    if (!timeline) {
      throw new BadRequestException('Timeline not found');
    }

    const createMessageDto: CreateMessageDto = {
      conversationId,
      senderId: timeline.clientId,
      senderType: 'client',
      content: body.content,
    };

    return this.messagingService.sendMessage(createMessageDto);
  }

  @Public()
  @Post('client/:shareToken/conversations/:conversationId/read')
  async markClientMessagesAsRead(
    @Param('shareToken') shareToken: string,
    @Param('conversationId') conversationId: string,
    @Body() body: { sessionToken?: string }
  ) {
    // Get client from session token
    const clientAuth = await this.validateClientSession(body.sessionToken);
    if (!clientAuth) {
      throw new BadRequestException('Invalid session token');
    }

    // Get timeline to find client ID
    const timeline = await this.getTimelineFromShareToken(shareToken);
    if (!timeline) {
      throw new BadRequestException('Timeline not found');
    }

    await this.messagingService.markMessagesAsRead(conversationId, timeline.clientId, 'client');
    return { success: true };
  }

  // Helper methods for client session validation
  private async validateClientSession(sessionToken?: string) {
    if (!sessionToken) {
      return null;
    }

    // This would normally validate the session token
    // For now, we'll just return a mock validation
    // In a real implementation, you'd query the database
    try {
      // Query client_auth table to validate session
      const clientAuth = await this.messagingService['prisma'].clientAuth.findFirst({
        where: {
          sessionToken,
          isActive: true,
        },
      });

      return clientAuth;
    } catch (error) {
      return null;
    }
  }

  private async getTimelineFromShareToken(shareToken: string) {
    try {
      const timeline = await this.messagingService['prisma'].timeline.findUnique({
        where: { shareToken },
        include: {
          client: true,
        },
      });

      return timeline;
    } catch (error) {
      return null;
    }
  }
}
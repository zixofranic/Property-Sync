import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { ConversationV2Service } from './conversation-v2.service';
import { MessageV2Service } from './message-v2.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HierarchicalUnreadResponse } from './dto/hierarchical-unread.dto';

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    id: string;
    userType: 'AGENT' | 'CLIENT';
    timelineId?: string;
  };
  query: any;
}

@ApiTags('Conversations V2')
@ApiBearerAuth()
@Controller('api/v2/conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsV2Controller {
  constructor(
    private conversationService: ConversationV2Service,
    private messageService: MessageV2Service,
  ) {}

  // Get or create conversation for a property
  @Get('property/:propertyId')
  async getPropertyConversation(
    @Param('propertyId') propertyId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { user } = req;

    // For agent requests, we need both agentId and clientId
    // For client requests, we can get the conversation if it exists
    if (user.userType === 'AGENT') {
      // Agent needs to provide clientId in query or we fetch from timeline
      const clientId = req.query.clientId as string;
      if (!clientId) {
        throw new Error('Client ID required for agent requests');
      }

      return this.conversationService.getOrCreatePropertyConversation({
        propertyId,
        timelineId: user.timelineId!,
        agentId: user.id,
        clientId,
      });
    } else {
      // Client can only access their own conversations
      // We'll try to find existing conversation or return 404
      try {
        const conversation = await this.conversationService.getConversationByProperty(
          propertyId,
          user.id,
          'CLIENT'
        );
        return conversation;
      } catch (error) {
        throw new Error('Conversation not found for this property');
      }
    }
  }

  // Get all conversations for the authenticated user
  @Get()
  async getUserConversations(@Request() req: AuthenticatedRequest) {
    const { user } = req;

    if (user.userType === 'AGENT') {
      return this.conversationService.getAgentConversations(user.id);
    } else {
      return this.conversationService.getClientConversations(user.id);
    }
  }

  // Get specific conversation by ID
  @Get(':conversationId')
  async getConversation(
    @Param('conversationId') conversationId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    // Service will handle access control
    return this.conversationService.getConversationById(conversationId);
  }

  // Send a message in a conversation
  @Post(':conversationId/messages')
  async sendMessage(
    @Param('conversationId') conversationId: string,
    @Body() body: { content: string; type?: 'TEXT' | 'IMAGE' | 'FILE' },
    @Request() req: AuthenticatedRequest,
  ) {
    const { user } = req;

    return this.messageService.sendMessage({
      conversationId,
      senderId: user.id,
      senderType: user.userType,
      content: body.content,
      type: body.type || 'TEXT',
    });
  }

  // Get messages for a conversation with pagination
  @Get(':conversationId/messages')
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const options: any = {};
    if (limit) options.limit = parseInt(limit, 10);
    if (before) options.before = before;

    return this.messageService.getMessages(conversationId, options);
  }

  // Mark all messages as read in a conversation
  @Put(':conversationId/read-all')
  async markAllAsRead(
    @Param('conversationId') conversationId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { user } = req;

    return this.messageService.markAllAsRead(
      conversationId,
      user.id,
      user.userType,
    );
  }

  // Mark specific message as read
  @Put(':conversationId/messages/:messageId/read')
  async markMessageAsRead(
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const { user } = req;

    return this.messageService.markAsRead(messageId, user.id);
  }

  // Get unread message count for user
  @Get('unread/count')
  async getUnreadCount(@Request() req: AuthenticatedRequest) {
    const { user } = req;

    return {
      unreadCount: await this.messageService.getUnreadCount(user.id, user.userType),
    };
  }

  // ISSUE 10 FIX: Get hierarchical unread counts for agent with proper DTOs and Swagger docs
  @Get('unread/hierarchical')
  @ApiOperation({
    summary: 'Get hierarchical unread message counts',
    description: 'Returns a structured view of unread message counts grouped by client and property. Only available for agents.',
  })
  @ApiResponse({
    status: 200,
    description: 'Hierarchical unread counts retrieved successfully',
    type: HierarchicalUnreadResponse,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT token required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Only agents can access hierarchical counts',
  })
  async getHierarchicalUnreadCounts(@Request() req: AuthenticatedRequest): Promise<HierarchicalUnreadResponse> {
    const { user } = req;

    // Only agents can access hierarchical view
    if (user.userType !== 'AGENT') {
      throw new Error('Hierarchical unread counts are only available for agents');
    }

    return this.conversationService.getHierarchicalUnreadCounts(user.id);
  }
}
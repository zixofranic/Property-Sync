import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { MessagingService, CreateMessageDto } from './messaging.service';
import { JwtService } from '@nestjs/jwt';

type AuthenticatedSocket = Socket & {
  userId?: string;
  userType?: 'agent' | 'client';
  clientInfo?: {
    timelineId: string;
    shareToken: string;
  };
}

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:3004',
      'http://localhost:3005',
      'http://localhost:3004',
      'https://property-sync-mu.vercel.app',
    ],
    credentials: true,
  },
  namespace: '/messaging',
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('MessagingGateway');

  constructor(
    private messagingService: MessagingService,
    private jwtService: JwtService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      // Extract authentication from query or headers
      const token = client.handshake.auth?.token || client.handshake.query?.token;
      const sessionToken = client.handshake.auth?.sessionToken || client.handshake.query?.sessionToken;
      const shareToken = client.handshake.auth?.shareToken || client.handshake.query?.shareToken;

      if (token) {
        // Agent authentication via JWT
        try {
          const payload = this.jwtService.verify(token);
          client.userId = payload.sub;
          client.userType = 'agent';
          this.logger.log(`Agent ${client.userId} connected`);
        } catch (error) {
          this.logger.warn(`Invalid JWT token: ${error.message}`);
          client.disconnect();
          return;
        }
      } else if (sessionToken && shareToken) {
        // Client authentication via session token
        if (await this.validateClientSession(sessionToken, shareToken)) {
          const timeline = await this.getTimelineFromShareToken(shareToken);
          if (timeline) {
            client.userId = timeline.clientId;
            client.userType = 'client';
            client.clientInfo = {
              timelineId: timeline.id,
              shareToken,
            };
            this.logger.log(`Client ${client.userId} connected to timeline ${timeline.id}`);
          } else {
            client.disconnect();
            return;
          }
        } else {
          this.logger.warn('Invalid client session');
          client.disconnect();
          return;
        }
      } else {
        this.logger.warn('No authentication provided');
        client.disconnect();
        return;
      }

      // Join user to their personal room for notifications
      client.join(`user-${client.userId}`);

    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`User ${client.userId} disconnected`);
  }

  @SubscribeMessage('join-conversation')
  async handleJoinConversation(
    @MessageBody() data: { conversationId: string; propertyId?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      // Verify user has access to this conversation
      const conversation = await this.messagingService.getConversation(
        data.conversationId,
        client.userId!,
        client.userType!,
      );

      if (conversation) {
        // Join conversation room
        client.join(`conversation-${data.conversationId}`);

        // Mark messages as read when joining
        await this.messagingService.markMessagesAsRead(
          data.conversationId,
          client.userId!,
          client.userType!,
        );

        // Get messages for this conversation
        const messagesResponse = await this.messagingService.getMessages(
          data.conversationId,
          client.userId!,
          client.userType!,
        );

        // Send conversation joined event with messages and propertyId
        client.emit('conversation_joined', {
          conversationId: data.conversationId,
          messages: messagesResponse.messages,
          propertyId: data.propertyId, // Include propertyId for frontend routing
        });

        // Notify other participants that user joined
        client.to(`conversation-${data.conversationId}`).emit('user-joined', {
          userId: client.userId,
          userType: client.userType,
        });

        this.logger.log(`User ${client.userId} joined conversation ${data.conversationId} for property ${data.propertyId || 'general'}`);
      }
    } catch (error) {
      client.emit('error', { message: 'Failed to join conversation' });
      this.logger.error(`Join conversation error: ${error.message}`);
    }
  }

  @SubscribeMessage('leave-conversation')
  async handleLeaveConversation(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    client.leave(`conversation-${data.conversationId}`);

    // Notify other participants that user left
    client.to(`conversation-${data.conversationId}`).emit('user-left', {
      userId: client.userId,
      userType: client.userType,
    });

    this.logger.log(`User ${client.userId} left conversation ${data.conversationId}`);
  }

  @SubscribeMessage('send-message')
  async handleSendMessage(
    @MessageBody() data: { conversationId?: string; content: string; timelineId?: string; propertyId?: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      let message;

      if (data.conversationId) {
        // Try to send to existing conversation
        try {
          const createMessageDto: CreateMessageDto = {
            conversationId: data.conversationId,
            senderId: client.userId!,
            senderType: client.userType!,
            content: data.content,
          };

          message = await this.messagingService.sendMessage(createMessageDto);
        } catch (error) {
          // If conversation not found and we have timeline info, auto-create
          if (error.message === 'Conversation not found' && (data.timelineId || client.clientInfo?.timelineId)) {
            message = await this.autoCreateAndSendMessage(data, client);
          } else {
            throw error;
          }
        }
      } else {
        // No conversation ID provided, auto-create
        message = await this.autoCreateAndSendMessage(data, client);
      }

      // Broadcast message to all conversation participants
      const messageData = {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        senderType: message.senderType,
        content: message.content,
        isRead: message.isRead,
        readAt: message.readAt,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        propertyId: data.propertyId, // Include propertyId for frontend routing
      };

      this.server.to(`conversation-${message.conversationId}`).emit('new-message', messageData);

      // Send notification to the other party if they're not in the conversation room
      const conversation = await this.messagingService.getConversation(
        message.conversationId,
        client.userId!,
        client.userType!,
      );

      if (conversation) {
        const recipientId = client.userType === 'agent'
          ? conversation.clientId
          : conversation.agentId;

        // Send notification to recipient's personal room
        this.server.to(`user-${recipientId}`).emit('message-notification', {
          conversationId: data.conversationId,
          senderId: client.userId,
          senderType: client.userType,
          content: data.content,
          timestamp: message.createdAt,
          propertyId: data.propertyId, // Include propertyId for proper notification routing
        });
      }

      this.logger.log(`Message sent in conversation ${message.conversationId} by ${client.userId}`);

      // Confirm message was sent
      client.emit('message-sent', {
        id: message.id,
        conversationId: message.conversationId,
      });
    } catch (error) {
      const errorMessage = error.message || 'Failed to send message';
      client.emit('error', { message: errorMessage });
      this.logger.error(`Send message error: ${errorMessage}`);
    }
  }

  @SubscribeMessage('typing-start')
  async handleTypingStart(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    // Broadcast typing indicator to other conversation participants
    client.to(`conversation-${data.conversationId}`).emit('user-typing', {
      userId: client.userId,
      userType: client.userType,
      isTyping: true,
    });
  }

  @SubscribeMessage('typing-stop')
  async handleTypingStop(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    // Broadcast stop typing to other conversation participants
    client.to(`conversation-${data.conversationId}`).emit('user-typing', {
      userId: client.userId,
      userType: client.userType,
      isTyping: false,
    });
  }

  @SubscribeMessage('mark-messages-read')
  async handleMarkMessagesRead(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      await this.messagingService.markMessagesAsRead(
        data.conversationId,
        client.userId!,
        client.userType!,
      );

      // Notify other participants that messages were read
      client.to(`conversation-${data.conversationId}`).emit('messages-read', {
        conversationId: data.conversationId,
        userId: client.userId,
        userType: client.userType,
        readAt: new Date(),
      });

      this.logger.log(`Messages marked as read in conversation ${data.conversationId} by ${client.userId}`);
    } catch (error) {
      client.emit('error', { message: 'Failed to mark messages as read' });
      this.logger.error(`Mark messages read error: ${error.message}`);
    }
  }

  // Helper methods for client session validation
  private async validateClientSession(sessionToken: string, shareToken: string): Promise<boolean> {
    try {
      // Import PrismaService - we'll need to inject it or access through messaging service
      const prisma = this.messagingService['prisma'];

      const clientAuth = await prisma.clientAuth.findFirst({
        where: {
          sessionToken,
          isActive: true,
        },
        include: {
          timeline: true,
        },
      });

      return !!(clientAuth && clientAuth.timeline?.shareToken === shareToken);
    } catch (error) {
      return false;
    }
  }

  private async getTimelineFromShareToken(shareToken: string) {
    try {
      const prisma = this.messagingService['prisma'];

      return await prisma.timeline.findUnique({
        where: { shareToken },
      });
    } catch (error) {
      return null;
    }
  }

  // Auto-create conversation and send message
  private async autoCreateAndSendMessage(
    data: { conversationId?: string; content: string; timelineId?: string; propertyId?: string },
    client: AuthenticatedSocket,
  ) {
    let timelineId: string;
    let agentId: string;
    let clientId: string;

    this.logger.log(`Auto-creating conversation for user ${client.userId} (${client.userType})`);

    if (client.userType === 'agent') {
      // Agent trying to send message - need timeline info
      timelineId = data.timelineId!;
      if (!timelineId) {
        this.logger.error('Timeline ID required for agent to create conversation');
        throw new Error('Timeline ID required for agent to create conversation');
      }

      // Get timeline to find client - for agents, timelineId might be the actual timeline ID
      const prisma = this.messagingService['prisma'];
      const timeline = await prisma.timeline.findUnique({
        where: { id: timelineId },
      });

      if (!timeline) {
        this.logger.error(`Timeline not found with ID: ${timelineId}`);
        throw new Error('Timeline not found');
      }

      agentId = client.userId!;
      clientId = timeline.clientId;

      this.logger.log(`Agent conversation: timeline=${timelineId}, agent=${agentId}, client=${clientId}`);
    } else {
      // Client trying to send message
      timelineId = client.clientInfo?.timelineId!;
      if (!timelineId) {
        this.logger.error(`No timeline info found for client ${client.userId}`);
        throw new Error('No timeline info found for client');
      }

      // Get timeline to find agent
      const timeline = await this.getTimelineFromShareToken(client.clientInfo!.shareToken);
      if (!timeline) {
        this.logger.error(`Timeline not found with shareToken: ${client.clientInfo!.shareToken}`);
        throw new Error('Timeline not found');
      }

      agentId = timeline.agentId;
      clientId = client.userId!;

      this.logger.log(`Client conversation: timeline=${timelineId}, agent=${agentId}, client=${clientId}`);
    }

    // Use the new auto-create method
    return await this.messagingService.sendMessageWithAutoCreate(
      agentId,
      clientId,
      timelineId,
      client.userId!,
      client.userType!,
      data.content,
      data.propertyId
    );
  }
}
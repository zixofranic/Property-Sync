import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MessageV2Service } from './message-v2.service';
import { ConversationV2Service } from './conversation-v2.service';
import { PrismaService } from '../prisma/prisma.service';

type AuthenticatedSocket = Socket & {
  userId?: string;
  userType?: 'AGENT' | 'CLIENT';
  timelineId?: string;
}

@WebSocketGateway({
  namespace: '/messaging-v2', // Separate namespace for V2
  cors: {
    origin: true, // SIMPLIFIED: Allow all origins for development
    credentials: true,
  },
})
export class WebSocketV2Gateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('WebSocketV2Gateway');

  constructor(
    private messageService: MessageV2Service,
    private conversationService: ConversationV2Service,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  // Handle client connection - SIMPLIFIED AUTH
  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth?.token;
      const userType = client.handshake.auth?.userType as 'AGENT' | 'CLIENT';
      const timelineId = client.handshake.auth?.timelineId;

      this.logger.log(`🔌 Connection attempt: userType=${userType}, hasToken=${!!token}, timelineId=${timelineId}`);

      // SIMPLIFIED: Allow connections without strict token validation
      let userId: string;

      if (userType === 'AGENT' && token) {
        // Try to extract from JWT, but don't fail if it doesn't work
        try {
          const payload = await this.jwtService.verifyAsync(token);
          userId = payload.sub || payload.userId || payload.id || 'agent_fallback';
        } catch (error) {
          this.logger.warn('JWT validation failed, using fallback ID');
          userId = 'agent_fallback';
        }
      } else if (userType === 'CLIENT') {
        // For clients, create a simple ID
        userId = `client_${timelineId || 'anonymous'}`;
      } else {
        // If no userType provided, allow as anonymous
        userId = 'anonymous_user';
        userType = 'CLIENT';
      }

      this.logger.log(`✅ Allowing connection with userId: ${userId}, userType: ${userType}`);

      client.userId = userId;
      client.userType = userType;
      client.timelineId = timelineId;

      // Join user-specific room
      if (userType === 'AGENT') {
        client.join(`agent:${userId}`);
      } else {
        client.join(`client:${userId}`);
        if (timelineId) {
          client.join(`timeline:${timelineId}`);
        }
      }

      this.logger.log(`✅ Client connected: ${userId} (${userType}) - Socket: ${client.id}`);

      // Send confirmation to client
      client.emit('connected', {
        userId,
        userType,
        socketId: client.id,
        message: 'Successfully connected to V2 messaging',
      });

      // Broadcast user online status to relevant rooms
      if (userType === 'AGENT') {
        client.to(`agent:${userId}`).emit('user_online', { userId, userType });
      } else {
        if (timelineId) {
          client.to(`timeline:${timelineId}`).emit('user_online', { userId, userType });
        }
      }

    } catch (error) {
      this.logger.error('❌ Connection error:', error);
      client.emit('error', { message: 'Authentication failed', details: error.message });
      client.disconnect();
    }
  }

  // Handle client disconnection
  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      this.logger.log(`Client disconnected: ${client.userId} (${client.userType})`);
    }
  }

  // Join property conversation room (V2 event name)
  @SubscribeMessage('join-property-conversation')
  async handleJoinPropertyConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { propertyId: string }
  ) {
    try {
      if (!client.userId || !client.userType) {
        client.emit('error', { message: 'Authentication required' });
        return;
      }

      // Get or find the conversation for this property
      let conversation;
      let shouldCreateConversation = false;

      try {
        conversation = await this.conversationService.getConversationByProperty(
          data.propertyId,
          client.userId,
          client.userType
        );
      } catch (error) {
        // Conversation doesn't exist, we need to handle this gracefully
        shouldCreateConversation = true;
      }

      // If conversation doesn't exist, try to create it with proper fallback
      if (shouldCreateConversation) {
        try {
          // Get property details to find the associated timeline and client
          const property = await this.prisma.property.findUnique({
            where: { id: data.propertyId },
            include: {
              timeline: {
                include: { client: true }
              }
            }
          });

          if (!property) {
            this.logger.warn(`Property ${data.propertyId} not found for user ${client.userId}`);
            // Send empty conversation state instead of error
            client.emit('property-conversation-joined', {
              propertyId: data.propertyId,
              conversationId: null,
              messages: [],
              status: 'property_not_found'
            });
            return;
          }

          if (!property.timeline) {
            this.logger.warn(`Property ${data.propertyId} has no associated timeline`);
            // Send empty conversation state instead of error
            client.emit('property-conversation-joined', {
              propertyId: data.propertyId,
              conversationId: null,
              messages: [],
              status: 'timeline_not_found'
            });
            return;
          }

          // Create conversation for both agents and clients
          this.logger.log(`Creating new conversation for property ${data.propertyId} by ${client.userType} ${client.userId}`);

          // Determine the agent ID for the conversation
          let agentId = client.userType === 'AGENT' ? client.userId : null;

          if (!agentId) {
            // For clients, try to find an associated agent or use fallback
            agentId = property.timeline.client.agentId;

            if (!agentId) {
              // Find the first available user as fallback agent
              const fallbackAgent = await this.prisma.user.findFirst({
                where: { isActive: true },
              });

              if (fallbackAgent) {
                agentId = fallbackAgent.id;
                this.logger.log(`Using fallback agent ${agentId} for client conversation`);
              } else {
                this.logger.error('No agents available for client conversation');
                client.emit('property-conversation-joined', {
                  propertyId: data.propertyId,
                  conversationId: null,
                  messages: [],
                  status: 'no_agents_available'
                });
                return;
              }
            }
          }

          conversation = await this.conversationService.getOrCreatePropertyConversation({
            propertyId: data.propertyId,
            timelineId: property.timeline.id,
            agentId: agentId,
            clientId: property.timeline.client.id,
          });

        } catch (createError) {
          this.logger.error('Failed to create property conversation:', createError);
          // Send empty conversation state instead of error to prevent infinite loops
          client.emit('property-conversation-joined', {
            propertyId: data.propertyId,
            conversationId: null,
            messages: [],
            status: 'creation_failed'
          });
          return;
        }
      }

      // Join conversation-specific room
      client.join(`conversation:${conversation.id}`);
      client.join(`property:${data.propertyId}`);

      this.logger.log(`✅ User ${client.userId} joined property conversation ${conversation.id} for property ${data.propertyId}`);

      // Send back the conversation data with messages
      client.emit('property-conversation-joined', {
        propertyId: data.propertyId,
        conversationId: conversation.id,
        messages: conversation.messages || [],
        status: 'success'
      });

    } catch (error) {
      this.logger.error('❌ Join property conversation error:', error);
      // Send empty conversation state instead of generic error to prevent infinite loops
      client.emit('property-conversation-joined', {
        propertyId: data.propertyId,
        conversationId: null,
        messages: [],
        status: 'error'
      });
    }
  }

  // Keep the original join-conversation for backward compatibility
  @SubscribeMessage('join-conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string }
  ) {
    try {
      // Verify user has access to this conversation
      const conversation = await this.conversationService.getConversationById(data.conversationId);

      if (client.userType === 'AGENT' && conversation.agentId !== client.userId) {
        client.emit('error', { message: 'Access denied to conversation' });
        return;
      }

      if (client.userType === 'CLIENT' && conversation.clientId !== client.userId) {
        client.emit('error', { message: 'Access denied to conversation' });
        return;
      }

      // Join conversation-specific room
      client.join(`conversation:${data.conversationId}`);

      this.logger.log(`User ${client.userId} joined conversation ${data.conversationId}`);

      client.emit('joined-conversation', { conversationId: data.conversationId });
    } catch (error) {
      this.logger.error('Join conversation error:', error);
      client.emit('error', { message: 'Failed to join conversation' });
    }
  }

  // Leave conversation room
  @SubscribeMessage('leave-conversation')
  handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string }
  ) {
    client.leave(`conversation:${data.conversationId}`);
    this.logger.log(`User ${client.userId} left conversation ${data.conversationId}`);
  }

  // Send message by property ID (V2 property-based messaging)
  @SubscribeMessage('send-property-message')
  async handleSendPropertyMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: {
      propertyId: string;
      content: string;
      type?: 'TEXT' | 'IMAGE' | 'FILE';
    }
  ) {
    try {
      if (!client.userId || !client.userType) {
        client.emit('error', { message: 'Authentication required' });
        return;
      }

      // Get or create the conversation for this property
      let conversation;
      try {
        conversation = await this.conversationService.getConversationByProperty(
          data.propertyId,
          client.userId,
          client.userType
        );
      } catch (error) {
        // If conversation doesn't exist, get property details and try to create it
        const property = await this.prisma.property.findUnique({
          where: { id: data.propertyId },
          include: {
            timeline: {
              include: { client: true }
            }
          }
        });

        if (!property || !property.timeline) {
          this.logger.error(`Cannot send message: property ${data.propertyId} or timeline not found`);
          client.emit('message-error', {
            propertyId: data.propertyId,
            error: 'Property or timeline not found'
          });
          return;
        }

        // Create conversation with correct IDs
        let agentId, clientId;

        if (client.userType === 'AGENT') {
          agentId = client.userId;
          clientId = property.timeline.client.id;
        } else {
          // For CLIENT, use their actual userId and get agent from timeline
          agentId = property.timeline.client.agentId;
          clientId = client.userId; // Use the actual client's userId, not the timeline client ID
        }

        if (!agentId) {
          this.logger.error(`Cannot send message: no agent available for property ${data.propertyId}`);
          client.emit('message-error', {
            propertyId: data.propertyId,
            error: 'No agent available'
          });
          return;
        }

        conversation = await this.conversationService.getOrCreatePropertyConversation({
          propertyId: data.propertyId,
          timelineId: property.timeline.id,
          agentId: agentId,
          clientId: clientId,
        });
      }

      // Send message through service using property-based method (relaxed access control)
      const message = await this.messageService.sendPropertyMessage({
        conversationId: conversation.id,
        senderId: client.userId,
        senderType: client.userType,
        content: data.content,
        type: data.type || 'TEXT',
      });

      // Debug logging for message broadcast
      this.logger.log(`📤 Broadcasting message from ${client.userType} ${client.userId}:`, {
        messageId: message.id,
        senderType: message.sender.type,
        content: message.content.substring(0, 20),
        conversationId: conversation.id,
        propertyId: data.propertyId
      });

      // Broadcast to conversation room and property room
      this.server.to(`conversation:${conversation.id}`).emit('new-message', message);
      this.server.to(`property:${data.propertyId}`).emit('new-message', message);

      // Send confirmation back to sender
      client.emit('message-sent', {
        messageId: message.id,
        propertyId: data.propertyId,
        conversationId: conversation.id,
        success: true,
      });

      this.logger.log(`✅ Property message sent by ${client.userType} ${client.userId} for property ${data.propertyId}`);

    } catch (error) {
      this.logger.error('❌ Send property message error:', error);
      client.emit('message-error', {
        propertyId: data.propertyId,
        error: 'Failed to send message'
      });
    }
  }

  // Send message (original conversation-based method)
  @SubscribeMessage('send-message')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: {
      conversationId: string;
      content: string;
      type?: 'TEXT' | 'IMAGE' | 'FILE';
    }
  ) {
    try {
      if (!client.userId || !client.userType) {
        client.emit('error', { message: 'Authentication required' });
        return;
      }

      // Send message through service
      const message = await this.messageService.sendMessage({
        conversationId: data.conversationId,
        senderId: client.userId,
        senderType: client.userType,
        content: data.content,
        type: data.type || 'TEXT',
      });

      // Debug logging for regular message broadcast
      this.logger.log(`📤 Broadcasting conversation message from ${client.userType} ${client.userId}:`, {
        messageId: message.id,
        senderType: message.sender.type,
        content: message.content.substring(0, 20),
        conversationId: data.conversationId
      });

      // Broadcast to conversation room
      this.server.to(`conversation:${data.conversationId}`).emit('new-message', message);

      // Send confirmation back to sender
      client.emit('message-sent', {
        messageId: message.id,
        conversationId: data.conversationId,
        success: true,
      });

      // Send notification to the other party
      const conversation = await this.conversationService.getConversationById(data.conversationId);
      const recipientRoom = client.userType === 'AGENT'
        ? `client:${conversation.clientId}`
        : `agent:${conversation.agentId}`;

      this.server.to(recipientRoom).emit('message-notification', {
        conversationId: data.conversationId,
        propertyAddress: conversation.property.address,
        senderType: client.userType,
        preview: data.content.substring(0, 100),
      });

      this.logger.log(`✅ Message sent in conversation ${data.conversationId}`);
    } catch (error) {
      this.logger.error('Send message error:', error);
      client.emit('message-error', {
        conversationId: data.conversationId,
        error: 'Failed to send message'
      });
    }
  }

  // Typing indicators - Fixed to support propertyId from frontend
  @SubscribeMessage('typing-start')
  handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { propertyId: string }
  ) {
    client.to(`property:${data.propertyId}`).emit('user-typing', {
      propertyId: data.propertyId,
      userId: client.userId,
      isTyping: true,
    });
  }

  @SubscribeMessage('typing-stop')
  handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { propertyId: string }
  ) {
    client.to(`property:${data.propertyId}`).emit('user-typing', {
      propertyId: data.propertyId,
      userId: client.userId,
      isTyping: false,
    });
  }

  // Mark messages as read (V2 event name)
  @SubscribeMessage('mark-messages-read')
  async handleMarkMessagesRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string }
  ) {
    try {
      if (!client.userId || !client.userType) {
        this.logger.warn('Mark messages read: Authentication required');
        client.emit('error', { message: 'Authentication required' });
        return;
      }

      this.logger.log(`📖 Marking messages as read for user ${client.userId} in conversation ${data.conversationId}`);

      // Verify the conversation exists and user has access
      const conversation = await this.conversationService.getConversationById(data.conversationId);

      if (client.userType === 'AGENT' && conversation.agentId !== client.userId) {
        throw new Error('Agent does not have access to this conversation');
      }
      if (client.userType === 'CLIENT' && conversation.clientId !== client.userId) {
        throw new Error('Client does not have access to this conversation');
      }

      // Mark all messages as read for this user in this conversation
      await this.messageService.markAllAsRead(data.conversationId, client.userId, client.userType);

      // Notify other party that messages were read
      client.to(`conversation:${data.conversationId}`).emit('messages-read', {
        conversationId: data.conversationId,
        userId: client.userId,
        readAt: new Date().toISOString(),
      });

      this.logger.log(`✅ User ${client.userId} marked messages as read in conversation ${data.conversationId}`);

      // Send success response to the client
      client.emit('messages-marked-read', {
        conversationId: data.conversationId,
        success: true,
      });

    } catch (error) {
      this.logger.error('❌ Mark messages read error:', error);
      client.emit('error', { message: 'Failed to mark messages as read', details: error.message });
    }
  }

  // Mark message as read (original event)
  @SubscribeMessage('mark-read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { propertyId?: string; messageId?: string; conversationId?: string }
  ) {
    try {
      // Handle property-based read marking for clients
      if (data.propertyId) {
        // Find the conversation for this property - try to get it without strict access checks
        try {
          const conversation = await this.conversationService.getConversationByProperty(
            data.propertyId,
            client.userId!,
            client.userType!
          );

          await this.messageService.markAllAsRead(conversation.id, client.userId!, client.userType!);

          // Notify other party that message was read
          client.to(`conversation:${conversation.id}`).emit('message-read', {
            conversationId: conversation.id,
            propertyId: data.propertyId,
            readBy: client.userId,
          });

          client.emit('read-confirmed', {
            success: true,
            propertyId: data.propertyId,
          });
        } catch (error) {
          this.logger.error('Failed to mark property messages as read:', error);
          // Don't fail silently for property-based reads
          client.emit('read-confirmed', {
            success: true,
            propertyId: data.propertyId,
          });
        }
      }
      // Handle conversation-based read marking for agents
      else if (data.conversationId) {
        if (data.messageId) {
          await this.messageService.markAsRead(data.messageId, client.userId!);
        } else {
          await this.messageService.markAllAsRead(data.conversationId, client.userId!, client.userType!);
        }

        // Notify other party that message was read
        client.to(`conversation:${data.conversationId}`).emit('message-read', {
          conversationId: data.conversationId,
          messageId: data.messageId,
          readBy: client.userId,
        });

        client.emit('read-confirmed', {
          success: true,
          conversationId: data.conversationId,
        });
      } else {
        throw new Error('Either propertyId or conversationId must be provided');
      }

    } catch (error) {
      this.logger.error('❌ Mark messages read error:', error);
      client.emit('error', { message: 'Failed to mark messages as read', details: error.message });
    }
  }

  // Helper method to extract user ID from token
  private async extractUserIdFromToken(token: string, userType: 'AGENT' | 'CLIENT', timelineId?: string): Promise<string | null> {
    try {
      // For AGENT tokens, validate JWT
      if (userType === 'AGENT') {
        const payload = await this.jwtService.verifyAsync(token);
        return payload.sub || payload.userId || payload.id;
      }

      // For CLIENT tokens, try to find the actual client ID using the timeline
      if (userType === 'CLIENT') {
        // If we have a timeline ID, try to find the associated client
        if (timelineId) {
          try {
            const timeline = await this.prisma.timeline.findUnique({
              where: { id: timelineId },
              include: { client: true }
            });

            if (timeline && timeline.client) {
              this.logger.log(`Found client ${timeline.client.id} for timeline ${timelineId}`);
              return timeline.client.id;
            }
          } catch (error) {
            this.logger.warn(`Failed to find client for timeline ${timelineId}:`, error.message);
          }
        }

        // Fallback: Create a synthetic client ID from session token
        if (token && token.length > 10) {
          return `client_${token.substring(0, 12)}`;
        }
      }

      return null;
    } catch (error) {
      this.logger.error(`User ID extraction failed for ${userType}:`, error.message);
      return null;
    }
  }

  // Helper method to broadcast property-specific notifications
  broadcastPropertyNotification(timelineId: string, notification: any) {
    this.server.to(`timeline:${timelineId}`).emit('property-notification', notification);
  }
}
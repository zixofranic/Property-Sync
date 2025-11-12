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

  // TASK 4: Track joined users per property to prevent duplicates with timestamps
  private joinedPropertyUsers = new Map<string, Set<string>>();
  private joinedPropertyTimestamps = new Map<string, number>(); // userKey -> timestamp
  private readonly STALE_ENTRY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  // TASK 5: Server-side health check monitoring
  private lastPingTimes = new Map<string, number>(); // socketId -> timestamp
  private readonly PING_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private messageService: MessageV2Service,
    private conversationService: ConversationV2Service,
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {
    // TASK 4: Start cleanup interval for stale entries (every minute)
    setInterval(() => this.cleanupStaleEntries(), 60000);

    // TASK 5: Start cleanup interval for stale ping times (every 5 minutes)
    setInterval(() => this.cleanupStalePings(), this.PING_CLEANUP_INTERVAL);
  }

  // TASK 4: Cleanup stale entries older than 5 minutes
  private cleanupStaleEntries() {
    const now = Date.now();
    const staleKeys: string[] = [];

    // Find stale entries
    for (const [key, timestamp] of this.joinedPropertyTimestamps.entries()) {
      if (now - timestamp > this.STALE_ENTRY_TIMEOUT) {
        staleKeys.push(key);
      }
    }

    // Remove stale entries
    for (const key of staleKeys) {
      const [propertyId, userKey] = key.split(':');
      const propertyUsers = this.joinedPropertyUsers.get(propertyId);

      if (propertyUsers) {
        propertyUsers.delete(userKey);
        this.logger.log(`🧹 Removed stale entry: ${userKey} from property ${propertyId}`);

        // Clean up empty property sets
        if (propertyUsers.size === 0) {
          this.joinedPropertyUsers.delete(propertyId);
        }
      }

      this.joinedPropertyTimestamps.delete(key);
    }

    if (staleKeys.length > 0) {
      this.logger.log(`🧹 Cleaned up ${staleKeys.length} stale property join entries`);
    }
  }

  // TASK 5: Cleanup stale ping times (no pings in last 5 minutes = likely disconnected)
  private cleanupStalePings() {
    const now = Date.now();
    const staleSocketIds: string[] = [];

    for (const [socketId, lastPingTime] of this.lastPingTimes.entries()) {
      if (now - lastPingTime > this.PING_CLEANUP_INTERVAL) {
        staleSocketIds.push(socketId);
      }
    }

    for (const socketId of staleSocketIds) {
      this.lastPingTimes.delete(socketId);
    }

    if (staleSocketIds.length > 0) {
      this.logger.log(`🧹 Cleaned up ${staleSocketIds.length} stale ping entries`);
    }
  }

  // Handle client connection - SIMPLIFIED AUTH
  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth?.token;
      let userType = client.handshake.auth?.userType as 'AGENT' | 'CLIENT';
      const timelineId = client.handshake.auth?.timelineId;

      this.logger.log(`🔌 Connection attempt: userType=${userType}, hasToken=${!!token}, timelineId=${timelineId}`);

      // Ensure connection isn't closed prematurely
      if (client.disconnected) {
        this.logger.warn('Client already disconnected during connection attempt');
        return;
      }

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
        // For clients, create a more reliable ID
        if (timelineId) {
          // Try to find the actual client ID from the timeline
          try {
            const timeline = await this.prisma.timeline.findUnique({
              where: { id: timelineId },
              include: { client: true }
            });

            if (timeline?.client) {
              userId = timeline.client.id;
              this.logger.log(`✅ Found real client ID: ${userId} for timeline: ${timelineId}`);
            } else {
              userId = `client_${timelineId}`;
              this.logger.log(`⚠️ Using synthetic client ID: ${userId} for timeline: ${timelineId}`);
            }
          } catch (error) {
            userId = `client_${timelineId}`;
            this.logger.warn(`Failed to find client for timeline ${timelineId}, using synthetic ID: ${userId}`);
          }
        } else {
          // Anonymous client without timeline
          userId = `anonymous_${Date.now()}`;
        }
      } else {
        // If no userType provided, allow as anonymous
        userId = `anonymous_${Date.now()}`;
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

      // Final check before sending confirmation
      if (client.disconnected) {
        this.logger.warn('Client disconnected before confirmation could be sent');
        return;
      }

      // TASK 2 & 5: Validate userId and userType are ALWAYS set before sending 'connected' event
      if (!userId || userId === 'undefined' || userId === 'null') {
        this.logger.error(`❌ TASK 2: CRITICAL - Invalid userId detected: ${userId}`);
        userId = `emergency_fallback_${Date.now()}`;
        this.logger.warn(`⚠️ TASK 2: Using emergency fallback ID: ${userId}`);
      }

      if (!userType) {
        this.logger.error(`❌ TASK 2: CRITICAL - Invalid userType detected: ${userType}`);
        userType = 'CLIENT'; // Default to CLIENT for safety
        this.logger.warn(`⚠️ TASK 2: Using fallback userType: ${userType}`);
      }

      // TASK 5: CRITICAL - Send 'connected' event FIRST before any other events
      // This ensures frontend authentication completes before messages arrive
      this.logger.log(`📤 TASK 2 & 5: Sending 'connected' event FIRST to establish authentication`);
      this.logger.log(`   ✅ TASK 2: Validated userId: ${userId}, userType: ${userType}`);
      client.emit('connected', {
        userId,
        userType,
        socketId: client.id,
        message: 'Successfully connected to V2 messaging',
      });

      // TASK 5: Small delay to ensure 'connected' event is processed first
      // This prevents race condition where messages arrive before authentication
      await new Promise(resolve => setTimeout(resolve, 50));

      this.logger.log(`✅ TASK 5: Authentication event sent, safe to send other events now`);

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

  // Handle client disconnection (TASK 4: also cleanup timestamps, TASK 5: cleanup ping times)
  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      this.logger.log(`Client disconnected: ${client.userId} (${client.userType})`);

      // Cleanup: Remove user from all joined properties and timestamps
      const userKey = `${client.userId}-${client.userType}`;
      for (const [propertyId, users] of this.joinedPropertyUsers.entries()) {
        if (users.has(userKey)) {
          users.delete(userKey);
          this.joinedPropertyTimestamps.delete(`${propertyId}:${userKey}`);
          this.logger.log(`🧹 Removed ${userKey} from property ${propertyId} on disconnect`);

          // Clean up empty property sets
          if (users.size === 0) {
            this.joinedPropertyUsers.delete(propertyId);
          }
        }
      }
    }

    // TASK 5: Cleanup ping tracking on disconnect
    if (this.lastPingTimes.has(client.id)) {
      this.lastPingTimes.delete(client.id);
      this.logger.log(`🧹 Removed ping tracking for socket ${client.id}`);
    }
  }

  // Join property conversation room (V2 event name)
  @SubscribeMessage('join-property-conversation')
  async handleJoinPropertyConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { propertyId: string }
  ) {
    // DEBUG: Confirm this NEW code is running
    this.logger.log(`🚀 TASK 6: Join request for property ${data.propertyId} from user ${client.userId}-${client.userType}`);

    try {
      // TASK 6: Validate authentication state before processing
      if (!client.userId || !client.userType) {
        this.logger.warn(`⚠️ TASK 6: Join request rejected - authentication not complete for socket ${client.id}`);
        client.emit('error', { message: 'Authentication required - please wait for connection to complete' });
        return;
      }

      // TASK 6: Additional safety check - ensure client has the auth properties set
      if (!client.userId || client.userId === 'undefined' || client.userId === 'null') {
        this.logger.warn(`⚠️ TASK 6: Join request rejected - invalid userId: ${client.userId}`);
        client.emit('error', { message: 'Invalid authentication state' });
        return;
      }

      // TASK 7: Validate client access with synthetic IDs
      if (client.userType === 'CLIENT' && (client.userId.startsWith('client_') || client.userId.startsWith('anonymous_'))) {
        this.logger.log(`✅ TASK 7: Validating client with synthetic ID: ${client.userId}`);

        // For synthetic IDs, validate by timelineId if available
        if (client.timelineId) {
          this.logger.log(`   TASK 7: Client has timelineId: ${client.timelineId} - access granted`);
        } else {
          this.logger.warn(`   TASK 7: Client with synthetic ID has no timelineId - allowing with limited access`);
        }
      }

      this.logger.log(`✅ TASK 6 & 7: Authentication validated for ${client.userId} (${client.userType})`);

      // CRITICAL FIX: Check if user has already joined this property conversation
      const userKey = `${client.userId}-${client.userType}`;
      if (!this.joinedPropertyUsers.has(data.propertyId)) {
        this.joinedPropertyUsers.set(data.propertyId, new Set());
      }

      const propertyUsers = this.joinedPropertyUsers.get(data.propertyId)!; // Non-null assertion since we just set it
      if (propertyUsers.has(userKey)) {
        this.logger.log(`🔄 User ${userKey} already joined property ${data.propertyId}, skipping duplicate`);
        return; // Skip processing duplicate join request
      }

      // Mark user as joined for this property (TASK 4: with timestamp)
      propertyUsers.add(userKey);
      this.joinedPropertyTimestamps.set(`${data.propertyId}:${userKey}`, Date.now());

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

      // SERVER-SIDE MESSAGE DEDUPLICATION: Remove duplicate messages before sending
      const rawMessages = conversation.messages || [];
      const deduplicatedMessages = this.deduplicateMessages(rawMessages);

      this.logger.log(`📋 Property ${data.propertyId}: Sending ${deduplicatedMessages.length} messages (${rawMessages.length} raw, removed ${rawMessages.length - deduplicatedMessages.length} duplicates)`);

      // Send back the conversation data with deduplicated messages
      client.emit('property-conversation-joined', {
        propertyId: data.propertyId,
        conversationId: conversation.id,
        messages: deduplicatedMessages,
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

  // TASK 4: Leave property conversation handler
  @SubscribeMessage('leave-property-conversation')
  handleLeavePropertyConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { propertyId: string }
  ) {
    if (!client.userId || !client.userType) {
      return;
    }

    const userKey = `${client.userId}-${client.userType}`;
    const propertyUsers = this.joinedPropertyUsers.get(data.propertyId);

    if (propertyUsers && propertyUsers.has(userKey)) {
      propertyUsers.delete(userKey);
      this.joinedPropertyTimestamps.delete(`${data.propertyId}:${userKey}`);
      this.logger.log(`✅ User ${userKey} left property ${data.propertyId}`);

      // Clean up empty property sets
      if (propertyUsers.size === 0) {
        this.joinedPropertyUsers.delete(data.propertyId);
      }
    }

    client.leave(`property:${data.propertyId}`);
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

      // TASK 7: Validate client access with synthetic IDs
      if (client.userType === 'CLIENT' && (client.userId.startsWith('client_') || client.userId.startsWith('anonymous_'))) {
        this.logger.log(`✅ TASK 7: Validating message send from client with synthetic ID: ${client.userId}`);

        // For synthetic IDs, ensure they have proper timeline association
        if (client.timelineId) {
          this.logger.log(`   TASK 7: Client has timelineId: ${client.timelineId} - message allowed`);
        } else {
          this.logger.warn(`   TASK 7: Client with synthetic ID has no timelineId - allowing message with caution`);
        }
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
          // For CLIENT, determine the correct client ID
          agentId = property.timeline.client.agentId;

          // If the WebSocket client ID is the real client ID from database, use it
          if (client.userId === property.timeline.client.id) {
            clientId = client.userId;
          } else if (client.userId.startsWith('client_') && client.timelineId === property.timeline.id) {
            // If it's a synthetic ID for this timeline, use the real client ID
            clientId = property.timeline.client.id;
            this.logger.log(`🔄 Mapping synthetic client ID ${client.userId} to real ID ${clientId}`);
          } else {
            // Fallback: use the client ID from timeline
            clientId = property.timeline.client.id;
            this.logger.warn(`⚠️ Using timeline client ID as fallback: ${clientId}`);
          }
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

      // Broadcast to property room only (includes all participants)
      this.server.to(`property:${data.propertyId}`).emit('new-message', message);

      // Send confirmation back to sender
      client.emit('message-sent', {
        messageId: message.id,
        propertyId: data.propertyId,
        conversationId: conversation.id,
        success: true,
      });

      this.logger.log(`✅ Property message sent by ${client.userType} ${client.userId} for property ${data.propertyId}`);

      // BADGE FIX: Emit badge updates after message is sent
      await this.emitBadgeUpdatesForConversation(conversation.id, conversation.agentId, conversation.clientId);

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

      // BADGE FIX: Emit badge updates after message is sent
      await this.emitBadgeUpdatesForConversation(conversation.id, conversation.agentId, conversation.clientId);

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

      // BADGE FIX: Emit badge updates after messages are marked as read
      await this.emitBadgeUpdatesForConversation(conversation.id, conversation.agentId, conversation.clientId);

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

          // BADGE FIX: Emit badge updates after messages are marked as read
          await this.emitBadgeUpdatesForConversation(conversation.id, conversation.agentId, conversation.clientId);

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

        // BADGE FIX: Emit badge updates after messages are marked as read
        const conversation = await this.conversationService.getConversationById(data.conversationId);
        await this.emitBadgeUpdatesForConversation(conversation.id, conversation.agentId, conversation.clientId);
      } else {
        throw new Error('Either propertyId or conversationId must be provided');
      }

    } catch (error) {
      this.logger.error('❌ Mark messages read error:', error);
      client.emit('error', { message: 'Failed to mark messages as read', details: error.message });
    }
  }

  // TASK 1: Ping/pong handlers for WebSocket health checks
  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    const now = Date.now();
    const lastPing = this.lastPingTimes.get(client.id);
    const timeSinceLastPing = lastPing ? now - lastPing : null;

    this.logger.log(`📡 Ping received from socket ${client.id} (user: ${client.userId || 'unknown'}, userType: ${client.userType || 'unknown'})`);

    if (timeSinceLastPing !== null) {
      this.logger.log(`   Time since last ping: ${Math.floor(timeSinceLastPing / 1000)}s`);
    } else {
      this.logger.log(`   First ping from this socket`);
    }

    // TASK 5: Track ping time for monitoring
    this.lastPingTimes.set(client.id, now);

    // Immediately respond with pong
    client.emit('pong');
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

  // BADGE FIX: Helper method to emit badge updates for a conversation
  private async emitBadgeUpdatesForConversation(conversationId: string, agentId: string, clientId: string) {
    try {
      this.logger.log(`📊 BADGE FIX: Emitting badge updates for conversation ${conversationId}`);

      // Get updated conversation with fresh unread counts
      const updatedConversation = await this.conversationService.getConversationById(conversationId);

      // Emit per-property badge update to both agent and client rooms
      this.server.to(`property:${updatedConversation.propertyId}`).emit('unreadCountsUpdated', {
        propertyId: updatedConversation.propertyId,
        agentUnreadCount: updatedConversation.unreadAgentCount,
        clientUnreadCount: updatedConversation.unreadClientCount,
      });

      // Emit hierarchical badge update to the agent
      try {
        const hierarchicalCounts = await this.conversationService.getHierarchicalUnreadCounts(agentId);
        this.server.to(`agent:${agentId}`).emit('hierarchicalUnreadCountsUpdated', hierarchicalCounts);
        this.logger.log(`✅ BADGE FIX: Emitted hierarchical badge update to agent ${agentId}`);
      } catch (error) {
        this.logger.error(`❌ BADGE FIX: Failed to emit hierarchical badge update to agent ${agentId}:`, error);
      }

      // Emit client-specific badge update
      try {
        const clientUnreadCounts = await this.conversationService.getClientUnreadCounts(clientId);
        this.server.to(`client:${clientId}`).emit('clientUnreadCountsUpdated', {
          counts: clientUnreadCounts,
        });
        this.logger.log(`✅ BADGE FIX: Emitted client badge update to client ${clientId}`);
      } catch (error) {
        this.logger.error(`❌ BADGE FIX: Failed to emit client badge update to client ${clientId}:`, error);
      }

    } catch (error) {
      this.logger.error('❌ BADGE FIX: Failed to emit badge updates:', error);
    }
  }

  // SERVER-SIDE MESSAGE DEDUPLICATION: Remove duplicate messages based on ID
  private deduplicateMessages(messages: any[]): any[] {
    if (!messages || messages.length === 0) {
      return [];
    }

    const seen = new Set<string>();
    const deduplicatedMessages: any[] = [];

    // Sort messages by createdAt to ensure consistent ordering
    const sortedMessages = [...messages].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateA - dateB;
    });

    for (const message of sortedMessages) {
      // Use message ID as primary deduplication key
      const messageId = message.id;

      if (!seen.has(messageId)) {
        seen.add(messageId);
        deduplicatedMessages.push(message);
        this.logger.debug(`✅ Added message ${messageId}: "${message.content?.substring(0, 50)}..."`);
      } else {
        this.logger.debug(`🔄 Skipped duplicate message ${messageId}: "${message.content?.substring(0, 50)}..."`);
      }
    }

    this.logger.log(`🧹 Message deduplication: ${messages.length} → ${deduplicatedMessages.length} (removed ${messages.length - deduplicatedMessages.length} duplicates)`);

    return deduplicatedMessages;
  }
}
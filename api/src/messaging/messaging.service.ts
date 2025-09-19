import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateConversationDto {
  agentId: string;
  clientId: string;
  timelineId: string;
  propertyId?: string;
}

export interface CreateMessageDto {
  conversationId: string;
  senderId: string;
  senderType: 'agent' | 'client';
  content: string;
}

export interface MessageResponse {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: 'agent' | 'client';
  content: string;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationResponse {
  id: string;
  agentId: string;
  clientId: string;
  timelineId: string;
  propertyId?: string;
  isActive: boolean;
  lastMessageAt: Date;
  agentUnreadCount: number;
  clientUnreadCount: number;
  createdAt: Date;
  updatedAt: Date;
  messages?: MessageResponse[];
  agent?: {
    id: string;
    name: string;
    email: string;
  };
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  timeline?: {
    id: string;
    title: string;
  };
  property?: {
    id: string;
    address: string;
  };
}

@Injectable()
export class MessagingService {
  constructor(private prisma: PrismaService) {}

  // Create or get existing conversation
  async createOrGetConversation(createConversationDto: CreateConversationDto): Promise<ConversationResponse> {
    const { agentId, clientId, timelineId, propertyId } = createConversationDto;

    // Check if conversation already exists
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        agentId,
        clientId,
        timelineId,
        propertyId: propertyId || null,
      },
      include: {
        agent: {
          include: { profile: true },
        },
        client: true,
        timeline: true,
        property: true,
        messages: {
          take: 20,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Create new conversation if it doesn't exist
    if (!conversation) {
        conversation = await this.prisma.conversation.create({
        data: {
          agentId,
          clientId,
          timelineId,
          propertyId: propertyId || null,
        },
        include: {
          agent: {
            include: { profile: true },
          },
          client: true,
          timeline: true,
          property: true,
          messages: {
            take: 20,
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    }

    return this.formatConversationResponse(conversation);
  }

  // Get conversation by ID with authorization check
  async getConversation(conversationId: string, userId: string, userType: 'agent' | 'client'): Promise<ConversationResponse> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        agent: {
          include: { profile: true },
        },
        client: true,
        timeline: true,
        messages: {
          take: 50,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Check authorization
    if (userType === 'agent' && conversation.agentId !== userId) {
      throw new ForbiddenException('Not authorized to access this conversation');
    }

    if (userType === 'client' && conversation.clientId !== userId) {
      throw new ForbiddenException('Not authorized to access this conversation');
    }

    return this.formatConversationResponse(conversation);
  }

  // Get conversations for a user
  async getConversations(userId: string, userType: 'agent' | 'client'): Promise<ConversationResponse[]> {
    const whereClause = userType === 'agent'
      ? { agentId: userId }
      : { clientId: userId };

    const conversations = await this.prisma.conversation.findMany({
      where: {
        ...whereClause,
        isActive: true,
      },
      include: {
        agent: {
          include: { profile: true },
        },
        client: true,
        timeline: true,
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    return conversations.map(conversation => this.formatConversationResponse(conversation));
  }

  // Send a message (with auto-conversation creation)
  async sendMessage(createMessageDto: CreateMessageDto): Promise<MessageResponse> {
    const { conversationId, senderId, senderType, content } = createMessageDto;

    // Verify conversation exists and user has access
    let conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Check authorization
    if (senderType === 'agent' && conversation.agentId !== senderId) {
      throw new ForbiddenException('Not authorized to send message in this conversation');
    }

    if (senderType === 'client' && conversation.clientId !== senderId) {
      throw new ForbiddenException('Not authorized to send message in this conversation');
    }

    // Create message
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        senderType,
        content,
      },
    });

    // Update conversation with new message timestamp and unread counts
    const updateData = {
      lastMessageAt: new Date(),
      ...(senderType === 'agent'
        ? { clientUnreadCount: { increment: 1 } }
        : { agentUnreadCount: { increment: 1 } }
      ),
    };

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
    });

    return this.formatMessageResponse(message);
  }

  // Send message with auto-conversation creation
  async sendMessageWithAutoCreate(
    agentId: string,
    clientId: string,
    timelineId: string,
    senderId: string,
    senderType: 'agent' | 'client',
    content: string,
    propertyId?: string
  ): Promise<MessageResponse> {
    // First, try to find or create the conversation
    const conversation = await this.createOrGetConversation({
      agentId,
      clientId,
      timelineId,
      propertyId,
    });

    // Now send the message to this conversation
    return this.sendMessage({
      conversationId: conversation.id,
      senderId,
      senderType,
      content,
    });
  }

  // Mark messages as read
  async markMessagesAsRead(conversationId: string, userId: string, userType: 'agent' | 'client'): Promise<void> {
    // Verify conversation exists and user has access
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Check authorization
    if (userType === 'agent' && conversation.agentId !== userId) {
      throw new ForbiddenException('Not authorized to access this conversation');
    }

    if (userType === 'client' && conversation.clientId !== userId) {
      throw new ForbiddenException('Not authorized to access this conversation');
    }

    // Update unread messages to read
    await this.prisma.message.updateMany({
      where: {
        conversationId,
        senderType: userType === 'agent' ? 'client' : 'agent', // Mark messages from the other party as read
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    // Reset unread count for this user
    const updateData = userType === 'agent'
      ? { agentUnreadCount: 0 }
      : { clientUnreadCount: 0 };

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
    });
  }

  // Get messages for a conversation with pagination
  async getMessages(
    conversationId: string,
    userId: string,
    userType: 'agent' | 'client',
    page: number = 1,
    limit: number = 50,
  ): Promise<{ messages: MessageResponse[]; hasMore: boolean; total: number }> {
    // Verify conversation exists and user has access
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Check authorization
    if (userType === 'agent' && conversation.agentId !== userId) {
      throw new ForbiddenException('Not authorized to access this conversation');
    }

    if (userType === 'client' && conversation.clientId !== userId) {
      throw new ForbiddenException('Not authorized to access this conversation');
    }

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.message.count({
        where: { conversationId },
      }),
    ]);

    const hasMore = skip + messages.length < total;

    return {
      messages: messages.map(message => this.formatMessageResponse(message)),
      hasMore,
      total,
    };
  }

  // Helper method to format conversation response
  private formatConversationResponse(conversation: any): ConversationResponse {
    return {
      id: conversation.id,
      agentId: conversation.agentId,
      clientId: conversation.clientId,
      timelineId: conversation.timelineId,
      isActive: conversation.isActive,
      lastMessageAt: conversation.lastMessageAt,
      agentUnreadCount: conversation.agentUnreadCount,
      clientUnreadCount: conversation.clientUnreadCount,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages?.map((message: any) => this.formatMessageResponse(message)),
      agent: conversation.agent ? {
        id: conversation.agent.id,
        name: conversation.agent.profile
          ? `${conversation.agent.profile.firstName} ${conversation.agent.profile.lastName}`
          : conversation.agent.email,
        email: conversation.agent.email,
      } : undefined,
      client: conversation.client ? {
        id: conversation.client.id,
        firstName: conversation.client.firstName,
        lastName: conversation.client.lastName,
        email: conversation.client.email,
      } : undefined,
      timeline: conversation.timeline ? {
        id: conversation.timeline.id,
        title: conversation.timeline.title,
      } : undefined,
    };
  }

  // Helper method to format message response
  private formatMessageResponse(message: any): MessageResponse {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderType: message.senderType,
      content: message.content,
      isRead: message.isRead,
      readAt: message.readAt,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }
}
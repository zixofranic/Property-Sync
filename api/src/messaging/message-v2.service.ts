import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationV2Service } from './conversation-v2.service';

export interface CreateMessageV2Data {
  conversationId: string;
  senderId: string;
  senderType: 'AGENT' | 'CLIENT';
  content: string;
  type?: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';
}

@Injectable()
export class MessageV2Service {
  constructor(
    private prisma: PrismaService,
    private conversationService: ConversationV2Service,
  ) {}

  // Send a message (with strict access control)
  async sendMessage(data: CreateMessageV2Data) {
    // Verify conversation exists and user has access
    const conversation = await this.conversationService.getConversationById(data.conversationId);

    // Check if sender has access to this conversation
    // Allow access if sender matches either agent or client ID (for cases where user type detection fails)
    const senderHasAccess = data.senderId === conversation.agentId ||
                           data.senderId === conversation.clientId ||
                           (data.senderType === 'AGENT' && conversation.agentId === data.senderId) ||
                           (data.senderType === 'CLIENT' && conversation.clientId === data.senderId);

    if (!senderHasAccess) {
      throw new ForbiddenException('User does not have access to this conversation');
    }

    // Create the message
    const message = await this.prisma.messageV2.create({
      data: {
        conversationId: data.conversationId,
        senderId: data.senderId,
        senderType: data.senderType,
        content: data.content,
        type: data.type || 'TEXT',
      },
    });

    // Update conversation metadata
    await Promise.all([
      this.conversationService.updateLastMessageAt(data.conversationId),
      this.conversationService.incrementUnreadCount(data.conversationId, data.senderType),
    ]);

    // Return message with sender info
    return this.getMessageWithSender(message.id);
  }

  // Send a property-based message (relaxed access control for clients via shared timelines)
  async sendPropertyMessage(data: CreateMessageV2Data) {
    // Verify conversation exists (but don't check strict access for property-based messages)
    const conversation = await this.conversationService.getConversationById(data.conversationId);

    // Create the message
    const message = await this.prisma.messageV2.create({
      data: {
        conversationId: data.conversationId,
        senderId: data.senderId,
        senderType: data.senderType,
        content: data.content,
        type: data.type || 'TEXT',
      },
    });

    // Update conversation metadata
    await Promise.all([
      this.conversationService.updateLastMessageAt(data.conversationId),
      this.conversationService.incrementUnreadCount(data.conversationId, data.senderType),
    ]);

    // Return message with sender info
    return this.getMessageWithSender(message.id);
  }

  // Get messages for a conversation with pagination
  async getMessages(conversationId: string, options?: {
    limit?: number;
    before?: string; // cursor-based pagination
  }) {
    const limit = options?.limit || 50;

    const whereClause: any = { conversationId };
    if (options?.before) {
      whereClause.createdAt = { lt: new Date(options.before) };
    }

    const messages = await this.prisma.messageV2.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        conversation: {
          include: {
            agent: {
              include: { profile: true },
            },
            client: true,
          },
        },
      },
    });

    // Transform messages with sender information
    return messages.map(message => ({
      id: message.id,
      conversationId: message.conversationId,
      content: message.content,
      type: message.type,
      isRead: message.isRead,
      readAt: message.readAt,
      createdAt: message.createdAt,
      propertyId: message.conversation.propertyId, // Include propertyId for message routing
      sender: {
        id: message.senderId,
        type: message.senderType,
        name: message.senderType === 'AGENT'
          ? `${message.conversation.agent.profile?.firstName || ''} ${message.conversation.agent.profile?.lastName || ''}`.trim()
          : `${message.conversation.client.firstName} ${message.conversation.client.lastName}`.trim(),
        avatar: message.senderType === 'AGENT' ? message.conversation.agent.profile?.avatar : null,
      },
      conversation: {
        id: message.conversation.id,
        propertyId: message.conversation.propertyId, // Also include in conversation object for compatibility
      },
    }));
  }

  // Mark message as read
  async markAsRead(messageId: string, userId: string) {
    const message = await this.prisma.messageV2.findUnique({
      where: { id: messageId },
      include: { conversation: true },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Check if user has access to this conversation
    const conversation = message.conversation;
    if (conversation.agentId !== userId && conversation.clientId !== userId) {
      throw new ForbiddenException('User does not have access to this conversation');
    }

    // Only mark as read if the user is not the sender
    if (message.senderId !== userId) {
      await this.prisma.messageV2.update({
        where: { id: messageId },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    }

    return { success: true };
  }

  // Mark all messages in conversation as read for a user
  async markAllAsRead(conversationId: string, userId: string, userType: 'AGENT' | 'CLIENT') {
    // Verify user has access to conversation
    const conversation = await this.conversationService.getConversationById(conversationId);

    // Allow access if user matches either agent or client ID (for cases where user type detection fails)
    const userHasAccess = userId === conversation.agentId ||
                         userId === conversation.clientId ||
                         (userType === 'AGENT' && conversation.agentId === userId) ||
                         (userType === 'CLIENT' && conversation.clientId === userId);

    if (!userHasAccess) {
      throw new ForbiddenException('User does not have access to this conversation');
    }

    // Mark all unread messages from the other party as read
    await this.prisma.messageV2.updateMany({
      where: {
        conversationId,
        senderType: userType === 'AGENT' ? 'CLIENT' : 'AGENT', // Messages from the other party
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    // Reset unread count in conversation
    await this.conversationService.markAsRead(conversationId, userType);

    return { success: true };
  }

  // Get message with sender information
  private async getMessageWithSender(messageId: string) {
    const message = await this.prisma.messageV2.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          include: {
            agent: {
              include: { profile: true },
            },
            client: true,
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return {
      id: message.id,
      conversationId: message.conversationId,
      content: message.content,
      type: message.type,
      isRead: message.isRead,
      readAt: message.readAt,
      createdAt: message.createdAt,
      propertyId: message.conversation.propertyId, // Include propertyId for message routing
      sender: {
        id: message.senderId,
        type: message.senderType,
        name: message.senderType === 'AGENT'
          ? `${message.conversation.agent.profile?.firstName || ''} ${message.conversation.agent.profile?.lastName || ''}`.trim()
          : `${message.conversation.client.firstName} ${message.conversation.client.lastName}`.trim(),
        avatar: message.senderType === 'AGENT' ? message.conversation.agent.profile?.avatar : null,
      },
      conversation: {
        id: message.conversation.id,
        propertyId: message.conversation.propertyId, // Also include in conversation object for compatibility
      },
    };
  }

  // Get unread message count for a user
  async getUnreadCount(userId: string, userType: 'AGENT' | 'CLIENT') {
    if (userType === 'AGENT') {
      const result = await this.prisma.propertyConversation.aggregate({
        where: { agentId: userId },
        _sum: { unreadAgentCount: true },
      });
      return result._sum.unreadAgentCount || 0;
    } else {
      const result = await this.prisma.propertyConversation.aggregate({
        where: { clientId: userId },
        _sum: { unreadClientCount: true },
      });
      return result._sum.unreadClientCount || 0;
    }
  }
}
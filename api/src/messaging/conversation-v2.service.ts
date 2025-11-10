import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConversationV2Service {
  constructor(private prisma: PrismaService) {}

  // Get or create property-specific conversation
  async getOrCreatePropertyConversation(data: {
    propertyId: string;
    timelineId: string;
    agentId: string;
    clientId: string;
  }) {
    try {
      console.log(`🔍 Looking for conversation for property: ${data.propertyId}`);

      // Check if conversation already exists for this property
      let conversation = await this.prisma.propertyConversation.findUnique({
        where: { propertyId: data.propertyId },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 50, // Last 50 messages
          },
          property: {
            select: {
              id: true,
              address: true,
              price: true,
              imageUrls: true,
            },
          },
        },
      });

      if (conversation) {
        console.log(`✅ Found existing conversation: ${conversation.id}`);
        return conversation;
      }

      // Verify all required data exists before creating
      console.log(`🔍 Verifying data before creating conversation:`, data);

      // Check if property exists
      const property = await this.prisma.property.findUnique({
        where: { id: data.propertyId },
      });

      if (!property) {
        throw new Error(`Property ${data.propertyId} not found`);
      }

      // Check if timeline exists
      const timeline = await this.prisma.timeline.findUnique({
        where: { id: data.timelineId },
      });

      if (!timeline) {
        throw new Error(`Timeline ${data.timelineId} not found`);
      }

      // Check if client exists
      const client = await this.prisma.client.findUnique({
        where: { id: data.clientId },
      });

      if (!client) {
        throw new Error(`Client ${data.clientId} not found`);
      }

      // Check if agent exists - handle special case for clients
      if (data.agentId !== 'default-agent') {
        const agent = await this.prisma.user.findUnique({
          where: { id: data.agentId },
        });

        if (!agent) {
          // Try to find the first available user as fallback agent
          const fallbackAgent = await this.prisma.user.findFirst({
            where: { isActive: true },
          });

          if (fallbackAgent) {
            console.log(`⚠️ Agent ${data.agentId} not found, using fallback agent: ${fallbackAgent.id}`);
            data.agentId = fallbackAgent.id;
          } else {
            throw new Error(`No agents available to create conversation`);
          }
        }
      }

      console.log(`✅ All entities verified, creating conversation...`);

      // Try to create conversation, but handle the case where it already exists
      try {
        conversation = await this.prisma.propertyConversation.create({
          data: {
            propertyId: data.propertyId,
            timelineId: data.timelineId,
            agentId: data.agentId,
            clientId: data.clientId,
            status: 'ACTIVE',
          },
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 50,
            },
            property: {
              select: {
                id: true,
                address: true,
                price: true,
                imageUrls: true,
              },
            },
          },
        });
      } catch (createError: any) {
        // If unique constraint failed, try to find existing conversation
        if (createError.code === 'P2002') {
          console.log(`🔄 Conversation already exists for property ${data.propertyId}, fetching existing one...`);

          conversation = await this.prisma.propertyConversation.findUnique({
            where: { propertyId: data.propertyId },
            include: {
              messages: {
                orderBy: { createdAt: 'desc' },
                take: 50,
              },
              property: {
                select: {
                  id: true,
                  address: true,
                  price: true,
                  imageUrls: true,
                },
              },
            },
          });

          if (!conversation) {
            throw new Error(`Could not find or create conversation for property ${data.propertyId}`);
          }
        } else {
          throw createError;
        }
      }

      console.log(`✅ Created new PropertyConversation ${conversation.id} for property ${data.propertyId}`);

      return conversation;

    } catch (error) {
      console.error(`❌ Error in getOrCreatePropertyConversation:`, error);
      throw error;
    }
  }

  // Get conversation by ID
  async getConversationById(conversationId: string) {
    const conversation = await this.prisma.propertyConversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        property: {
          select: {
            id: true,
            address: true,
            price: true,
            imageUrls: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  // Get all conversations for an agent
  async getAgentConversations(agentId: string) {
    // BADGE FIX: Filter out conversations for soft-deleted clients
    return this.prisma.propertyConversation.findMany({
      where: {
        agentId,
        status: 'ACTIVE',
        client: {
          isActive: true, // BADGE FIX: Exclude soft-deleted clients
        },
      },
      include: {
        property: {
          select: {
            id: true,
            address: true,
            price: true,
            imageUrls: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1, // Last message only for list view
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  // Get all conversations for a client
  async getClientConversations(clientId: string) {
    return this.prisma.propertyConversation.findMany({
      where: { clientId, status: 'ACTIVE' },
      include: {
        property: {
          select: {
            id: true,
            address: true,
            price: true,
            imageUrls: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    });
  }

  // Mark conversation as read for a user
  async markAsRead(conversationId: string, userType: 'AGENT' | 'CLIENT') {
    const updateData = userType === 'AGENT'
      ? { unreadAgentCount: 0 }
      : { unreadClientCount: 0 };

    await this.prisma.propertyConversation.update({
      where: { id: conversationId },
      data: updateData,
    });

    // Also mark all messages as read for this user
    await this.prisma.messageV2.updateMany({
      where: {
        conversationId,
        senderType: userType === 'AGENT' ? 'CLIENT' : 'AGENT', // Mark messages from the other party as read
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  // Update conversation's last message timestamp
  async updateLastMessageAt(conversationId: string) {
    await this.prisma.propertyConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });
  }

  // Increment unread count for recipient
  async incrementUnreadCount(conversationId: string, senderType: 'AGENT' | 'CLIENT') {
    const updateData = senderType === 'AGENT'
      ? { unreadClientCount: { increment: 1 } } // Agent sent, increment client unread
      : { unreadAgentCount: { increment: 1 } };  // Client sent, increment agent unread

    await this.prisma.propertyConversation.update({
      where: { id: conversationId },
      data: updateData,
    });
  }

  // Get conversation by property and user access
  async getConversationByProperty(propertyId: string, userId: string, userType: 'AGENT' | 'CLIENT') {
    const whereClause: any = { propertyId };

    if (userType === 'AGENT') {
      whereClause.agentId = userId;
    } else {
      whereClause.clientId = userId;
    }

    const conversation = await this.prisma.propertyConversation.findFirst({
      where: whereClause,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        property: {
          select: {
            id: true,
            address: true,
            price: true,
            imageUrls: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  // TASK 2: Get hierarchical unread counts for agent (all clients and properties)
  async getHierarchicalUnreadCounts(agentId: string) {
    try {
      console.log(`📊 ISSUE 8: Fetching hierarchical counts for agent: ${agentId}`);

      // Single optimized query with proper joins
      // BADGE FIX: Filter out conversations for soft-deleted clients
      const conversations = await this.prisma.propertyConversation.findMany({
        where: {
          agentId,
          status: 'ACTIVE',
          client: {
            isActive: true, // BADGE FIX: Exclude soft-deleted clients
          },
        },
        select: {
          id: true,
          clientId: true,
          propertyId: true,
          unreadAgentCount: true,
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          property: {
            select: {
              id: true,
              address: true,
            },
          },
        },
      });

      // Aggregate by client
      const clientMap = new Map<string, {
        clientId: string;
        clientName: string;
        unreadCount: number;
        properties: Array<{
          propertyId: string;
          address: string;
          unreadCount: number;
        }>;
      }>();

      let totalUnread = 0;

      conversations.forEach((conv) => {
        totalUnread += conv.unreadAgentCount;

        const clientKey = conv.clientId;
        if (!clientMap.has(clientKey)) {
          clientMap.set(clientKey, {
            clientId: conv.clientId,
            clientName: `${conv.client.firstName} ${conv.client.lastName}`,
            unreadCount: 0,
            properties: [],
          });
        }

        const clientData = clientMap.get(clientKey)!;
        clientData.unreadCount += conv.unreadAgentCount;
        clientData.properties.push({
          propertyId: conv.propertyId,
          address: conv.property.address,
          unreadCount: conv.unreadAgentCount,
        });
      });

      const result = {
        totalUnread,
        clients: Array.from(clientMap.values()),
      };

      console.log(`✅ ISSUE 8: Hierarchical counts fetched successfully (total: ${totalUnread})`);
      return result;

    } catch (error) {
      console.error(`❌ ISSUE 8: Error in getHierarchicalUnreadCounts for agent ${agentId}:`, error);

      // ISSUE 8 FIX: Return safe defaults on error
      return {
        totalUnread: 0,
        clients: [],
      };
    }
  }

  // TASK 2: Get unread counts by client
  async getUnreadCountsByClient(agentId: string): Promise<Map<string, number>> {
    try {
      console.log(`📊 ISSUE 8: Fetching unread counts by client for agent: ${agentId}`);

      // BADGE FIX: Filter out soft-deleted clients
      const conversations = await this.prisma.propertyConversation.groupBy({
        by: ['clientId'],
        where: {
          agentId,
          status: 'ACTIVE',
          client: {
            isActive: true, // BADGE FIX: Exclude soft-deleted clients
          },
        },
        _sum: {
          unreadAgentCount: true,
        },
      });

      const clientUnreadMap = new Map<string, number>();
      conversations.forEach((conv) => {
        clientUnreadMap.set(conv.clientId, conv._sum.unreadAgentCount || 0);
      });

      console.log(`✅ ISSUE 8: Unread counts by client fetched (${clientUnreadMap.size} clients)`);
      return clientUnreadMap;

    } catch (error) {
      console.error(`❌ ISSUE 8: Error in getUnreadCountsByClient for agent ${agentId}:`, error);

      // ISSUE 8 FIX: Return empty map on error
      return new Map<string, number>();
    }
  }

  // TASK 2: Get total unread for agent
  async getTotalUnreadForAgent(agentId: string): Promise<number> {
    try {
      console.log(`📊 ISSUE 8: Fetching total unread for agent: ${agentId}`);

      const result = await this.prisma.propertyConversation.aggregate({
        where: {
          agentId,
          status: 'ACTIVE',
        },
        _sum: {
          unreadAgentCount: true,
        },
      });

      const totalUnread = result._sum.unreadAgentCount || 0;
      console.log(`✅ ISSUE 8: Total unread for agent: ${totalUnread}`);

      return totalUnread;

    } catch (error) {
      console.error(`❌ ISSUE 8: Error in getTotalUnreadForAgent for agent ${agentId}:`, error);

      // ISSUE 8 FIX: Return 0 on error
      return 0;
    }
  }

  // PHASE 1 - TASK 1: Get client unread counts (flat map per property)
  async getClientUnreadCounts(clientId: string): Promise<{ [propertyId: string]: number }> {
    try {
      console.log(`📊 CLIENT BADGE: Fetching unread counts for client: ${clientId}`);

      // Query all active conversations for this client
      const conversations = await this.prisma.propertyConversation.findMany({
        where: {
          clientId,
          status: 'ACTIVE',
        },
        select: {
          propertyId: true,
          unreadClientCount: true,
        },
      });

      // Build flat map: { propertyId: unreadCount }
      const unreadMap: { [propertyId: string]: number } = {};

      conversations.forEach((conv) => {
        // Handle null/undefined unreadClientCount safely
        unreadMap[conv.propertyId] = conv.unreadClientCount || 0;
      });

      console.log(`✅ CLIENT BADGE: Found ${conversations.length} conversations for client ${clientId}`);
      console.log(`   Total properties with unreads: ${Object.keys(unreadMap).length}`);

      return unreadMap;

    } catch (error) {
      console.error(`❌ CLIENT BADGE: Error in getClientUnreadCounts for client ${clientId}:`, error);

      // Return empty map on error - fail gracefully
      return {};
    }
  }
}
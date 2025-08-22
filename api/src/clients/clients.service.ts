import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AppConfigService } from '../config/app.config';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientResponseDto } from './dto/client-response.dto';

@Injectable()
export class ClientsService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private appConfig: AppConfigService,
  ) {}

  // 🆕 UPDATED CREATE METHOD - FRONTEND COMPATIBLE
  async create(
    agentId: string,
    createClientDto: CreateClientDto,
  ): Promise<ClientResponseDto> {
    // Check plan limits before creating client
    const canAdd = await this.usersService.checkCanAddClients(agentId, 1);
    if (!canAdd.canAdd) {
      throw new BadRequestException(canAdd.reason);
    }

    const agent = await this.prisma.user.findUnique({
      where: { id: agentId },
      include: { profile: true },
    });

    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    // 🆕 PARSE NAME FROM FRONTEND
    const { firstName, lastName } = this.parseClientName(createClientDto);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create the client
      const client = await tx.client.create({
        data: {
          firstName,
          lastName,
          email: createClientDto.email,
          spouseEmail: createClientDto.spouseEmail, // 🆕 SPOUSE EMAIL
          phone: createClientDto.phone,
          notes: createClientDto.notes,
          agentId,
        },
      });

      // 2. Auto-create timeline for this client
      const timeline = await tx.timeline.create({
        data: {
          title: `${client.firstName} ${client.lastName}'s Properties`,
          description: `Property timeline for ${client.firstName} ${client.lastName}`,
          agentId,
          clientId: client.id,
        },
      });

      return { client, timeline };
    });

    return this.formatClientResponse(result.client, result.timeline);
  }

  // 🆕 UPDATED FINDALL METHOD
  async findAll(agentId: string): Promise<ClientResponseDto[]> {
    const clients = await this.prisma.client.findMany({
      where: {
        agentId,
        isActive: true,
      },
      include: {
        timelines: {
          include: {
            _count: {
              select: { properties: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return clients.map((client) => {
      const timeline = client.timelines[0]; // Each client has one timeline
      return this.formatClientResponse(client, timeline);
    });
  }

  async findOne(agentId: string, clientId: string): Promise<ClientResponseDto> {
    const client = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        agentId, // Ensure agent owns this client
      },
      include: {
        timelines: {
          include: {
            _count: {
              select: { properties: true },
            },
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const timeline = client.timelines[0];
    return this.formatClientResponse(client, timeline);
  }

  async update(
    agentId: string,
    clientId: string,
    updateClientDto: UpdateClientDto,
  ): Promise<ClientResponseDto> {
    // Verify ownership
    const existingClient = await this.prisma.client.findFirst({
      where: { id: clientId, agentId },
    });

    if (!existingClient) {
      throw new NotFoundException('Client not found');
    }

    const updatedClient = await this.prisma.client.update({
      where: { id: clientId },
      data: updateClientDto,
      include: {
        timelines: {
          include: {
            _count: {
              select: { properties: true },
            },
          },
        },
      },
    });

    const timeline = updatedClient.timelines[0];
    return this.formatClientResponse(updatedClient, timeline);
  }

  async remove(
    agentId: string,
    clientId: string,
  ): Promise<{ message: string }> {
    // Verify ownership
    const existingClient = await this.prisma.client.findFirst({
      where: { id: clientId, agentId },
    });

    if (!existingClient) {
      throw new NotFoundException('Client not found');
    }

    // Soft delete (set isActive to false)
    await this.prisma.client.update({
      where: { id: clientId },
      data: { isActive: false },
    });

    return { message: 'Client deleted successfully' };
  }

  // 🔧 PRIVATE HELPER METHODS

  // Helper method to parse name from frontend
  private parseClientName(createClientDto: CreateClientDto) {
    // If frontend sends combined name, split it
    if (
      createClientDto.name &&
      !createClientDto.firstName &&
      !createClientDto.lastName
    ) {
      const nameParts = createClientDto.name.trim().split(' ');
      return {
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
      };
    }

    // Otherwise use provided firstName/lastName
    return {
      firstName: createClientDto.firstName,
      lastName: createClientDto.lastName,
    };
  }

  // 🆕 UPDATED FORMAT METHOD - FRONTEND COMPATIBLE
  private formatClientResponse(client: any, timeline?: any): ClientResponseDto {
    // Calculate engagement score (0-100)
    const engagementScore = Math.min(
      100,
      Math.round(
        client.feedbackRate * 0.4 +
          Math.min(client.totalViews, 10) * 6 +
          (client.avgResponseTime > 0
            ? Math.max(0, 20 - client.avgResponseTime)
            : 0),
      ),
    );

    // Determine status based on activity and engagement
    const daysSinceLastActivity = client.lastActivity
      ? Math.floor(
          (Date.now() - new Date(client.lastActivity).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 999;

    let status: 'active' | 'warm' | 'cold';
    if (daysSinceLastActivity <= 7 && engagementScore >= 60) {
      status = 'active';
    } else if (daysSinceLastActivity <= 30 && engagementScore >= 30) {
      status = 'warm';
    } else {
      status = 'cold';
    }

    // Generate client login code and share URL
    const clientLoginCode = this.generateClientLoginCode(
      client.firstName,
      client.phone,
    );
    const shareUrl = timeline
      ? this.appConfig.getTimelineShareUrl(timeline.shareToken, clientLoginCode)
      : '';

    return {
      id: client.id,

      // 🆕 FRONTEND-COMPATIBLE FIELDS
      name: `${client.firstName} ${client.lastName}`.trim(),
      email: client.email,
      phone: client.phone || undefined,
      avatar: client.avatar || undefined,
      propertiesViewed: timeline?._count?.properties || 0,
      lastActive: (client.lastActivity || client.createdAt).toISOString(),
      engagementScore,
      status,
      createdAt: client.createdAt.toISOString(),

      // 🆕 ENHANCED FIELDS
      spouseEmail: client.spouseEmail || undefined,
      totalViews: client.totalViews,
      avgResponseTime: client.avgResponseTime,
      feedbackRate: client.feedbackRate,
      lastActivity: client.lastActivity?.toISOString(),

      // 🆕 BACKEND FIELDS
      firstName: client.firstName,
      lastName: client.lastName,
      notes: client.notes || undefined,
      isActive: client.isActive,
      updatedAt: client.updatedAt.toISOString(),

      // 🆕 TIMELINE DATA
      timeline: timeline
        ? {
            id: timeline.id,
            shareToken: timeline.shareToken,
            isPublic: timeline.isActive,
            shareUrl,
            clientLoginCode,
            totalViews: timeline.totalViews,
            lastViewed: timeline.lastViewed?.toISOString(),
            propertyCount: timeline._count?.properties || 0,
          }
        : undefined,
    };
  }

  // Helper method to generate simple client login code
  private generateClientLoginCode(firstName: string, phone?: string): string {
    const cleanFirstName = firstName.replace(/[^a-zA-Z]/g, '').toLowerCase();

    if (!phone) {
      // If no phone, use first name + random 4 digits
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      return `${cleanFirstName}${randomDigits}`;
    }

    // Extract last 4 digits from phone
    const digits = phone.replace(/[^\d]/g, '');
    const lastFourDigits = digits.slice(-4) || '0000';

    return `${cleanFirstName}${lastFourDigits}`;
  }
}

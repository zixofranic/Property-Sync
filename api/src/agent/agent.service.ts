import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AgentService {
  constructor(private prisma: PrismaService) {}

  async getAgentByShareToken(shareToken: string) {
    console.log('🔍 Agent Service: Looking for shareToken:', shareToken);
    
    // Find a timeline with this shareToken to get the agent
    const timeline = await this.prisma.timeline.findFirst({
      where: { 
        shareToken,
        isActive: true 
      },
      include: {
        agent: {
          include: {
            profile: true,
          },
        },
      },
    });

    console.log('📦 Agent Service: Timeline found:', !!timeline);
    console.log('👤 Agent Service: Agent found:', !!timeline?.agent);
    console.log('📋 Agent Service: Profile found:', !!timeline?.agent?.profile);

    if (!timeline || !timeline.agent) {
      console.log('❌ Agent Service: No timeline or agent found');
      return null;
    }

    const agent = timeline.agent;
    const profile = agent.profile;
    
    console.log('🔧 Agent Service: Profile data:', {
      firstName: profile?.firstName,
      lastName: profile?.lastName,
      company: profile?.company,
      avatar: profile?.avatar,
      logo: profile?.logo,
    });

    // Return agent data in the format expected by the frontend
    return {
      id: agent.id,
      email: agent.email,
      firstName: profile?.firstName || '',
      lastName: profile?.lastName || '',
      company: profile?.company || '',
      phone: profile?.phone || '',
      website: profile?.website || '',
      licenseNumber: profile?.licenseNumber || '',
      avatar: profile?.avatar || '', // This is the real photo URL from database!
      logo: profile?.logo || '',
      bio: profile?.bio || '',
      timezone: profile?.timezone || '',
      specialties: profile?.specialties
        ? (typeof profile.specialties === 'string'
           ? JSON.parse(profile.specialties)
           : profile.specialties)
        : [],
      yearsExperience: profile?.yearsExperience || 0,
      brandColor: profile?.brandColor || '#1e90ff',
      plan: profile?.plan || 'FREE',
      emailVerified: agent.emailVerified || false,
      onboardingComplete: profile?.onboardingComplete || false,
    };
  }
}
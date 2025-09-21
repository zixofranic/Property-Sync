import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanLimitsService } from './plan-limits.service';
import { RegisterDto } from '../auth/dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private planLimitsService: PlanLimitsService,
  ) {}

  // FIXED: Email Preferences Method
  async updateEmailPreferences(
    userId: string,
    preferences: {
      preferredTemplate?: 'modern' | 'classical';
      brandColor?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: any = {};

    if (preferences.brandColor) {
      updateData.brandColor = preferences.brandColor;
    }

    if (preferences.preferredTemplate) {
      updateData.preferredEmailTemplate = preferences.preferredTemplate;
    }

    // Use upsert to handle cases where profile might not exist
    const updatedProfile = await this.prisma.profile.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        firstName: '',
        lastName: '',
        preferredEmailTemplate: preferences.preferredTemplate || 'modern',
        brandColor: preferences.brandColor || '#3b82f6',
      },
    });

    return {
      message: 'Email preferences updated successfully',
      preferences: {
        preferredTemplate: updatedProfile.preferredEmailTemplate || 'modern',
        brandColor: updatedProfile.brandColor || '#3b82f6',
        companyName: updatedProfile.company || '',
        agentName:
          `${updatedProfile.firstName || ''} ${updatedProfile.lastName || ''}`.trim(),
      },
    };
  }

  // FIXED: Single updateProfile method
  async updateProfile(userId: string, updateData: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Handle field updates - undefined means clear the field (set to null)
    const profileUpdateData: any = {};
    
    // Always update fields that are present in updateData, including undefined (to clear them)
    Object.keys(updateData).forEach(key => {
      if (updateData.hasOwnProperty(key)) {
        // Convert undefined to null for optional fields that can be cleared
        if (key === 'company' || key === 'phone' || key === 'website' || key === 'licenseNumber' || 
            key === 'bio' || key === 'avatar' || key === 'timezone' || key === 'logo') {
          profileUpdateData[key] = updateData[key] || null;
        } else {
          // For required fields and special cases, keep the value as-is
          profileUpdateData[key] = updateData[key];
        }
      }
    });

    try {
      const updatedProfile = await this.prisma.profile.upsert({
        where: { userId },
        update: profileUpdateData,
        create: {
          userId,
          firstName: profileUpdateData.firstName || '',
          lastName: profileUpdateData.lastName || '',
          company: profileUpdateData.company || null,
          phone: profileUpdateData.phone || null,
          website: profileUpdateData.website || null,
          licenseNumber: profileUpdateData.licenseNumber || null,
          bio: profileUpdateData.bio || null,
          yearsExperience: profileUpdateData.yearsExperience || null,
          specialties: profileUpdateData.specialties || null,
          brandColor: profileUpdateData.brandColor || '#3b82f6',
          logo: profileUpdateData.logo || null,
          avatar: profileUpdateData.avatar || null,
          plan: 'FREE',
        },
      });

      return {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        firstName: updatedProfile.firstName,
        lastName: updatedProfile.lastName,
        company: updatedProfile.company || '',
        phone: updatedProfile.phone || '',
        website: updatedProfile.website || '',
        licenseNumber: updatedProfile.licenseNumber || '',
        plan: updatedProfile.plan,
        brandColor: updatedProfile.brandColor || '#3b82f6',
        logo: updatedProfile.logo || '',
        bio: updatedProfile.bio || '',
        yearsExperience: updatedProfile.yearsExperience || 0,
        specialties: updatedProfile.specialties
          ? (typeof updatedProfile.specialties === 'string'
             ? JSON.parse(updatedProfile.specialties)
             : updatedProfile.specialties)
          : [],
        avatar: updatedProfile.avatar || '',
        timezone: updatedProfile.timezone || 'America/New_York',
        createdAt: user.createdAt,
        updatedAt: updatedProfile.updatedAt,
      };
    } catch (error) {
      console.error('Profile update failed:', error.message);
      throw error;
    }
  }

  // Keep all your existing methods below (no changes needed)
  async create(registerDto: RegisterDto) {
    const existingUser = await this.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        password: hashedPassword,
        emailVerified: false,
        profile: {
          create: {
            firstName: registerDto.firstName,
            lastName: registerDto.lastName,
            company: registerDto.company,
            phone: registerDto.phone,
            licenseNumber: registerDto.licenseNumber,
            plan: 'FREE',
          },
        },
      },
      include: {
        profile: true,
      },
    });

    const { password, ...result } = user;
    return result;
  }

  async createWithVerification(
    registerDto: RegisterDto,
    verificationData: { verificationToken: string; verificationExpiry: Date },
  ) {
    const existingUser = await this.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        password: hashedPassword,
        emailVerified: false,
        verificationToken: verificationData.verificationToken,
        verificationExpiry: verificationData.verificationExpiry,
        profile: {
          create: {
            firstName: registerDto.firstName,
            lastName: registerDto.lastName,
            company: registerDto.company,
            phone: registerDto.phone,
            licenseNumber: registerDto.licenseNumber,
            plan: 'FREE',
          },
        },
      },
      include: {
        profile: true,
      },
    });

    const { password, ...result } = user;
    return result;
  }

  async findByVerificationToken(token: string) {
    return this.prisma.user.findUnique({
      where: { verificationToken: token },
      include: { profile: true },
    });
  }

  async markEmailAsVerified(userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationExpiry: null,
      },
      include: { profile: true },
    });

    const { password, ...result } = user;
    return result;
  }

  async updateVerificationToken(
    userId: string,
    verificationData: { verificationToken: string; verificationExpiry: Date },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        verificationToken: verificationData.verificationToken,
        verificationExpiry: verificationData.verificationExpiry,
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
      },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { password, ...result } = user;
    return result;
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      firstName: user.profile?.firstName || '',
      lastName: user.profile?.lastName || '',
      company: user.profile?.company || '',
      phone: user.profile?.phone || '',
      website: user.profile?.website || '',
      licenseNumber: user.profile?.licenseNumber || '',
      plan: user.profile?.plan || 'FREE',
      brandColor: user.profile?.brandColor || '#3b82f6',
      logo: user.profile?.logo || '',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      bio: user.profile?.bio || '',
      yearsExperience: user.profile?.yearsExperience || 0,
      specialties: user.profile?.specialties
        ? (typeof user.profile.specialties === 'string'
           ? JSON.parse(user.profile.specialties)
           : user.profile.specialties)
        : [],
      avatar: user.profile?.avatar || '',
      timezone: user.profile?.timezone || '',
    };
  }

  async getDetailedProfile(userId: string) {
    return this.getProfile(userId);
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedNewPassword = await bcrypt.hash(
      changePasswordDto.newPassword,
      12,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedNewPassword,
      },
    });

    return { message: 'Password updated successfully' };
  }

  async getUserPreferences(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      emailTemplateStyle: user.profile?.emailTemplateStyle || user.profile?.preferredEmailTemplate || 'modern',
      notifications: {
        email: user.profile?.notificationEmail ?? true,
        desktop: user.profile?.notificationDesktop ?? true,
        feedback: user.profile?.notificationFeedback ?? true,
        newProperties: user.profile?.notificationNewProperties ?? true,
        // Activity notifications
        clientViews: user.profile?.notificationClientViews ?? true,
        clientLogin: user.profile?.notificationClientLogin ?? false,
        emailOpens: user.profile?.notificationEmailOpens ?? true,
        inactiveClients: user.profile?.notificationInactiveClients ?? false,
      },
      theme: 'dark' as const,
      soundEnabled: true,
      timezone: user.profile?.timezone || 'America/New_York',
      brandColor: user.profile?.brandColor || '#3b82f6',
      logo: user.profile?.logo || '',
    };
  }

  async updateUserPreferences(
    userId: string,
    preferences: UpdatePreferencesDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: any = {};

    if (preferences.brandColor !== undefined) {
      updateData.brandColor = preferences.brandColor;
    }

    if (preferences.logo !== undefined) {
      updateData.logo = preferences.logo;
    }

    if (preferences.emailTemplateStyle !== undefined) {
      updateData.preferredEmailTemplate = preferences.emailTemplateStyle;
      updateData.emailTemplateStyle = preferences.emailTemplateStyle;
    }

    if (preferences.notifications !== undefined) {
      if (preferences.notifications.email !== undefined) {
        updateData.notificationEmail = preferences.notifications.email;
      }
      if (preferences.notifications.desktop !== undefined) {
        updateData.notificationDesktop = preferences.notifications.desktop;
      }
      if (preferences.notifications.feedback !== undefined) {
        updateData.notificationFeedback = preferences.notifications.feedback;
      }
      if (preferences.notifications.newProperties !== undefined) {
        updateData.notificationNewProperties = preferences.notifications.newProperties;
      }
      // Activity notifications
      if (preferences.notifications.clientViews !== undefined) {
        updateData.notificationClientViews = preferences.notifications.clientViews;
      }
      if (preferences.notifications.clientLogin !== undefined) {
        updateData.notificationClientLogin = preferences.notifications.clientLogin;
      }
      if (preferences.notifications.emailOpens !== undefined) {
        updateData.notificationEmailOpens = preferences.notifications.emailOpens;
      }
      if (preferences.notifications.inactiveClients !== undefined) {
        updateData.notificationInactiveClients = preferences.notifications.inactiveClients;
      }
    }

    let updatedProfile = user.profile;
    if (Object.keys(updateData).length > 0) {
      updatedProfile = await this.prisma.profile.upsert({
        where: { userId },
        update: updateData,
        create: {
          userId,
          firstName: '',
          lastName: '',
          ...updateData,
        },
      });
    }

    return {
      emailTemplateStyle: updatedProfile?.emailTemplateStyle || updatedProfile?.preferredEmailTemplate || 'modern',
      notifications: {
        email: updatedProfile?.notificationEmail ?? true,
        desktop: updatedProfile?.notificationDesktop ?? true,
        feedback: updatedProfile?.notificationFeedback ?? true,
        newProperties: updatedProfile?.notificationNewProperties ?? true,
        // Activity notifications
        clientViews: updatedProfile?.notificationClientViews ?? true,
        clientLogin: updatedProfile?.notificationClientLogin ?? false,
        emailOpens: updatedProfile?.notificationEmailOpens ?? true,
        inactiveClients: updatedProfile?.notificationInactiveClients ?? false,
      },
      theme: preferences.theme || 'dark',
      soundEnabled:
        preferences.soundEnabled !== undefined
          ? preferences.soundEnabled
          : true,
      timezone: preferences.timezone || 'America/New_York',
      brandColor: updatedProfile?.brandColor || '#3b82f6',
      logo: updatedProfile?.logo || '',
    };
  }

  async resetUserPreferences(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedProfile = await this.prisma.profile.upsert({
      where: { userId },
      update: {
        brandColor: '#3b82f6',
        logo: '',
        preferredEmailTemplate: 'modern',
      },
      create: {
        userId,
        firstName: '',
        lastName: '',
        brandColor: '#3b82f6',
        logo: '',
        preferredEmailTemplate: 'modern',
      },
    });

    return {
      emailTemplateStyle: 'modern',
      notifications: {
        email: true,
        desktop: true,
        feedback: true,
        newProperties: true,
      },
      theme: 'dark',
      soundEnabled: true,
      timezone: 'America/New_York',
      brandColor: updatedProfile.brandColor,
      logo: updatedProfile.logo,
    };
  }

  async validatePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  // PLAN AND LIMITS METHODS
  async getCurrentPlanInfo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user || !user.profile) {
      throw new NotFoundException('User profile not found');
    }

    const planLimits = this.planLimitsService.getLimitsForPlan(user.profile.plan);
    
    return {
      currentPlan: user.profile.plan,
      limits: planLimits,
      subscriptionStatus: user.profile.subscriptionStatus,
    };
  }

  async getCurrentUsage(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { 
        clients: true,
        timelines: {
          include: {
            properties: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const totalProperties = user.timelines.reduce(
      (sum, timeline) => sum + timeline.properties.length,
      0
    );

    return {
      clients: user.clients.length,
      properties: totalProperties,
    };
  }

  async validateCurrentUsage(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { 
        profile: true,
        clients: true,
        timelines: {
          include: {
            properties: true,
          },
        },
      },
    });

    if (!user || !user.profile) {
      throw new NotFoundException('User profile not found');
    }

    const totalProperties = user.timelines.reduce(
      (sum, timeline) => sum + timeline.properties.length,
      0
    );

    // Use database limits instead of hardcoded plan limits
    const clientExceeded = user.clients.length > user.profile.clientLimit;
    const propertyExceeded = totalProperties > user.profile.propertyLimit;
    
    const validation = {
      isValid: !clientExceeded && !propertyExceeded,
      clientExceeded,
      propertyExceeded,
      limits: {
        clientLimit: user.profile.clientLimit,
        propertyLimit: user.profile.propertyLimit,
        name: this.planLimitsService.getLimitsForPlan(user.profile.plan).name,
        price: this.planLimitsService.getLimitsForPlan(user.profile.plan).price,
        description: this.planLimitsService.getLimitsForPlan(user.profile.plan).description
      },
      usage: {
        clients: user.clients.length,
        properties: totalProperties
      }
    };

    return {
      ...validation,
      upgradeMessage: !validation.isValid 
        ? `You've reached your limits. Current: ${user.clients.length}/${user.profile.clientLimit} clients, ${totalProperties}/${user.profile.propertyLimit} properties.`
        : null,
    };
  }

  async checkCanAddClients(userId: string, clientCount = 1): Promise<{ canAdd: boolean; reason?: string }> {
    const validation = await this.validateCurrentUsage(userId);

    // Check against database limits directly
    const newClientTotal = validation.usage.clients + clientCount;
    const canAdd = newClientTotal <= validation.limits.clientLimit;

    return {
      canAdd,
      reason: !canAdd
        ? `Adding ${clientCount} client(s) would exceed your limit of ${validation.limits.clientLimit} clients. Current: ${validation.usage.clients}/${validation.limits.clientLimit}`
        : undefined,
    };
  }

  async checkCanAddProperties(userId: string, propertyCount = 1): Promise<{ canAdd: boolean; reason?: string }> {
    const validation = await this.validateCurrentUsage(userId);
    
    // Check against database limits directly
    const newPropertyTotal = validation.usage.properties + propertyCount;
    const canAdd = newPropertyTotal <= validation.limits.propertyLimit;

    return {
      canAdd,
      reason: !canAdd 
        ? `Adding ${propertyCount} property(ies) would exceed your limit of ${validation.limits.propertyLimit} properties. Current: ${validation.usage.properties}/${validation.limits.propertyLimit}`
        : undefined,
    };
  }
}

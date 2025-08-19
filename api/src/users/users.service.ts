import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from '../auth/dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // FIXED: Email Preferences Method
  async updateEmailPreferences(
    userId: string, 
    preferences: { 
      preferredTemplate?: 'modern' | 'classical';
      brandColor?: string;
    }
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
        agentName: `${updatedProfile.firstName || ''} ${updatedProfile.lastName || ''}`.trim(),
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

    // Filter out undefined values
    const profileUpdateData: any = {};
    if (updateData.firstName !== undefined) profileUpdateData.firstName = updateData.firstName;
    if (updateData.lastName !== undefined) profileUpdateData.lastName = updateData.lastName;
    if (updateData.company !== undefined) profileUpdateData.company = updateData.company;
    if (updateData.phone !== undefined) profileUpdateData.phone = updateData.phone;
    if (updateData.website !== undefined) profileUpdateData.website = updateData.website;
    if (updateData.licenseNumber !== undefined) profileUpdateData.licenseNumber = updateData.licenseNumber;
    if (updateData.bio !== undefined) profileUpdateData.bio = updateData.bio;
    if (updateData.yearsExperience !== undefined) profileUpdateData.yearsExperience = updateData.yearsExperience;
    if (updateData.specialties !== undefined) profileUpdateData.specialties = updateData.specialties;
    if (updateData.brandColor !== undefined) profileUpdateData.brandColor = updateData.brandColor;
    if (updateData.logo !== undefined) profileUpdateData.logo = updateData.logo;
    if (updateData.avatar !== undefined) profileUpdateData.avatar = updateData.avatar;

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
          specialties: profileUpdateData.specialties || [],
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
        specialties: updatedProfile.specialties || [],
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

  async createWithVerification(registerDto: RegisterDto, verificationData: { verificationToken: string; verificationExpiry: Date }) {
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

  async updateVerificationToken(userId: string, verificationData: { verificationToken: string; verificationExpiry: Date }) {
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
      specialties: user.profile?.specialties || [],
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

    const isCurrentPasswordValid = await bcrypt.compare(changePasswordDto.currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedNewPassword = await bcrypt.hash(changePasswordDto.newPassword, 12);

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
      emailTemplateStyle: user.profile?.preferredEmailTemplate || 'modern',
      notifications: {
        email: true,
        desktop: true,
        feedback: true,
        newProperties: true,
      },
      theme: 'dark' as const,
      soundEnabled: true,
      timezone: 'America/New_York',
      brandColor: user.profile?.brandColor || '#3b82f6',
      logo: user.profile?.logo || '',
    };
  }

  async updateUserPreferences(userId: string, preferences: UpdatePreferencesDto) {
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
      emailTemplateStyle: updatedProfile?.preferredEmailTemplate || 'modern',
      notifications: preferences.notifications || {
        email: true,
        desktop: true,
        feedback: true,
        newProperties: true,
      },
      theme: preferences.theme || 'dark',
      soundEnabled: preferences.soundEnabled !== undefined ? preferences.soundEnabled : true,
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

  async validatePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }
}
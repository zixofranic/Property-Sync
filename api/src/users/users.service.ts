import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from '../auth/dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

// Default preferences
const defaultPreferences = {
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
  brandColor: '#3b82f6',
  logo: '',
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // Original create method (keep for backward compatibility)
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

  // Create user with email verification data
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

  // Find user by verification token
  async findByVerificationToken(token: string) {
    return this.prisma.user.findUnique({
      where: { verificationToken: token },
      include: { profile: true },
    });
  }

  // Mark email as verified
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

  // Update verification token (for resend functionality)
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

  // Get user profile (for controller endpoint)
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

  // Get detailed profile (alternative method name for compatibility)
  async getDetailedProfile(userId: string) {
    return this.getProfile(userId);
  }

  // Update user profile
 async updateProfile(userId: string, updateData: UpdateProfileDto) {
  console.log('🔍 UpdateProfile called for userId:', userId);
  
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });

  if (!user) {
    throw new NotFoundException('User not found');
  }

  console.log('🔍 User found, has profile:', !!user.profile);
  
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


  try {
    console.log('🔍 Attempting profile update with data:', profileUpdateData);
    const updatedProfile = await this.prisma.profile.update({
      where: { userId },
      data: profileUpdateData,
    });
    console.log('🔍 Profile updated successfully');
    
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      firstName: updatedProfile.firstName,
      lastName: updatedProfile.lastName,
      company: updatedProfile.company,
      phone: updatedProfile.phone,
      website: updatedProfile.website,
      licenseNumber: updatedProfile.licenseNumber,
      plan: updatedProfile.plan,
      brandColor: updatedProfile.brandColor,
      logo: updatedProfile.logo,
      createdAt: user.createdAt,
      updatedAt: updatedProfile.updatedAt,
    };
  } catch (error) {
    console.error('🔍 Profile update failed:', error.message);
    throw error;
  }
}

  // Change password
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(changePasswordDto.currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(changePasswordDto.newPassword, 12);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedNewPassword,
      },
    });

    return { message: 'Password updated successfully' };
  }

  // Get user preferences
  async getUserPreferences(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // For now, return defaults since we haven't added preference fields to DB yet
    // In a full implementation, you'd store these in the profile table or a separate preferences table
    return {
      emailTemplateStyle: 'modern' as const,
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

  // Update user preferences
  async updateUserPreferences(userId: string, preferences: UpdatePreferencesDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // For now, we'll just update the profile fields that exist
    // In a full implementation, you'd need to add preference fields to your schema
    const updateData: any = {};
    
    if (preferences.brandColor !== undefined) {
      updateData.brandColor = preferences.brandColor;
    }
    
    if (preferences.logo !== undefined) {
      updateData.logo = preferences.logo;
    }

    let updatedProfile = user.profile;
    if (Object.keys(updateData).length > 0) {
      updatedProfile = await this.prisma.profile.update({
        where: { userId },
        data: updateData,
      });
    }

    // Return the updated preferences (in a real implementation, these would be stored)
    return {
      emailTemplateStyle: preferences.emailTemplateStyle || 'modern',
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

  // Reset user preferences to defaults
  async resetUserPreferences(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Reset profile fields to defaults
    const updatedProfile = await this.prisma.profile.update({
      where: { userId },
      data: {
        brandColor: defaultPreferences.brandColor,
        logo: defaultPreferences.logo,
      },
    });

    return {
      ...defaultPreferences,
      brandColor: updatedProfile.brandColor,
      logo: updatedProfile.logo,
    };
  }

  async validatePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }
}
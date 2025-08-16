import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from '../auth/dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

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

    // Remove password from response
    const { password, ...result } = user;
    return result;
  }

  // NEW: Create user with email verification data
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
      company: user.profile?.company,
      phone: user.profile?.phone,
      website: user.profile?.website,
      licenseNumber: user.profile?.licenseNumber,
      avatar: user.profile?.avatar,
      bio: user.profile?.bio,
      timezone: user.profile?.timezone,
      specialties: user.profile?.specialties || [],
      yearsExperience: user.profile?.yearsExperience,
      notifications: user.profile?.notifications,
      onboardingComplete: user.profile?.onboardingComplete || false,
      logo: user.profile?.logo,
      brandColor: user.profile?.brandColor || '#3b82f6',
      plan: user.profile?.plan || 'FREE',
    };
  }

  // 🔧 ENHANCED: Advanced updateProfile method with dynamic update capability
  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto | any) {
    // Validate brand color if provided
    if (updateProfileDto.brandColor && !this.isValidHexColor(updateProfileDto.brandColor)) {
      throw new BadRequestException('Invalid brand color format. Use hex format like #3b82f6');
    }
    
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 🆕 ENHANCED: Support both DTO and dynamic object updates
    // If it's a simple object (like from the simple method), use direct update
    if (!updateProfileDto.firstName && !updateProfileDto.lastName && Object.keys(updateProfileDto).length < 5) {
      // This handles the simple dynamic update case
      return this.prisma.user.update({
        where: { id: userId },
        data: {
          profile: {
            update: updateProfileDto
          }
        },
        include: { profile: true }
      });
    }
    
    // Otherwise, use the full DTO validation and upsert logic
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        profile: {
          upsert: {
            create: {
              firstName: updateProfileDto.firstName || '',
              lastName: updateProfileDto.lastName || '',
              company: updateProfileDto.company,
              phone: updateProfileDto.phone,
              website: updateProfileDto.website,
              licenseNumber: updateProfileDto.licenseNumber,
              avatar: updateProfileDto.avatar,
              bio: updateProfileDto.bio,
              timezone: updateProfileDto.timezone,
              specialties: updateProfileDto.specialties || [],
              yearsExperience: updateProfileDto.yearsExperience,
              notifications: updateProfileDto.notifications,
              logo: updateProfileDto.logo,
              brandColor: updateProfileDto.brandColor || '#3b82f6',
              emailTemplateStyle: updateProfileDto.emailTemplateStyle || 'modern',
              plan: 'FREE',
            },
            update: {
              firstName: updateProfileDto.firstName,
              lastName: updateProfileDto.lastName,
              company: updateProfileDto.company,
              phone: updateProfileDto.phone,
              website: updateProfileDto.website,
              licenseNumber: updateProfileDto.licenseNumber,
              avatar: updateProfileDto.avatar,
              bio: updateProfileDto.bio,
              timezone: updateProfileDto.timezone,
              specialties: updateProfileDto.specialties,
              yearsExperience: updateProfileDto.yearsExperience,
              notifications: updateProfileDto.notifications,
              logo: updateProfileDto.logo,
              brandColor: updateProfileDto.brandColor,
              emailTemplateStyle: updateProfileDto.emailTemplateStyle,
            },
          },
        },
      },
      include: {
        profile: true,
      },
    });
    
    return this.getProfile(userId);
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isCurrentPasswordValid = await this.validatePassword(
      changePasswordDto.currentPassword,
      user.password
    );

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

  // NEW: Find user by verification token
  async findByVerificationToken(token: string) {
    return this.prisma.user.findUnique({
      where: { verificationToken: token },
      include: { profile: true },
    });
  }

  // NEW: Mark email as verified
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

  // NEW: Update verification token (for resend functionality)
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

  async validatePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  private isValidHexColor(color: string): boolean {
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexColorRegex.test(color);
  }
}
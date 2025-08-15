import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from '../auth/dto/register.dto';
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
        emailVerified: false, // TODO: Implement email verification
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
}
/*
TODO: Email Authentication Roadmap
- [x] Basic email verification with nodemailer
- [ ] SMS verification via Twilio (future)
- [ ] Magic link authentication (future)
- [ ] Google OAuth integration (future)
- [ ] Microsoft OAuth integration (future)
- [ ] MLS/Realtor database verification (future)
- [ ] NAR (National Association of Realtors) integration (future)
- [ ] State licensing board API verification (future)
- [ ] Real estate company email domain verification (future)
*/

import { Injectable, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{ message: string; userId: string }> {
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user with verification data
    const user = await this.usersService.createWithVerification(registerDto, {
      verificationToken,
      verificationExpiry,
    });

    // Send verification email
    await this.emailService.sendVerificationEmail(
      user.email,
      user.profile?.firstName || registerDto.firstName, // Fix: handle null profile
      verificationToken
    );

    return {
      message: 'Registration successful! Please check your email to verify your account.',
      userId: user.id,
    };
  }

  async verifyEmail(token: string): Promise<AuthResponseDto> {
    const user = await this.usersService.findByVerificationToken(token);
    
    if (!user) {
      throw new BadRequestException('Invalid verification token');
    }

    if (!user.verificationExpiry || user.verificationExpiry < new Date()) { // Fix: handle null
      throw new BadRequestException('Verification token has expired');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    // Mark email as verified
    const verifiedUser = await this.usersService.markEmailAsVerified(user.id);

    // Send welcome email
    await this.emailService.sendWelcomeEmail(
      verifiedUser.email,
      verifiedUser.profile?.firstName || 'Agent' // Fix: handle null profile
    );

    // Return auth tokens for immediate login
    return this.generateTokens(verifiedUser);
  }

  async login(user: any): Promise<AuthResponseDto> {
    if (!user.emailVerified) {
      throw new UnauthorizedException('Please verify your email before logging in');
    }

    return this.generateTokens(user);
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);
    
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.usersService.updateVerificationToken(user.id, {
      verificationToken,
      verificationExpiry,
    });

    // Send new verification email
    await this.emailService.sendVerificationEmail(
      user.email,
      user.profile?.firstName || 'Agent', // Fix: handle null profile
      verificationToken
    );

    return {
      message: 'Verification email sent! Please check your inbox.',
    };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    
    if (user && await this.usersService.validatePassword(password, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    
    return null;
  }

  async updateProfile(userId: string, updateData: any) {
    return this.usersService.updateProfile(userId, updateData);
  }

  async updateUserPreferences(userId: string, preferences: any) {
    return this.usersService.updateProfile(userId, {
      //emailTemplateStyle: preferences.emailTemplateStyle
    });
  }

  private async generateTokens(user: any): Promise<AuthResponseDto> {
    const payload = { 
      email: user.email, 
      sub: user.id,
      firstName: user.profile?.firstName,
      lastName: user.profile?.lastName,
      emailVerified: user.emailVerified,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRY'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_REFRESH_TOKEN_EXPIRY'),
    });

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRY') || '15m', // Fix: handle undefined
      user: {
        id: user.id,
        email: user.email,
        firstName: user.profile?.firstName || '',
        lastName: user.profile?.lastName || '',
        plan: user.profile?.plan || 'FREE',
        emailVerified: user.emailVerified,
      },
    };
  }

  async refreshToken(token: string): Promise<AuthResponseDto> {
    try {
      const payload = this.jwtService.verify(token);
      const user = await this.usersService.findById(payload.sub);
      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
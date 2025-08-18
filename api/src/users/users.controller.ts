// apps/api/src/users/users.controller.ts - FIXED VERSION

import { Body, Controller, Get, Patch, Post, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Controller('api/v1/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('profile')
  async getProfile(@CurrentUser() user: any) {
    return this.usersService.getProfile(user.id);
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: any,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, updateProfileDto);
  }

  @Post('change-password')
  async changePassword(
    @CurrentUser() user: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(user.id, changePasswordDto);
  }

  // EMAIL PREFERENCES ENDPOINTS
  @Get('email-preferences')
  async getEmailPreferences(@CurrentUser() user: any) {
    const userProfile = await this.usersService.findById(user.id);
    return {
      preferredTemplate: userProfile.profile?.preferredEmailTemplate || 'modern',
      brandColor: userProfile.profile?.brandColor || '#3b82f6',
      companyName: userProfile.profile?.company || '',
      agentName: `${userProfile.profile?.firstName || ''} ${userProfile.profile?.lastName || ''}`.trim(),
    };
  }

  @Patch('email-preferences')
  async updateEmailPreferences(
    @CurrentUser() user: any,
    @Body() preferences: { 
      preferredTemplate?: 'modern' | 'classical';
      brandColor?: string;
    }
  ) {
    return this.usersService.updateEmailPreferences(user.id, preferences);
  }

  // GENERAL PREFERENCES ENDPOINTS (if you want to keep these separate)
  @Get('preferences')
  async getPreferences(@CurrentUser() user: any) {
    return this.usersService.getUserPreferences(user.id);
  }

  @Patch('preferences')
  async updatePreferences(
    @CurrentUser() user: any,
    @Body() updatePreferencesDto: UpdatePreferencesDto,
  ) {
    return this.usersService.updateUserPreferences(user.id, updatePreferencesDto);
  }

  @Post('preferences/reset')
  async resetPreferences(@CurrentUser() user: any) {
    return this.usersService.resetUserPreferences(user.id);
  }
}
// apps/api/src/users/users.controller.ts - ENHANCED WITH PREFERENCES ENDPOINTS

import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
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
    // Uses user.id from JWT strategy
    return this.usersService.getProfile(user.id);
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: any,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    // Uses user.id from JWT strategy
    return this.usersService.updateProfile(user.id, updateProfileDto);
  }

  @Post('change-password')
  async changePassword(
    @CurrentUser() user: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    // Uses user.id from JWT strategy
    return this.usersService.changePassword(user.id, changePasswordDto);
  }

  // NEW: Get user preferences
  @Get('preferences')
  async getPreferences(@CurrentUser() user: any) {
    return this.usersService.getUserPreferences(user.id);
  }

  // NEW: Update user preferences
  @Patch('preferences')
  async updatePreferences(
    @CurrentUser() user: any,
    @Body() updatePreferencesDto: UpdatePreferencesDto,
  ) {
    return this.usersService.updateUserPreferences(user.id, updatePreferencesDto);
  }

  // NEW: Reset preferences to defaults
  @Post('preferences/reset')
  async resetPreferences(@CurrentUser() user: any) {
    return this.usersService.resetUserPreferences(user.id);
  }
}
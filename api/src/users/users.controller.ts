// apps/api/src/users/users.controller.ts - FIXED: Use user.id instead of user.userId

import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('api/v1/users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('profile')
  async getProfile(@CurrentUser() user: any) {
    // FIXED: Use user.id instead of user.userId
    // JWT strategy returns user object with 'id' field from usersService.findById()
    return this.usersService.getProfile(user.id);
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: any,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    // FIXED: Use user.id instead of user.userId
    return this.usersService.updateProfile(user.id, updateProfileDto);
  }

  @Post('change-password')
  async changePassword(
    @CurrentUser() user: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    // FIXED: Use user.id instead of user.userId
    return this.usersService.changePassword(user.id, changePasswordDto);
  }
}
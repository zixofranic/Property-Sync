import { IsOptional, IsString, IsArray, IsNumber, IsObject, IsUrl, IsBoolean } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsUrl()
  website?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @IsUrl()
  avatar?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsArray()
  specialties?: string[];

  @IsOptional()
  @IsNumber()
  yearsExperience?: number;

  @IsOptional()
  @IsObject()
  notifications?: {
    emailNewProperties?: boolean;
    emailClientFeedback?: boolean;
    emailWeeklyReport?: boolean;
    smsUrgentOnly?: boolean;
    smsClientActivity?: boolean;
  };

  @IsOptional()
  @IsUrl()
  logo?: string;

  @IsOptional()
  @IsString()
  brandColor?: string;
}
import {
  IsOptional,
  IsString,
  IsArray,
  IsNumber,
  IsObject,
  IsUrl,
  IsBoolean,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

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
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @Transform(({ value }) => value === '' || value === null ? null : value)
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }
    return value;
  })
  @IsString()
  specialties?: string;

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
  @Transform(({ value }) => value === '' || value === null ? null : value)
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  brandColor?: string;
}

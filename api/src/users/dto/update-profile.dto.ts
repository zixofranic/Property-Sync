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
  @Transform(({ value }) => value === '' || value === null ? null : value)
  @ValidateIf((o, value) => value !== null)
  @IsUrl({}, { message: 'Website must be a valid URL' })
  website?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @Transform(({ value }) => value === '' || value === null ? null : value)
  @ValidateIf((o, value) => value !== null)
  @IsUrl({}, { message: 'Avatar must be a valid URL' })
  avatar?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
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
  @ValidateIf((o, value) => value !== null)
  @IsUrl({}, { message: 'Logo must be a valid URL' })
  logo?: string;

  @IsOptional()
  @IsString()
  brandColor?: string;
}

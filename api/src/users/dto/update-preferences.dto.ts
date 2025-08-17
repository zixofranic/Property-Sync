import { IsOptional, IsString, IsBoolean, IsIn } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsIn(['modern', 'classical'])
  emailTemplateStyle?: 'modern' | 'classical';

  @IsOptional()
  notifications?: {
    email?: boolean;
    desktop?: boolean;
    feedback?: boolean;
    newProperties?: boolean;
  };

  @IsOptional()
  @IsIn(['dark', 'light', 'system'])
  theme?: 'dark' | 'light' | 'system';

  @IsOptional()
  @IsBoolean()
  soundEnabled?: boolean;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  brandColor?: string;

  @IsOptional()
  @IsString()
  logo?: string;
}
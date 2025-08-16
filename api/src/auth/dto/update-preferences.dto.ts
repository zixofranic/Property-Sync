import { IsOptional, IsObject, IsBoolean, IsString } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsString()
  emailTemplateStyle?: 'modern' | 'classical';

  @IsOptional()
  @IsObject()
  notifications?: {
    email: boolean;
    desktop: boolean;
    feedback: boolean;
    newProperties: boolean;
  };

  @IsOptional()
  @IsString()
  theme?: 'dark' | 'light' | 'system';

  @IsOptional()
  @IsBoolean()
  soundEnabled?: boolean;
}
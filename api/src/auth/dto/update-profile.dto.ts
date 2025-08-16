import { IsOptional, IsIn, IsString } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @IsIn(['modern', 'classical'])
  emailTemplateStyle?: 'modern' | 'classical';
}
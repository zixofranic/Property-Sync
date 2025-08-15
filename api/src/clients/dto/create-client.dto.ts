import { IsString, IsEmail, IsOptional, MaxLength } from 'class-validator';

export class CreateClientDto {
  // 🆕 FRONTEND COMPATIBILITY - Accept both formats
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;                   // Frontend sends this (combined name)
  
  // 🆕 BACKEND PROCESSING - Split name fields
  @IsString()
  @MaxLength(50)
  firstName: string;

  @IsString()
  @MaxLength(50)
  lastName: string;

  // 🆕 DUAL EMAIL SUPPORT
  @IsEmail()
  email: string;                   // Primary email

  @IsOptional()
  @IsEmail()
  spouseEmail?: string;            // Secondary email for spouse

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  avatar?: string;                 // Profile image URL
}
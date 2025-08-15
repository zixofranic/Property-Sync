import { IsString, IsNumber, IsUrl, IsOptional, MaxLength, Min } from 'class-validator';

export class CreatePropertyDto {
  @IsString()
  @MaxLength(255)
  address: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsString()
  @MaxLength(500)
  description: string;

  @IsUrl()
  imageUrl: string;

  @IsOptional()
  @IsUrl()
  mlsLink?: string;
}
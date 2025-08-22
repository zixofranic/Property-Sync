import { IsString, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PropertyImportDto {
  @IsString()
  batchPropertyId: string;

  @IsOptional()
  @IsString()
  customDescription?: string;

  @IsOptional()
  @IsString()
  agentNotes?: string;

  @IsOptional()
  @IsString()
  customBeds?: string;

  @IsOptional()
  @IsString()
  customBaths?: string;

  @IsOptional()
  @IsString()
  customSqft?: string;
}

export class BatchImportPropertiesDto {
  @IsString()
  batchId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PropertyImportDto)
  properties: PropertyImportDto[];
}

import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateTimelineDto {
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

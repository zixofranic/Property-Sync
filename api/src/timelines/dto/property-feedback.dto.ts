import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum PropertyFeedback {
  LOVE = 'love',
  LIKE = 'like',
  DISLIKE = 'dislike',
}

export class PropertyFeedbackDto {
  @IsEnum(PropertyFeedback)
  feedback: PropertyFeedback;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
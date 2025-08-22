import { IsString, IsOptional, IsObject, IsIn } from 'class-validator';

export class TrackEventDto {
  @IsString()
  @IsIn([
    'timeline_view',
    'property_view',
    'feedback_submit',
    'email_open',
    'email_click',
  ])
  eventType: string;

  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

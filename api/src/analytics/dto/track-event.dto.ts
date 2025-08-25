import { IsString, IsOptional, IsObject, IsIn } from 'class-validator';

export class TrackEventDto {
  @IsString()
  @IsIn([
    'timeline_view',
    'property_view',
    'feedback_submit',
    'email_open',
    'email_click',
    'agent_email_click',
    'agent_phone_click',
    'agent_website_click',
    'agent_profile_view',
    'agent_card_download',
    'agent_card_share',
    'agent_info_copy',
  ])
  eventType: string;

  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

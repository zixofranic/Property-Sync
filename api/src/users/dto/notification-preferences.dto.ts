import { IsBoolean, IsOptional } from 'class-validator';

export class NotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  emailNewClient?: boolean;

  @IsOptional()
  @IsBoolean()
  emailPropertyFeedback?: boolean;

  @IsOptional()
  @IsBoolean()
  emailWeeklyReport?: boolean;

  @IsOptional()
  @IsBoolean()
  emailMarketingUpdates?: boolean;

  @IsOptional()
  @IsBoolean()
  smsClientActivity?: boolean;

  @IsOptional()
  @IsBoolean()
  smsCriticalAlerts?: boolean;

  // Client Activity Notifications
  @IsOptional()
  @IsBoolean()
  notificationClientViews?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationClientLogin?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationEmailOpens?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationInactiveClients?: boolean;
}

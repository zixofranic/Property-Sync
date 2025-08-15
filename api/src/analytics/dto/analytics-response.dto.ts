export class AnalyticsResponseDto {
  id: string;
  eventType: string;
  propertyId?: string;
  timestamp: Date;
  clientName: string;
  metadata?: Record<string, any>;
}
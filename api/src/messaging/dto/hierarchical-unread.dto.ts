import { ApiProperty } from '@nestjs/swagger';

/**
 * ISSUE 10 FIX: TypeScript DTOs for hierarchical response structure
 * Provides type safety and API documentation for hierarchical unread count endpoints
 */

export class PropertyUnreadInfo {
  @ApiProperty({
    description: 'Property ID',
    example: 'cuid_property_123',
  })
  propertyId: string;

  @ApiProperty({
    description: 'Property address',
    example: '123 Main St, Louisville, KY 40202',
  })
  address: string;

  @ApiProperty({
    description: 'Unread message count for this property',
    example: 3,
    minimum: 0,
  })
  unreadCount: number;
}

export class ClientUnreadInfo {
  @ApiProperty({
    description: 'Client ID',
    example: 'cuid_client_456',
  })
  clientId: string;

  @ApiProperty({
    description: 'Client full name',
    example: 'John Doe',
  })
  clientName: string;

  @ApiProperty({
    description: 'Total unread count for this client across all properties',
    example: 5,
    minimum: 0,
  })
  unreadCount: number;

  @ApiProperty({
    description: 'List of properties with unread messages for this client',
    type: [PropertyUnreadInfo],
  })
  properties: PropertyUnreadInfo[];
}

export class HierarchicalUnreadResponse {
  @ApiProperty({
    description: 'Total unread message count across all clients and properties',
    example: 12,
    minimum: 0,
  })
  totalUnread: number;

  @ApiProperty({
    description: 'List of clients with their unread message counts and properties',
    type: [ClientUnreadInfo],
  })
  clients: ClientUnreadInfo[];
}

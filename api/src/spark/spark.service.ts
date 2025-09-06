import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SparkListingDto, SparkApiResponse } from './dto/spark-listing.dto';

@Injectable()
export class SparkService {
  private readonly logger = new Logger(SparkService.name);
  private readonly baseUrl = 'https://sparkapi.com/v1';
  private readonly demoToken = '638ls189dg6fs7ojyj9nkm5py';

  constructor(private configService: ConfigService) {}

  private async makeSparkRequest<T>(endpoint: string, token?: string): Promise<SparkApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const accessToken = token || this.demoToken;

    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `OAuth ${accessToken}`,
          'X-SparkApi-User-Agent': 'PropertySync/1.0',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Spark API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      this.logger.error(`Spark API request failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.makeSparkRequest<SparkListingDto>('/listings?_limit=1');
      return response.D.Success;
    } catch (error) {
      this.logger.error('Spark API connection test failed', error.stack);
      return false;
    }
  }

  async getListings(limit = 10, token?: string): Promise<SparkListingDto[]> {
    try {
      const response = await this.makeSparkRequest<SparkListingDto>(`/listings?_limit=${limit}`, token);
      return response.D.Results;
    } catch (error) {
      this.logger.error('Failed to fetch listings from Spark API', error.stack);
      throw error;
    }
  }

  async getContacts(token?: string): Promise<any[]> {
    try {
      const response = await this.makeSparkRequest<any>('/contacts', token);
      return response.D.Results;
    } catch (error) {
      this.logger.error('Failed to fetch contacts from Spark API', error.stack);
      throw error;
    }
  }

  // OAuth/OpenID Connect methods
  generateAuthUrl(clientId: string, redirectUri: string, state: string): string {
    const authBaseUrl = 'https://sparkapi.com/v1/oauth2';
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state: state,
      scope: 'openid profile api-1',
    });
    
    return `${authBaseUrl}?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string, clientId: string, clientSecret: string, redirectUri: string): Promise<any> {
    const tokenUrl = 'https://sparkapi.com/v1/oauth2/token';
    
    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-SparkApi-User-Agent': 'PropertySync/1.0',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.error('Failed to exchange code for token', error.stack);
      throw error;
    }
  }

  async refreshAccessToken(refreshToken: string, clientId: string, clientSecret: string): Promise<any> {
    const tokenUrl = 'https://sparkapi.com/v1/oauth2/token';
    
    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-SparkApi-User-Agent': 'PropertySync/1.0',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.error('Failed to refresh access token', error.stack);
      throw error;
    }
  }

  /**
   * Convert Spark API property data to PropertySync timeline format
   */
  convertSparkPropertyToTimelineFormat(sparkProperty: any): any {
    const standardFields = sparkProperty.StandardFields;
    
    // Build address string
    const addressParts = [
      standardFields.StreetNumber,
      standardFields.StreetName,
      standardFields.StreetSuffix,
      standardFields.StreetDirSuffix
    ].filter(Boolean);
    const streetAddress = addressParts.join(' ');

    return {
      // Core property data
      address: streetAddress || standardFields.UnparsedFirstLineAddress,
      city: standardFields.City,
      state: standardFields.StateOrProvince,
      zipCode: standardFields.PostalCode,
      price: standardFields.ListPrice,
      
      // Property details
      bedrooms: standardFields.BedsTotal,
      bathrooms: standardFields.BathsTotal,
      squareFootage: standardFields.BuildingAreaTotal,
      propertyType: standardFields.PropertyType,
      
      // Additional info
      description: standardFields.PublicRemarks || `${standardFields.BedsTotal}BR/${standardFields.BathsTotal}BA home in ${standardFields.City}`,
      listingUrl: `https://sparkapi.com/listing/${sparkProperty.Id}`,
      
      // MLS specific data
      mlsId: standardFields.ListingId,
      mlsNumber: standardFields.ListingNumber,
      mlsStatus: standardFields.MlsStatus,
      yearBuilt: standardFields.YearBuilt,
      
      // Agent information
      listingAgent: standardFields.ListAgentName,
      listingOffice: standardFields.ListOfficeName,
      
      // Dates
      listDate: standardFields.OriginalEntryTimestamp,
      modifiedDate: standardFields.ModificationTimestamp,
      
      // Default values for PropertySync system
      imageUrl: '/api/placeholder/400/300', // Default placeholder
      imageUrls: ['/api/placeholder/400/300'],
      isHighlighted: false,
      isViewed: false,
      loadingProgress: 100,
      isFullyParsed: true,
      
      // Spark API specific
      sparkId: sparkProperty.Id,
      resourceUri: sparkProperty.ResourceUri,
    };
  }

  /**
   * Sync Spark properties to a PropertySync timeline
   */
  async syncPropertiesToTimeline(timelineId: string, limit = 10, token?: string): Promise<any[]> {
    try {
      const sparkProperties = await this.getListings(limit, token);
      const convertedProperties = sparkProperties.map(property => 
        this.convertSparkPropertyToTimelineFormat(property)
      );
      
      // Return the converted properties for integration with timeline service
      return convertedProperties;
    } catch (error) {
      this.logger.error('Failed to sync properties to timeline', error.stack);
      throw error;
    }
  }
}
import { Controller, Get, Query, Post, UseGuards, Req, Redirect, Body } from '@nestjs/common';
import { SparkService } from './spark.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { TimelinesService } from '../timelines/timelines.service';
import { PropertyResponseDto } from '../timelines/dto/property-response.dto';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/v1/spark')
export class SparkController {
  constructor(
    private readonly sparkService: SparkService,
    private readonly timelinesService: TimelinesService,
    private readonly prisma: PrismaService
  ) {}

  @Get('test')
  async testConnection() {
    return {
      success: true,
      message: 'Basic endpoint working',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('test-spark')
  async testSparkConnection() {
    const isConnected = await this.sparkService.testConnection();
    return {
      success: isConnected,
      message: isConnected ? 'Spark API connection successful' : 'Spark API connection failed',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('listings')
  async getListings(@Query('limit') limit?: string) {
    const listings = await this.sparkService.getListings(limit ? parseInt(limit) : 10);
    return {
      success: true,
      data: listings,
      count: listings.length,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('contacts')
  async getContacts() {
    const contacts = await this.sparkService.getContacts();
    return {
      success: true,
      data: contacts,
      count: contacts.length,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('auth/connect')
  @UseGuards(JwtAuthGuard)
  async initiateMLSConnection(@CurrentUser() user: any) {
    const clientId = process.env.SPARK_CLIENT_ID;
    const redirectUri = `${process.env.API_BASE_URL}/api/v1/spark/auth/callback`;
    const state = `user_${user.id}_${Date.now()}`;
    
    if (!clientId || clientId === 'your_spark_client_id') {
      return {
        success: false,
        error: 'Spark Platform credentials not configured. Please set SPARK_CLIENT_ID and SPARK_CLIENT_SECRET in your .env file.',
        message: 'To get Spark credentials: 1. Sign up at https://sparkplatform.com/developers/ 2. Create an OAuth app 3. Update your .env file',
        timestamp: new Date().toISOString(),
      };
    }

    const authUrl = this.sparkService.generateAuthUrl(clientId, redirectUri, state);
    
    return {
      success: true,
      authUrl,
      state,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('auth/callback')
  @Public()
  @Redirect()
  async handleOAuthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error?: string,
  ) {
    const frontendUrl = process.env.WEB_BASE_URL || 'http://localhost:3000';
    
    if (error) {
      // Redirect to frontend with error
      return {
        url: `${frontendUrl}/dashboard?mls_error=${encodeURIComponent(error)}`,
      };
    }

    if (!code || !state) {
      return {
        url: `${frontendUrl}/dashboard?mls_error=${encodeURIComponent('Missing authorization code')}`,
      };
    }

    try {
      // Extract userId from state (format: user_<userId>_<timestamp>)
      const stateMatch = state.match(/^user_([^_]+)_\d+$/);
      if (!stateMatch) {
        throw new Error('Invalid state parameter');
      }
      const userId = stateMatch[1];

      const clientId = process.env.SPARK_CLIENT_ID;
      const clientSecret = process.env.SPARK_CLIENT_SECRET;
      const redirectUri = `${process.env.API_BASE_URL}/api/v1/spark/auth/callback`;
      
      if (!clientId || !clientSecret) {
        throw new Error('Spark OAuth credentials not configured');
      }

      // Exchange code for tokens
      const tokenData = await this.sparkService.exchangeCodeForToken(
        code,
        clientId,
        clientSecret,
        redirectUri
      );

      // Calculate token expiry
      const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));

      // Store tokens securely in database (NEVER expose to browser)
      await this.prisma.mLSConnection.upsert({
        where: { userId },
        create: {
          userId,
          mlsName: 'Spark Platform',
          mlsRegion: 'General',
          sparkUserId: tokenData.user_id || null,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenExpiry: expiresAt,
          isActive: true,
          syncStatus: 'success',
          connectionData: {
            connectedAt: new Date().toISOString(),
            scope: tokenData.scope,
            tokenType: tokenData.token_type,
          },
        },
        update: {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenExpiry: expiresAt,
          isActive: true,
          syncStatus: 'success',
          lastSync: new Date(),
          connectionData: {
            reconnectedAt: new Date().toISOString(),
            scope: tokenData.scope,
            tokenType: tokenData.token_type,
          },
        },
      });

      // Redirect to frontend with success message (NO TOKENS IN URL)
      return {
        url: `${frontendUrl}/dashboard?mls_success=true`,
      };
      
    } catch (error) {
      // Redirect to frontend with error
      return {
        url: `${frontendUrl}/dashboard?mls_error=${encodeURIComponent(error.message)}`,
      };
    }
  }

  @Get('connection/status')
  @UseGuards(JwtAuthGuard)
  async getConnectionStatus(@CurrentUser() user: any) {
    try {
      const connection = await this.prisma.mLSConnection.findUnique({
        where: { userId: user.id },
      });

      if (!connection) {
        return {
          success: true,
          connected: false,
          mlsName: null,
          mlsRegion: null,
          lastSync: null,
          timestamp: new Date().toISOString(),
        };
      }

      // Check if token is still valid
      const isTokenExpired = connection.tokenExpiry && connection.tokenExpiry < new Date();
      
      return {
        success: true,
        connected: connection.isActive && !isTokenExpired,
        mlsName: connection.mlsName,
        mlsRegion: connection.mlsRegion,
        lastSync: connection.lastSync,
        syncStatus: connection.syncStatus,
        tokenExpired: isTokenExpired,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Public()
  @Get('test-integration')
  async testPropertyIntegration(@Query('limit') limit?: string) {
    const convertedProperties = await this.sparkService.syncPropertiesToTimeline(
      'test-timeline', 
      limit ? parseInt(limit) : 2
    );
    
    return {
      success: true,
      message: 'Spark properties converted to PropertySync timeline format',
      data: convertedProperties,
      count: convertedProperties.length,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('sync-to-timeline')
  @UseGuards(JwtAuthGuard)
  async syncSparkPropertiesToTimeline(
    @CurrentUser() user: any,
    @Body() body: { timelineId: string; limit?: number; sparkToken?: string }
  ) {
    try {
      // Get converted Spark properties
      const convertedProperties = await this.sparkService.syncPropertiesToTimeline(
        body.timelineId,
        body.limit || 5,
        body.sparkToken
      );

      // Add each property to the timeline using the existing service
      const addedProperties: PropertyResponseDto[] = [];
      for (const propertyData of convertedProperties) {
        try {
          const addedProperty = await this.timelinesService.addPropertyToTimeline(
            user.id,
            body.timelineId,
            propertyData
          );
          addedProperties.push(addedProperty);
        } catch (error) {
          // Continue with next property if one fails
          console.warn(`Failed to add property ${propertyData.address}:`, error.message);
        }
      }

      return {
        success: true,
        message: `Successfully synced ${addedProperties.length} properties from Spark API to timeline`,
        data: {
          timelineId: body.timelineId,
          addedProperties,
          totalAttempted: convertedProperties.length,
          totalAdded: addedProperties.length,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
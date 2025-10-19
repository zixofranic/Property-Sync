import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { MLSParserService } from './mls-parser.service';
import { ParseMLSUrlsDto, ParseSingleMLSDto } from './dto/parse-mls-urls.dto';
import { BatchImportPropertiesDto } from './dto/batch-import-properties.dto';
import { RapidAPIService } from './rapidapi.service';
import { TimelinesService } from '../timelines/timelines.service';

@Controller('api/v1/mls')
export class MLSParserController {
  constructor(
    private readonly mlsParserService: MLSParserService,
    private readonly rapidApiService: RapidAPIService,
    private readonly timelinesService: TimelinesService,
  ) {}

  // Test browser connection (no auth required)
  @Public()
  @Get('test-browser')
  async testBrowser() {
    return await this.mlsParserService.testBrowserConnection();
  }

  // CTO FIX 3: Circuit breaker health status endpoint (no auth required for debugging)
  @Public()
  @Get('health')
  async getHealthStatus() {
    try {
      const healthStatus = await this.rapidApiService.getHealthStatus();
      return {
        success: true,
        timestamp: new Date().toISOString(),
        ...healthStatus,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // CTO FIX 6: Manual circuit breaker reset endpoint (no auth required for debugging)
  @Public()
  @Post('reset-circuit-breaker')
  async resetCircuitBreaker() {
    try {
      this.rapidApiService.resetCircuitBreaker();
      return {
        success: true,
        message: 'Circuit breaker manually reset to CLOSED state',
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

  // Parse a single MLS URL quickly (basic info only)
  @Post('parse-single-quick')
  @UseGuards(JwtAuthGuard)
  async parseSingleQuick(@Request() req, @Body() parseDto: ParseSingleMLSDto) {
    try {
      const result = await this.mlsParserService.parseQuickMLS(parseDto.mlsUrl);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          mlsUrl: result.mlsUrl,
        };
      }

      // Check for duplicates
      const agentId = req.user.id;
      const { clientId } = req.query;

      if (clientId && result.data) {
        const duplicateCheck =
          await this.mlsParserService.checkEnhancedDuplicate(
            agentId,
            clientId,
            result.data,
          );

        if (duplicateCheck.isDuplicate) {
          return {
            success: false,
            error: `Duplicate property: ${duplicateCheck.reason}`,
            isDuplicate: true,
            existingProperty: duplicateCheck.existingProperty,
            mlsUrl: result.mlsUrl,
          };
        }
      }

      return {
        success: true,
        data: result.data,
        mlsUrl: result.mlsUrl,
        isQuickParse: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        mlsUrl: parseDto.mlsUrl,
      };
    }
  }

  // Parse a single MLS URL (full details)
  @Post('parse-single')
  @UseGuards(JwtAuthGuard)
  async parseSingle(@Request() req, @Body() parseDto: ParseSingleMLSDto) {
    try {
      const result = await this.mlsParserService.parseSingleMLS(
        parseDto.mlsUrl,
      );

      if (!result.success) {
        return {
          success: false,
          error: result.error,
          mlsUrl: result.mlsUrl,
        };
      }

      // Check for duplicates
      const agentId = req.user.id;
      const { clientId } = req.query;

      if (clientId && result.data) {
        const duplicateCheck =
          await this.mlsParserService.checkEnhancedDuplicate(
            agentId,
            clientId,
            result.data,
          );

        if (duplicateCheck.isDuplicate) {
          return {
            success: false,
            error: `Duplicate property: ${duplicateCheck.reason}`,
            isDuplicate: true,
            existingProperty: duplicateCheck.existingProperty,
            mlsUrl: result.mlsUrl,
          };
        }
      }

      return {
        success: true,
        data: result.data,
        mlsUrl: result.mlsUrl,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        mlsUrl: parseDto.mlsUrl,
      };
    }
  }

  // Parse multiple MLS URLs
  @Post('parse-batch')
  @UseGuards(JwtAuthGuard)
  async parseBatch(
    @Request() req,
    @Body() parseDto: ParseMLSUrlsDto,
    @Query('clientId') clientId?: string,
  ) {
    try {
      const agentId = req.user.id;
      const results = await this.mlsParserService.parseBatchMLS(
        parseDto.mlsUrls,
      );

      // Check duplicates for successful parses
      const enhancedResults: any[] = [];

      for (const result of results) {
        if (result.success && clientId && result.data) {
          const duplicateCheck =
            await this.mlsParserService.checkEnhancedDuplicate(
              agentId,
              clientId,
              result.data,
            );

          enhancedResults.push({
            ...result,
            isDuplicate: duplicateCheck.isDuplicate,
            duplicateReason: duplicateCheck.reason,
            existingProperty: duplicateCheck.existingProperty,
          });
        } else {
          enhancedResults.push(result);
        }
      }

      const successCount = enhancedResults.filter(
        (r) => r.success && !r.isDuplicate,
      ).length;
      const duplicateCount = enhancedResults.filter(
        (r) => r.isDuplicate,
      ).length;
      const errorCount = enhancedResults.filter((r) => !r.success).length;

      return {
        success: true,
        results: enhancedResults,
        summary: {
          total: parseDto.mlsUrls.length,
          successful: successCount,
          duplicates: duplicateCount,
          errors: errorCount,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // NEW RAPIDAPI ENDPOINTS (Address Search - No URL Scraping)

  /**
   * Search properties by address OR property_id using RapidAPI
   * Example: POST /api/v1/mls/search
   * Body: { "address": "3617 Nellie Bly Dr, Louisville, KY" } OR { "address": "1700441" }
   */
  @Post('search')
  @UseGuards(JwtAuthGuard)
  async searchProperties(@Body() body: { address: string }) {
    try {
      console.log('\n════════════════════════════════════════');
      console.log('🔍 SEARCH REQUEST RECEIVED');
      console.log('════════════════════════════════════════');
      console.log('Address:', body.address);

      // Check if input is a property ID (numbers only)
      const isPropertyId = /^\d+$/.test(body.address.trim());

      if (isPropertyId) {
        console.log('🔍 Controller: Detected property ID search:', body.address);
        // Redirect to lookup endpoint logic
        return await this.lookupProperty({ propertyId: body.address.trim() });
      }

      // Parse address into components
      const addressParts = body.address.split(',').map(s => s.trim());
      const hasStreetAddress = addressParts.length >= 3; // "Street, City, State Zip"
      const streetAddress = hasStreetAddress ? addressParts[0].toLowerCase() : null;

      console.log('🔍 Controller: Parsed street address:', streetAddress);

      // Extract zip code from address
      const zipMatch = body.address.match(/\b(\d{5})\b/);
      const zipCode = zipMatch ? zipMatch[1] : null;

      // Parse city and state
      const { city, stateCode } = this.rapidApiService.parseAddress(body.address);
      console.log('🔍 Controller: Parsed - city:', city, 'state:', stateCode, 'zip:', zipCode);

      // Search using RapidAPI - use zip code if available (much more accurate!)
      const searchParam = zipCode || city;
      console.log('🔍 Controller: Searching with:', zipCode ? `zip code ${zipCode}` : `city ${city}`);
      const results = await this.rapidApiService.searchProperties(searchParam, stateCode, 50);
      console.log('🔍 Controller: Got', results.length, 'results from RapidAPI');

      // Map results to response format
      let mappedResults = results.map((property) => ({
        property_id: property.property_id,
        address: property.location?.address?.line || '',
        city: property.location?.address?.city || '',
        state: property.location?.address?.state_code || '',
        zipCode: property.location?.address?.postal_code || '',
        price: property.list_price || property.price,
        beds: property.description?.beds || 0,
        baths: property.description?.baths || 0,
        sqft: property.description?.sqft || 0,
        photo: property.primary_photo?.href || property.photos?.[0]?.href || '',
        status: property.status || '',
      }));

      // If a specific street address was provided, try to filter results to match
      if (streetAddress && streetAddress.length > 3) {
        console.log('🔍 Controller: Filtering for street address:', streetAddress);
        console.log('🔍 Controller: Total results before filtering:', mappedResults.length);
        console.log('🔍 Controller: Sample addresses from API (first 5):');
        mappedResults.slice(0, 5).forEach(prop => {
          console.log('  -', prop.address);
        });

        // Extract street number from search address (e.g., "1864" from "1864 princeton dr")
        const streetNumberMatch = streetAddress.match(/^\d+/);
        const streetNumber = streetNumberMatch ? streetNumberMatch[0] : null;

        const filtered = mappedResults.filter((prop) => {
          const propAddress = prop.address.toLowerCase();

          // If we have a street number, prioritize exact number matches
          if (streetNumber) {
            const propHasNumber = propAddress.startsWith(streetNumber);
            if (propHasNumber) {
              // Check if rest of address also matches
              return propAddress.includes(streetAddress.replace(streetNumber, '').trim().split(' ')[0]);
            }
          }

          // Fallback: check if the property address contains the street address
          return propAddress.includes(streetAddress);
        });

        console.log('🔍 Controller: After filtering, found', filtered.length, 'matching properties');

        // If we found matches, use them; otherwise return all results
        if (filtered.length > 0) {
          mappedResults = filtered; // Return all matches (don't limit to 10 yet)
        } else {
          // No exact matches found, return all results from the search
          console.log('⚠️ Controller: No exact matches found, returning all search results');
        }
      }

      // Limit final results to 20 (whether filtered or not)
      mappedResults = mappedResults.slice(0, 20);

      const response = {
        success: true,
        count: mappedResults.length,
        results: mappedResults,
        searchType: streetAddress ? 'address-filtered' : 'city-search',
      };

      console.log('\n✅ SEARCH RESPONSE');
      console.log('Success:', response.success);
      console.log('Count:', response.count);
      console.log('Search Type:', response.searchType);
      console.log('Results:', JSON.stringify(response.results, null, 2).slice(0, 500));
      console.log('════════════════════════════════════════\n');

      return response;
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Lookup property by property_id or MLS number using RapidAPI
   * Example: POST /api/v1/mls/lookup
   * Body: { "propertyId": "1700441" }
   * Returns property in search result format for display in modal
   */
  @Post('lookup')
  @UseGuards(JwtAuthGuard)
  async lookupProperty(@Body() body: { propertyId: string }) {
    try {
      console.log('🔍 Controller: Looking up property ID:', body.propertyId);

      // Fetch full property details from RapidAPI
      const propertyData = await this.rapidApiService.getPropertyById(body.propertyId);

      // Map to search result format for consistency
      const result = {
        property_id: body.propertyId,
        address: propertyData.address?.street || '',
        city: propertyData.address?.city || '',
        state: propertyData.address?.state || '',
        zipCode: propertyData.address?.zipCode || '',
        price: propertyData.pricing?.priceNumeric || 0,
        beds: parseInt(propertyData.propertyDetails?.beds || '0') || 0,
        baths: parseInt(propertyData.propertyDetails?.baths || '0') || 0,
        sqft: parseInt((propertyData.propertyDetails?.sqft || '0').replace(/,/g, '')) || 0,
        photo: propertyData.images?.[0] || '',
        status: propertyData.listingInfo?.status || 'for_sale',
      };

      return {
        success: true,
        count: 1,
        results: [result],
        searchType: 'property-id-lookup',
      };
    } catch (error) {
      console.error('❌ Property lookup failed:', error.message);
      return {
        success: false,
        error: `Property ${body.propertyId} not found: ${error.message}`,
        count: 0,
        results: [],
      };
    }
  }

  /**
   * Import property by property_id using RapidAPI
   * Example: POST /api/v1/mls/import
   * Body: { "propertyId": "4951372754", "clientId": "required-client-id" }
   */
  @Post('import')
  @UseGuards(JwtAuthGuard)
  async importProperty(
    @Request() req,
    @Body() body: { propertyId: string; clientId: string },
  ) {
    try {
      const agentId = req.user.id;

      if (!body.clientId) {
        return {
          success: false,
          error: 'clientId is required to import property',
        };
      }

      // Fetch full property details from RapidAPI
      const propertyData = await this.rapidApiService.getPropertyById(body.propertyId);

      // Find or create timeline for this client
      console.log('📋 Getting timeline for client:', body.clientId);
      let timeline = await this.timelinesService.getAgentTimeline(agentId, body.clientId);
      console.log('📋 Timeline result:', timeline ? `Found (${timeline.id})` : 'Not found');

      let timelineId = timeline.id;

      // If no timeline exists, create one
      if (!timelineId) {
        console.log('📋 Creating new timeline...');
        const prisma = this.timelinesService['prisma']; // Access via bracket notation
        const client = await prisma.client.findFirst({
          where: { id: body.clientId, agentId },
        });

        if (!client) {
          console.log('❌ Client not found');
          return {
            success: false,
            error: 'Client not found',
          };
        }

        const newTimeline = await prisma.timeline.create({
          data: {
            agentId,
            clientId: body.clientId,
            title: `Properties for ${client.firstName} ${client.lastName}`,
            description: 'Property timeline created automatically',
            isActive: true,
            shareToken: require('crypto').randomBytes(16).toString('hex'),
          },
        });

        timelineId = newTimeline.id;
        console.log('✅ Timeline created:', timelineId);
      }

      // Save property to timeline with all RapidAPI data
      console.log('💾 Adding property to timeline:', timelineId);
      const savedProperty = await this.timelinesService.addRapidAPIPropertyToTimeline(
        agentId,
        timelineId,
        propertyData,
      );
      console.log('✅ Property saved:', savedProperty.id);

      return {
        success: true,
        data: savedProperty,
        message: 'Property imported and added to timeline successfully',
        timelineId,
      };
    } catch (error) {
      console.error('❌ Import error:', error.message);
      console.error('❌ Stack:', error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Autocomplete address suggestions using RapidAPI
   * Example: GET /api/v1/mls/autocomplete?query=3617 Nellie
   */
  @Get('autocomplete')
  @UseGuards(JwtAuthGuard)
  async autocomplete(@Query('query') query: string) {
    try {
      // Call RapidAPI keywords-search-suggest endpoint
      const response = await this.rapidApiService.client.get('/keywords-search-suggest', {
        params: { query },
      });

      const suggestions = response.data?.data || [];

      return {
        success: true,
        suggestions: suggestions.map((item: any) => ({
          text: item.text || item.label || item,
          type: item.type || 'address',
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        suggestions: [],
      };
    }
  }
}
 

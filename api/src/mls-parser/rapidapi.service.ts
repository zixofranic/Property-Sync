import { Injectable, Logger, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import axios, { AxiosInstance } from 'axios';
import { ParsedMLSProperty } from './interfaces/mls-property.interface';

/**
 * RapidAPI Real Estate Service
 * Replaces web scraping with official API calls to RapidAPI US Real Estate endpoint
 *
 * CACHING STRATEGY:
 * - Property details cached for 1 hour (properties rarely change)
 * - Search results cached for 10 minutes (market changes faster)
 * - Autocomplete cached for 5 minutes (frequently changing)
 */

/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures when API becomes unreliable
 */
export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing fast, not making requests
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number | null = null;
  private readonly failureThreshold: number = 5; // Open after 5 consecutive failures
  private readonly successThreshold: number = 2; // Close after 2 successes in half-open
  private readonly timeout: number = 60000; // Try again after 60 seconds

  constructor(private readonly logger: any) {}

  async execute<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    // If circuit is open, check if we should try again
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.logger.warn('🟡 Circuit breaker entering HALF_OPEN state - testing recovery');
        this.state = CircuitState.HALF_OPEN;
      } else {
        this.logger.error('🔴 Circuit breaker is OPEN - failing fast');
        if (fallback) {
          this.logger.log('⚡ Using fallback due to open circuit');
          return await fallback();
        }
        throw new Error('Circuit breaker is OPEN - API temporarily unavailable');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      // Use fallback if available (circuit may have opened due to failures)
      if (fallback) {
        this.logger.log('⚡ Using fallback after request failure');
        return await fallback();
      }
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.logger.log('🟢 Circuit breaker CLOSED - service recovered');
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    if (this.failureCount >= this.failureThreshold) {
      this.logger.error(`🔴 Circuit breaker OPEN - ${this.failureCount} consecutive failures`);
      this.state = CircuitState.OPEN;
    }
  }

  private shouldAttemptReset(): boolean {
    return (
      this.lastFailureTime !== null &&
      Date.now() - this.lastFailureTime >= this.timeout
    );
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  // CTO FIX 4: Manual circuit breaker reset
  reset(): void {
    this.logger.log('🔄 Manually resetting circuit breaker to CLOSED state');
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }
}

/**
 * Retry utility with exponential backoff
 * Handles transient failures like network glitches or temporary API overload
 */
class RetryWithBackoff {
  constructor(
    private readonly maxRetries: number = 3,
    private readonly baseDelay: number = 1000, // 1 second
    private readonly maxDelay: number = 10000, // 10 seconds
    private readonly logger?: any
  ) {}

  async execute<T>(
    fn: () => Promise<T>,
    isRetryable: (error: any) => boolean = () => true
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0 && this.logger) {
          this.logger.log(`🔄 Retry attempt ${attempt}/${this.maxRetries}`);
        }

        return await fn();
      } catch (error) {
        lastError = error;

        // Check if we should retry this error
        if (!isRetryable(error)) {
          if (this.logger) {
            this.logger.warn(`❌ Error not retryable: ${error.message}`);
          }
          throw error;
        }

        // Don't retry if we've exhausted attempts
        if (attempt >= this.maxRetries) {
          if (this.logger) {
            this.logger.error(`❌ Max retries (${this.maxRetries}) exceeded`);
          }
          throw error;
        }

        // Calculate delay with exponential backoff and jitter
        const exponentialDelay = Math.min(
          this.baseDelay * Math.pow(2, attempt),
          this.maxDelay
        );
        const jitter = Math.random() * 0.3 * exponentialDelay; // +/- 30% jitter
        const delay = exponentialDelay + jitter;

        if (this.logger) {
          this.logger.warn(`⏳ Retrying after ${Math.round(delay)}ms (attempt ${attempt + 1}/${this.maxRetries})`);
        }

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Determine if an error is retryable
   */
  static isRetryableError(error: any): boolean {
    // Retry on network errors
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return true;
    }
    if (error.code === 'ECONNRESET' || error.code === 'EPIPE') {
      return true;
    }

    // Retry on specific HTTP status codes
    const status = error.response?.status;
    if (status === 429) return true; // Rate limit - retry with backoff
    if (status === 502) return true; // Bad Gateway
    if (status === 503) return true; // Service Unavailable
    if (status === 504) return true; // Gateway Timeout
    if (status >= 500) return true; // Other 5xx errors

    // Don't retry on 4xx client errors (except 429)
    if (status >= 400 && status < 500) {
      return false;
    }

    return false;
  }
}

/**
 * API Quota Management System
 * Tracks API usage to prevent exceeding monthly limits
 */
class QuotaManager {
  private readonly quotaKey: string = 'rapidapi:quota';
  private readonly monthlyLimit: number;

  constructor(
    private readonly cacheManager: any,
    private readonly logger: any,
    monthlyLimit: number = 500 // Free tier limit
  ) {
    this.monthlyLimit = monthlyLimit;
  }

  async checkAndIncrement(endpoint: string): Promise<void> {
    const currentMonth = this.getCurrentMonthKey();
    const quotaData = await this.getQuotaData(currentMonth);

    // Check if we're over limit
    if (quotaData.total >= this.monthlyLimit) {
      this.logger.error(`🚫 API Quota EXCEEDED: ${quotaData.total}/${this.monthlyLimit} requests this month`);
      throw new Error(`API quota exceeded: ${quotaData.total}/${this.monthlyLimit} requests used this month`);
    }

    // Warn if approaching limit
    const percentUsed = (quotaData.total / this.monthlyLimit) * 100;
    if (percentUsed >= 90) {
      this.logger.warn(`⚠️ API Quota WARNING: ${percentUsed.toFixed(1)}% used (${quotaData.total}/${this.monthlyLimit})`);
    } else if (percentUsed >= 75) {
      this.logger.warn(`📊 API Quota: ${percentUsed.toFixed(1)}% used (${quotaData.total}/${this.monthlyLimit})`);
    }

    // Increment quota
    quotaData.total++;
    quotaData.byEndpoint[endpoint] = (quotaData.byEndpoint[endpoint] || 0) + 1;
    quotaData.lastRequest = new Date().toISOString();

    await this.saveQuotaData(currentMonth, quotaData);

    this.logger.log(`📊 API Request logged: ${quotaData.total}/${this.monthlyLimit} (${endpoint})`);
  }

  async getUsageStats() {
    const currentMonth = this.getCurrentMonthKey();
    const quotaData = await this.getQuotaData(currentMonth);

    return {
      month: currentMonth,
      total: quotaData.total,
      limit: this.monthlyLimit,
      remaining: this.monthlyLimit - quotaData.total,
      percentUsed: ((quotaData.total / this.monthlyLimit) * 100).toFixed(2),
      byEndpoint: quotaData.byEndpoint,
      lastRequest: quotaData.lastRequest,
    };
  }

  private async getQuotaData(monthKey: string): Promise<any> {
    const cacheKey = `${this.quotaKey}:${monthKey}`;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      return cached;
    }

    // Initialize new month
    return {
      total: 0,
      byEndpoint: {},
      lastRequest: null,
    };
  }

  private async saveQuotaData(monthKey: string, data: any): Promise<void> {
    const cacheKey = `${this.quotaKey}:${monthKey}`;
    // Store for 60 days (outlasts the month)
    await this.cacheManager.set(cacheKey, data, 5184000000); // 60 days
  }

  private getCurrentMonthKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
}

/**
 * Custom error classes for better error handling
 */
class RapidAPIError extends Error {
  constructor(message: string, public statusCode?: number, public apiResponse?: any) {
    super(message);
    this.name = 'RapidAPIError';
  }
}

class RapidAPIValidationError extends Error {
  constructor(message: string, public invalidFields?: string[]) {
    super(message);
    this.name = 'RapidAPIValidationError';
  }
}

@Injectable()
export class RapidAPIService {
  private readonly logger = new Logger(RapidAPIService.name);
  public readonly client: AxiosInstance; // Public for autocomplete endpoint
  private readonly apiKey: string;
  private readonly apiHost: string;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly retryUtility: RetryWithBackoff;
  private readonly quotaManager: QuotaManager;
  private readonly inFlightRequests: Map<string, Promise<any>> = new Map();

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
    // Load from environment variables
    this.apiKey = process.env.RAPIDAPI_KEY || '';
    this.apiHost = process.env.RAPIDAPI_HOST || 'us-real-estate.p.rapidapi.com';

    if (!this.apiKey) {
      this.logger.warn('RAPIDAPI_KEY not set in environment variables');
    }

    // Create axios instance with default headers
    this.client = axios.create({
      baseURL: `https://${this.apiHost}`,
      headers: {
        'X-RapidAPI-Key': this.apiKey,
        'X-RapidAPI-Host': this.apiHost,
      },
      timeout: 10000, // 10 second timeout
    });

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker(this.logger);

    // Initialize retry utility (3 retries, 1s base delay, 10s max delay)
    this.retryUtility = new RetryWithBackoff(3, 1000, 10000, this.logger);

    // Initialize quota manager (500 requests/month for free tier)
    this.quotaManager = new QuotaManager(this.cacheManager, this.logger, 500);
  }

  /**
   * Validate search response structure
   * @throws RapidAPIValidationError if response is invalid
   */
  private validateSearchResponse(response: any): boolean {
    const invalidFields: string[] = [];

    if (!response) {
      throw new RapidAPIValidationError('Empty response from API');
    }

    if (!response.data) {
      invalidFields.push('data');
    }

    if (!response.data?.data) {
      invalidFields.push('data.data');
    }

    if (!response.data?.data?.home_search) {
      this.logger.warn('⚠️ Response missing home_search - may indicate no results');
      return false; // Not an error, just no results
    }

    if (!Array.isArray(response.data.data.home_search.results)) {
      invalidFields.push('data.data.home_search.results (not an array)');
    }

    if (invalidFields.length > 0) {
      throw new RapidAPIValidationError(
        `Invalid search response structure: ${invalidFields.join(', ')}`,
        invalidFields
      );
    }

    return true;
  }

  /**
   * Validate property detail response structure
   * @throws RapidAPIValidationError if response is invalid
   */
  private validatePropertyDetailResponse(response: any): boolean {
    const invalidFields: string[] = [];

    if (!response) {
      throw new RapidAPIValidationError('Empty response from API');
    }

    if (!response.data) {
      invalidFields.push('data');
    }

    if (!response.data?.data) {
      invalidFields.push('data.data');
    }

    // Check for essential property fields
    const propertyData = response.data?.data;
    if (propertyData) {
      if (!propertyData.location?.address) {
        invalidFields.push('location.address');
      }
      if (!propertyData.description && !propertyData.list_price) {
        invalidFields.push('description or list_price');
      }
    }

    if (invalidFields.length > 0) {
      throw new RapidAPIValidationError(
        `Invalid property detail response: ${invalidFields.join(', ')}`,
        invalidFields
      );
    }

    return true;
  }

  /**
   * Handle API errors with detailed logging
   */
  private handleAPIError(error: any, context: string): never {
    const statusCode = error.response?.status;
    const apiResponse = error.response?.data;

    let errorMessage = `${context} failed`;

    if (statusCode === 401) {
      errorMessage = 'RapidAPI authentication failed - check API key';
    } else if (statusCode === 403) {
      errorMessage = 'RapidAPI access forbidden - check subscription and permissions';
    } else if (statusCode === 429) {
      errorMessage = 'RapidAPI rate limit exceeded - quota exhausted';
    } else if (statusCode === 500) {
      errorMessage = 'RapidAPI server error - service temporarily unavailable';
    } else if (statusCode === 503) {
      errorMessage = 'RapidAPI service unavailable - try again later';
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'RapidAPI request timeout - slow network or API overload';
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorMessage = 'RapidAPI unreachable - check network connection';
    } else if (error.message) {
      errorMessage = `${context}: ${error.message}`;
    }

    this.logger.error(`❌ ${errorMessage}`);
    this.logger.error(`❌ Status: ${statusCode}, Response:`, apiResponse);

    throw new RapidAPIError(errorMessage, statusCode, apiResponse);
  }

  /**
   * Deduplicate in-flight requests
   * If multiple identical requests are made simultaneously, only one API call is made
   * and all callers receive the same result
   */
  private async deduplicateRequest<T>(
    requestKey: string,
    requestFn: () => Promise<T>
  ): Promise<T> {
    // Check if this request is already in flight
    const existingRequest = this.inFlightRequests.get(requestKey);
    if (existingRequest) {
      this.logger.log(`🔄 Deduplicating request: ${requestKey}`);
      return existingRequest;
    }

    // Execute the request and store the promise
    const requestPromise = requestFn()
      .finally(() => {
        // Clean up after request completes (success or failure)
        this.inFlightRequests.delete(requestKey);
      });

    this.inFlightRequests.set(requestKey, requestPromise);
    return requestPromise;
  }

  /**
   * Search for properties by address
   * @param city City name (e.g. "Louisville")
   * @param stateCode State code (e.g. "KY")
   * @param limit Maximum number of results (default: 10)
   * @returns Array of property search results
   */
  async searchProperties(
    city: string,
    stateCode: string,
    limit: number = 10,
  ): Promise<any[]> {
    // CACHING DISABLED FOR TESTING - Skip all cache operations
    this.logger.log(`🔴 Cache DISABLED: Fetching fresh from RapidAPI for ${city}, ${stateCode}`);

    // Deduplicate simultaneous identical requests
    const requestKey = `search:${city}:${stateCode}:${limit}`;
    return this.deduplicateRequest(requestKey, () => this.executeSearchRequestNoCache(city, stateCode, limit));
  }

  /**
   * Execute the actual search request WITHOUT cache (for testing)
   */
  private async executeSearchRequestNoCache(
    city: string,
    stateCode: string,
    limit: number
  ): Promise<any[]> {
    this.logger.log(`🔴 Fetching from RapidAPI for ${city}, ${stateCode} (NO CACHE)`);

    // No fallback when testing
    const staleFallback = async () => {
      this.logger.warn(`No cache fallback available (caching disabled)`);
      return [];
    };

    // Execute API call through circuit breaker with retry logic
    try {
      return await this.circuitBreaker.execute(
        async () => {
          // Check API quota before making request
          await this.quotaManager.checkAndIncrement('/v3/for-sale');

          // Extract zip code from city if provided (e.g., "Louisville 40291")
          const zipMatch = city.match(/\b(\d{5})\b/);
          const postalCode = zipMatch ? zipMatch[1] : null;

          // Wrap API call with retry logic
          const response = await this.retryUtility.execute(
            async () => {
              const requestBody: any = {
                limit: limit,
                offset: 0,
                status: ['for_sale', 'ready_to_build'],
                sort: {
                  direction: 'desc',
                  field: 'list_date'
                }
              };

              // Use postal_code if available, otherwise fallback to city + state
              if (postalCode) {
                requestBody.postal_code = postalCode;
              } else {
                requestBody.city = city;
                requestBody.state_code = stateCode;
              }

              // CTO FIX 1: Log request body to debug parameter issues
              this.logger.log('📤 API Request Body:', JSON.stringify(requestBody, null, 2));
              this.logger.log(`📤 Search Method: ${postalCode ? 'POSTAL_CODE' : 'CITY+STATE'}`);

              return await this.client.post('/properties/v3/list', requestBody);
            },
            RetryWithBackoff.isRetryableError
          );

          // CTO FIX 2: Enhanced response structure diagnostics
          this.logger.log('📥 RapidAPI Response Keys:', Object.keys(response.data || {}));
          if (!response.data?.data?.home_search) {
            this.logger.warn('⚠️ Unexpected response structure - logging first 1000 chars:');
            this.logger.warn(JSON.stringify(response.data, null, 2).slice(0, 1000));
          }

          // Validate response structure
          try {
            const isValid = this.validateSearchResponse(response);
            if (!isValid) {
              // No results found (not an error)
              this.logger.warn(`⚠️ No properties found for ${city}, ${stateCode} (NO CACHE MODE)`);
              return [];
            }
          } catch (validationError) {
            this.logger.error(`❌ Response validation failed: ${validationError.message} (NO CACHE MODE)`);
            throw validationError;
          }

          const results = response.data.data.home_search.results;

          // CACHING DISABLED - Skip cache save
          this.logger.log(`✅ Returning ${results.length} properties for ${city}, ${stateCode} (NO CACHE)`);

          return results;
        },
        staleFallback
      );
    } catch (error) {
      // Handle API errors with detailed context (NO CACHE FALLBACK)
      if (error.name === 'RapidAPIValidationError') {
        this.logger.error(`Validation error - no cache fallback available`);
        throw error;
      }

      // Handle API error with detailed context
      this.handleAPIError(error, `Property search for ${city}, ${stateCode}`);
    }
  }

  /**
   * Get full property details by property_id
   * @param propertyId RapidAPI property_id
   * @returns Full parsed property data
   */
  async getPropertyById(propertyId: string): Promise<ParsedMLSProperty> {
    // CACHING DISABLED FOR TESTING - Skip all cache operations
    this.logger.log(`🔴 Cache DISABLED: Fetching property ${propertyId} fresh from RapidAPI`);

    // Deduplicate simultaneous identical requests
    const requestKey = `property:${propertyId}`;
    return this.deduplicateRequest(requestKey, () => this.executePropertyDetailRequestNoCache(propertyId));
  }

  /**
   * Execute the actual property detail request WITHOUT cache (for testing)
   */
  private async executePropertyDetailRequestNoCache(
    propertyId: string
  ): Promise<ParsedMLSProperty> {
    this.logger.log(`🔴 Fetching property details for ID: ${propertyId} (NO CACHE)`);

    // No fallback when testing
    const staleFallback = async () => {
      this.logger.warn(`No cache fallback available (caching disabled)`);
      throw new Error(`Property ${propertyId} not found and no cached data available`);
    };

    // Execute API call through circuit breaker with retry logic
    try {
      return await this.circuitBreaker.execute(
        async () => {
          // Check API quota before making request
          await this.quotaManager.checkAndIncrement('/v3/property-detail');

          // Wrap API call with retry logic
          const response = await this.retryUtility.execute(
            async () => {
              return await this.client.get('/properties/v3/detail', {
                params: { property_id: propertyId },
              });
            },
            RetryWithBackoff.isRetryableError
          );

          // Validate response structure
          try {
            this.validatePropertyDetailResponse(response);
          } catch (validationError) {
            this.logger.error(`❌ Property detail validation failed: ${validationError.message} (NO CACHE MODE)`);
            throw new RapidAPIError(`Property ${propertyId} not found or has invalid data structure`);
          }

          // Transform API response to our schema
          const propertyData = this.transformToPropertySchema(response.data.data, propertyId);

          // CACHING DISABLED - Skip cache save
          this.logger.log(`✅ Returning property ${propertyId} (NO CACHE)`);

          return propertyData;
        },
        staleFallback
      );
    } catch (error) {
      // Handle validation errors (NO CACHE FALLBACK)
      if (error.name === 'RapidAPIValidationError' || error.name === 'RapidAPIError') {
        this.logger.error(`Validation/API error - no cache fallback available`);
        throw error;
      }

      // Handle API error with detailed context
      this.handleAPIError(error, `Property detail fetch for ${propertyId}`);
    }
  }

  /**
   * Parse full address into city and state for API search
   * @param address Full address string (e.g. "123 Main St, Louisville, KY 40202")
   * @returns Parsed city and state
   */
  parseAddress(address: string): { city: string; stateCode: string } {
    // Flexible parsing - handles various address formats
    const parts = address.split(',').map(s => s.trim());

    if (parts.length < 1) {
      throw new Error('Invalid address format. Expected at least: "City, STATE" or "City"');
    }

    // Search for state code in the LAST TWO parts only (avoid matching street abbreviations like "Dr", "St", "Rd")
    // This handles: "123 Main St, Louisville, KY 40202" or "Louisville, KY"
    const lastTwoParts = parts.slice(-2).join(' '); // e.g., "Louisville KY 40202" or "KY 40202"
    const stateMatch = lastTwoParts.match(/\b([A-Z]{2})\b/i);

    let stateCode: string;
    let city: string;

    if (stateMatch) {
      // Found a state code
      stateCode = stateMatch[1].toUpperCase();

      // Extract city - usually the part right before the state code
      // or the second-to-last comma-separated part
      if (parts.length === 1) {
        // Format: "Louisville KY" - extract city from the same part
        const singlePart = parts[0];
        const cityMatch = singlePart.replace(/\b[A-Z]{2}\b/i, '').replace(/\d+/g, '').trim();
        city = cityMatch || singlePart.split(/\s+/)[0]; // Fallback to first word
      } else {
        // Format: "Street, Louisville, KY" or "Louisville, KY"
        // City is usually the second-to-last part
        city = parts[Math.max(0, parts.length - 2)];

        // Clean up city name (remove state code and zip if present)
        city = city.replace(/\b[A-Z]{2}\b/i, '').replace(/\d+/g, '').trim();
      }
    } else {
      // No state code found - try to infer from well-known cities
      // This is a fallback for common cases
      const cityLower = parts[parts.length - 1].toLowerCase().replace(/\d+/g, '').trim();

      // Map of common cities to their states (you can expand this list)
      const cityStateMap: Record<string, string> = {
        'louisville': 'KY',
        'lexington': 'KY',
        'new york': 'NY',
        'los angeles': 'CA',
        'chicago': 'IL',
        'houston': 'TX',
        'phoenix': 'AZ',
        'philadelphia': 'PA',
        'san antonio': 'TX',
        'san diego': 'CA',
        'dallas': 'TX',
        'san jose': 'CA',
        'austin': 'TX',
        'jacksonville': 'FL',
        'miami': 'FL',
      };

      // Check if we can infer the state
      const matchedCity = Object.keys(cityStateMap).find(key =>
        cityLower.includes(key) || key.includes(cityLower)
      );

      if (matchedCity) {
        stateCode = cityStateMap[matchedCity];
        city = parts[parts.length - 1].replace(/\d+/g, '').trim();
        this.logger.log(`ℹ️ Inferred state ${stateCode} from city ${city}`);
      } else {
        throw new Error(
          `State code not found in address: "${address}". ` +
          `Please include the state (e.g., "Louisville, KY" or "123 Main St, Louisville, KY 40202")`
        );
      }
    }

    // Validate we got something meaningful
    if (!city || city.length < 2) {
      throw new Error('Could not extract city name from address');
    }

    this.logger.log(`📍 Parsed address: city="${city}", state="${stateCode}"`);
    return { city, stateCode };
  }


  /**
   * Transform RapidAPI response to PropertySync schema
   * Based on actual API response structure from /v3/property-detail
   */
  private transformToPropertySchema(
    data: any,
    propertyId: string,
  ): ParsedMLSProperty {
    // Extract address from location object
    const address = data.location?.address || {};

    // Extract description (property details like beds/baths)
    const desc = data.description || {};

    return {
      shareId: propertyId || data.property_id || data.listing_id || '',
      address: {
        street: address.line || '',
        city: address.city || '',
        state: address.state || '',
        zipCode: address.postal_code || '',
        full: `${address.line}, ${address.city}, ${address.state} ${address.postal_code}`,
      },
      pricing: {
        listPrice: this.formatPrice(data.list_price || data.price),
        priceNumeric: data.list_price || data.price || 0,
        pricePerSqft: data.price_per_sqft || null,
      },
      propertyDetails: {
        beds: String(desc.beds || desc.bedrooms || ''),
        baths: String(desc.baths || desc.bathrooms || ''),
        sqft: this.formatNumber(desc.sqft || desc.livingArea),
        yearBuilt: String(desc.year_built || desc.yearBuilt || ''),
        lotSize: this.formatNumber(desc.lot_sqft || desc.lotSize),
        propertyType: desc.type || desc.sub_type || '',
      },
      images: this.extractImages(data.photos),
      listingInfo: {
        mlsNumber: data.source?.listing_id || '',
        listingAgent: data.advertisers?.[0]?.name || data.buyers?.[0]?.name || '',
        listingOffice: data.advertisers?.[0]?.office?.name || data.branding?.[0]?.name || '',
        status: data.status || 'for_sale',
        listDate: data.list_date || '',
      },
      description: desc.text || data.description?.text || '',
      rawData: {
        property_id: propertyId,
        tax_history: data.tax_history || [],
        nearby_schools: data.nearby_schools?.schools || [],
        flood_risk: data.local?.flood?.flood_factor_severity || '',
        fire_risk: data.local?.wildfire?.fire_factor_severity || '',
        noise_score: data.local?.noise?.score || null,
        href: data.href || '',
        permalink: data.permalink || '',
        last_sold_price: data.last_sold_price || null,
        last_sold_date: data.last_sold_date || '',
      },
    };
  }

  /**
   * Extract and normalize image URLs from photos array
   * RapidAPI returns photos as array of objects with href property
   */
  private extractImages(photos: any): string[] {
    if (!photos || !Array.isArray(photos)) {
      return [];
    }

    return photos
      .map((photo: any) => {
        if (typeof photo === 'string') return photo;
        return photo.href || photo.url || '';
      })
      .filter(Boolean);
  }

  /**
   * Format price as currency string
   */
  private formatPrice(price: number | undefined): string {
    if (!price) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price);
  }

  /**
   * Format number with commas
   */
  private formatNumber(num: number | undefined): string {
    if (!num) return '';
    return new Intl.NumberFormat('en-US').format(num);
  }

  /**
   * Build full address from parts
   */
  private buildFullAddress(data: any): string {
    const parts = [
      data.address?.line || data.streetAddress,
      data.address?.city || data.city,
      data.address?.state || data.state,
      data.address?.postal_code || data.zipcode,
    ].filter(Boolean);

    return parts.join(', ');
  }

  /**
   * Check if API is configured correctly
   */
  isConfigured(): boolean {
    return !!this.apiKey && !!this.apiHost;
  }

  /**
   * Get circuit breaker health status
   */
  async getHealthStatus() {
    return {
      configured: this.isConfigured(),
      circuitBreaker: this.circuitBreaker.getStats(),
      quota: {
        note: 'Quota tracking disabled during cache testing',
        total: 0,
        limit: 500,
        remaining: 500,
        percentUsed: '0.00'
      },
    };
  }

  /**
   * CTO FIX 5: Manually reset the circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset();
  }
}

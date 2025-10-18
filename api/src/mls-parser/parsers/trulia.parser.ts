import { Injectable, Logger } from '@nestjs/common';
import { Browser, Page } from 'puppeteer';
import { IPropertyParser } from '../interfaces/base-parser.interface';
import { ParsedMLSProperty } from '../interfaces/mls-property.interface';

/**
 * Trulia Parser
 *
 * Extracts property data from Trulia listings.
 * Trulia is owned by Zillow Group and uses similar technology.
 *
 * Supported URL formats:
 * - https://www.trulia.com/p/[state]/[city]/[address]/[property-id]
 * - https://www.trulia.com/p/ca/san-francisco/123-main-st-san-francisco-ca-94102--12345
 *
 * Data Structure: Uses __NEXT_DATA__ script tag (Next.js)
 */
@Injectable()
export class TruliaParser implements IPropertyParser {
  private readonly logger = new Logger(TruliaParser.name);
  private browser: Browser | null = null;
  private lastRequestTime: number = 0;
  private readonly MIN_REQUEST_DELAY = 2000; // 2 seconds between requests

  /**
   * Set the browser instance (injected by MLSParserService)
   */
  setBrowser(browser: Browser | null): void {
    this.browser = browser;
  }

  /**
   * Check if this parser can handle the given URL
   */
  canHandle(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return (
        urlObj.hostname.includes('trulia.com') &&
        (urlObj.pathname.includes('/p/') || urlObj.pathname.includes('/home/'))
      );
    } catch {
      return false;
    }
  }

  /**
   * Get parser name
   */
  getParserName(): string {
    return 'Trulia';
  }

  /**
   * Get confidence score for handling this URL
   */
  getConfidence(url: string): number {
    if (!this.canHandle(url)) {
      return 0.0;
    }

    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);

      // High confidence for /home/ format URLs
      // Format: /home/[address-slug]-[zip]-[property-id]
      if (pathParts.length >= 2 && pathParts[0] === 'home') {
        return 0.95;
      }

      // High confidence for /p/ format URLs
      // Format: /p/[state]/[city]/[address]--[property-id]
      if (
        pathParts.length >= 4 &&
        pathParts[0] === 'p' &&
        pathParts[pathParts.length - 1].includes('--')
      ) {
        return 0.95;
      }

      // Medium confidence for Trulia URLs in general
      return 0.6;
    } catch {
      return 0.0;
    }
  }

  /**
   * Extracts basic property information directly from the URL without scraping.
   * Implements IPropertyParser.extractAddressFromUrl() interface method.
   *
   * @param url - The Trulia property URL
   * @returns Object containing property ID (as shareId) and address details
   * @throws Error if URL format is invalid
   *
   * @example
   * // /home/ format:
   * // URL: https://www.trulia.com/home/4343-pruitt-ct-louisville-ky-40218-73647720
   * // Returns: { shareId: '73647720', address: { street: '4343 Pruitt Ct', city: 'Louisville', state: 'KY', zipCode: '40218', full: '4343 Pruitt Ct, Louisville, KY 40218' } }
   *
   * // /p/ format:
   * // URL: https://www.trulia.com/p/ca/san-francisco/123-main-st-san-francisco-ca-94102--12345678
   * // Returns: { shareId: '12345678', address: { street: '123 Main St', city: 'San Francisco', state: 'CA', zipCode: '94102', full: '123 Main St, San Francisco, CA 94102' } }
   */
  extractAddressFromUrl(url: string) {
    const parsed = this.parseTruliaUrl(url);
    return {
      shareId: parsed.propertyId,
      address: parsed.address,
    };
  }

  /**
   * Parse a Trulia property URL
   */
  async parse(url: string): Promise<ParsedMLSProperty> {
    if (!this.canHandle(url)) {
      throw new Error(
        `TruliaParser cannot handle URL: ${url}. Only Trulia property URLs are supported.`,
      );
    }

    if (!this.browser) {
      throw new Error(
        'Browser not initialized. Cannot parse Trulia URL without browser instance.',
      );
    }

    await this.enforceRateLimit();
    return await this.parseTruliaEnhanced(url);
  }

  /**
   * Enforce rate limiting between requests
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.MIN_REQUEST_DELAY) {
      const delay = this.MIN_REQUEST_DELAY - timeSinceLastRequest;
      this.logger.log(`⏳ Rate limiting: waiting ${delay}ms before request`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Main parsing method with browser automation
   *
   * @param truliaUrl - The Trulia URL to parse
   * @returns Parsed property data
   */
  private async parseTruliaEnhanced(
    truliaUrl: string,
  ): Promise<ParsedMLSProperty> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    // Check browser connection
    try {
      await this.browser.version();
    } catch (error) {
      this.logger.warn('Browser disconnected, need reinitialization');
      throw new Error('Browser disconnected. Please retry.');
    }

    const page = await this.browser.newPage();

    try {
      this.logger.log(`🚀 Starting to parse Trulia URL: ${truliaUrl}`);

      // Configure stealth mode to avoid detection
      await this.configureStealthMode(page);

      this.logger.log(`📡 Navigating to URL...`);
      const response = await page.goto(truliaUrl, {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      const finalUrl = page.url();
      const statusCode = response?.status() || 0;

      this.logger.log(`🔗 Final URL: ${finalUrl}`);
      this.logger.log(`📊 Response status: ${statusCode}`);

      if (statusCode === 403 || statusCode === 429) {
        throw new Error(
          `Trulia blocked the request (HTTP ${statusCode}). This may indicate rate limiting or anti-bot detection. Please wait before retrying.`,
        );
      }

      if (statusCode >= 400) {
        throw new Error(
          `HTTP error ${statusCode} when accessing Trulia URL`,
        );
      }

      this.logger.log(`⏳ Waiting for page to load...`);
      await page.waitForSelector('body', { timeout: 15000 });
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Simulate human behavior
      await this.simulateHumanBehavior(page);

      this.logger.log(`🔍 Extracting property data...`);
      const extractedData = await this.extractPropertyData(page);

      this.logger.log(`📸 Photo extraction results:`, {
        imageCount: extractedData.images?.length || 0,
        hasImages: !!extractedData.images && extractedData.images.length > 0,
        sampleImage: extractedData.images?.[0]
          ? {
              url: extractedData.images[0].url?.substring(0, 80) + '...',
              hasUrl: !!extractedData.images[0].url,
            }
          : null,
      });

      // Debug info logging
      if (extractedData._debugInfo) {
        this.logger.log(`🔍 Data structure debug:`, extractedData._debugInfo);
        delete extractedData._debugInfo;
      }

      // Parse address from URL as fallback
      const urlData = this.parseTruliaUrl(truliaUrl);

      // Merge URL-based address with extracted data
      const mergedAddress = {
        ...urlData.address,
        ...extractedData.address,
      };

      this.logger.log(
        `✅ Data extraction completed. Images found: ${extractedData.images?.length || 0}`,
      );

      return {
        shareId: urlData.propertyId || truliaUrl,
        address: mergedAddress,
        pricing: extractedData.pricing,
        images: extractedData.images || [],
        propertyDetails: extractedData.propertyDetails || {},
        listingInfo: extractedData.listingInfo || {},
        scrapedAt: new Date(),
        sourceUrl: truliaUrl,
      };
    } finally {
      await page.close();
    }
  }

  /**
   * Configure page to avoid bot detection.
   * Sets user agent, viewport, and other stealth settings.
   */
  private async configureStealthMode(page: Page): Promise<void> {
    await page.evaluateOnNewDocument(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Add chrome object
      (window as any).chrome = {
        runtime: {},
        loadTimes: function () {},
        csi: function () {},
      };

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) =>
        parameters.name === 'notifications'
          ? Promise.resolve({
              state: (Notification as any).permission,
            } as PermissionStatus)
          : originalQuery(parameters);

      // Add plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Set languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Platform
      Object.defineProperty(navigator, 'platform', {
        get: () => 'Win32',
      });

      // Hardware
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8,
      });

      // Device Memory
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8,
      });
    });

    // Set realistic user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    );

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Set HTTP headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Upgrade-Insecure-Requests': '1',
      Referer: 'https://www.google.com/',
    });
  }

  /**
   * Simulate human-like scrolling behavior.
   * Helps avoid bot detection.
   */
  private async simulateHumanBehavior(page: Page): Promise<void> {
    try {
      // Scroll down
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Scroll back up
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error: any) {
      this.logger.warn('Error during scroll simulation:', error.message);
    }
  }

  /**
   * Extract property data from page.
   * Trulia uses __NEXT_DATA__ script tag (owned by Zillow).
   */
  private async extractPropertyData(page: Page): Promise<any> {
    return await page.evaluate(() => {
      const getNestedValue = (obj: any, path: string) => {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
      };

      const scriptTag = document.querySelector(
        'script#__NEXT_DATA__[type="application/json"]',
      );

      if (!scriptTag || !scriptTag.textContent) {
        return {
          pricing: null,
          images: [],
          propertyDetails: {},
          listingInfo: {},
          address: {},
          _debugInfo: {
            error: 'No __NEXT_DATA__ script tag found',
            foundScripts: Array.from(document.querySelectorAll('script')).map(
              (s) => s.id || s.src || 'inline',
            ),
          },
        };
      }

      let nextData: any;
      try {
        nextData = JSON.parse(scriptTag.textContent);
      } catch (error) {
        return {
          pricing: null,
          images: [],
          propertyDetails: {},
          listingInfo: {},
          address: {},
          _debugInfo: {
            error: 'Failed to parse __NEXT_DATA__',
            parseError: error instanceof Error ? error.message : String(error),
          },
        };
      }

      // Try to find property data in pageProps
      const pageProps = getNestedValue(nextData, 'props.pageProps');

      if (!pageProps) {
        return {
          pricing: null,
          images: [],
          propertyDetails: {},
          listingInfo: {},
          address: {},
          _debugInfo: {
            error: 'No pageProps found',
            nextDataKeys: Object.keys(nextData),
            propsKeys: nextData.props ? Object.keys(nextData.props) : [],
          },
        };
      }

      // Debug: Log pageProps structure
      const debugInfo = {
        pagePropsKeys: Object.keys(pageProps),
        hasPdpData: !!pageProps.pdpData,
        hasPropertyData: !!pageProps.property,
        hasListingData: !!pageProps.listing,
      };

      // Try to extract from pdpData (Property Detail Page data)
      let propertyData = pageProps.pdpData || pageProps.property || pageProps;

      // Extract pricing
      const pricing = propertyData.price
        ? {
            listPrice: `$${propertyData.price.toLocaleString()}`,
            priceNumeric: propertyData.price,
          }
        : null;

      // Extract images
      const images: any[] = [];
      const photos =
        propertyData.photos || propertyData.images || propertyData.media || [];

      if (Array.isArray(photos)) {
        photos.forEach((photo: any) => {
          const imageUrl = photo.url || photo.href || photo.src;
          if (imageUrl) {
            images.push({
              url: imageUrl,
              alt: photo.caption || photo.description,
              title: photo.caption || photo.description,
            });
          }
        });
      }

      // Extract property details
      const propertyDetails = {
        beds: propertyData.bedrooms?.toString() || propertyData.beds?.toString(),
        baths: propertyData.bathrooms?.toString() || propertyData.baths?.toString(),
        sqft: propertyData.livingArea
          ? `${propertyData.livingArea.toLocaleString()} sqft`
          : propertyData.sqft
            ? `${propertyData.sqft.toLocaleString()} sqft`
            : undefined,
        yearBuilt: propertyData.yearBuilt?.toString(),
        lotSize: propertyData.lotSize
          ? `${propertyData.lotSize.toLocaleString()} sqft`
          : undefined,
        propertyType: propertyData.propertyType || propertyData.type,
      };

      // Extract address
      const address: any = {};
      if (propertyData.address) {
        address.street =
          propertyData.address.streetAddress || propertyData.address.line;
        address.city = propertyData.address.city;
        address.state =
          propertyData.address.state || propertyData.address.stateCode;
        address.zipCode =
          propertyData.address.zipcode || propertyData.address.postalCode;

        const parts = [
          address.street,
          address.city,
          address.state,
          address.zipCode,
        ].filter(Boolean);
        address.full = parts.join(', ');
      }

      // Extract listing info
      const listingInfo = {
        mlsNumber: propertyData.mlsId,
        status: propertyData.status || propertyData.listingStatus,
        listDate: propertyData.listDate,
        listingAgent: propertyData.agent?.name || propertyData.listingAgent,
        listingOffice:
          propertyData.brokerName || propertyData.office?.name,
      };

      return {
        pricing,
        images,
        propertyDetails,
        listingInfo,
        address,
        _debugInfo: debugInfo,
      };
    });
  }

  /**
   * Parse Trulia URL to extract address components and property ID
   *
   * Supports two formats:
   * 1. /p/[state]/[city]/[address]--[property-id] (e.g., /p/ca/san-francisco/123-main-st-san-francisco-ca-94102--12345678)
   * 2. /home/[address-slug]-[zip]-[property-id] (e.g., /home/4343-pruitt-ct-louisville-ky-40218-73647720)
   */
  private parseTruliaUrl(url: string): {
    propertyId: string;
    address: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      full?: string;
    };
  } {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);

      if (pathParts.length < 2) {
        throw new Error('Invalid Trulia URL format');
      }

      // Handle /home/ format URLs
      if (pathParts[0] === 'home') {
        return this.parseHomeFormatUrl(pathParts[1]);
      }

      // Handle /p/ format URLs
      if (pathParts[0] === 'p') {
        return this.parsePFormatUrl(pathParts);
      }

      throw new Error('Unsupported Trulia URL format');
    } catch (error: any) {
      throw new Error(`Failed to parse Trulia URL: ${error.message}`);
    }
  }

  /**
   * Parse /home/ format Trulia URL
   * Format: /home/[address-slug]-[zip]-[property-id]
   * Example: /home/4343-pruitt-ct-louisville-ky-40218-73647720
   */
  private parseHomeFormatUrl(urlPart: string): {
    propertyId: string;
    address: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      full?: string;
    };
  } {
    // Split by dashes
    const parts = urlPart.split('-');

    // Property ID is the last part (all numeric)
    const propertyId = parts[parts.length - 1];

    // ZIP code is second to last (5 digits)
    const zipCode = parts[parts.length - 2];

    // State abbreviation is third from last (2 letters)
    const state = parts[parts.length - 3];

    // Everything before the state is the address and city
    const addressAndCity = parts.slice(0, parts.length - 3);

    // Try to separate city from street address
    // Typically formatted as: [street-parts]-[city-parts]
    // For "4343-pruitt-ct-louisville", street would be "4343 pruitt ct" and city is "louisville"
    let street = '';
    let city = '';

    if (addressAndCity.length > 0) {
      // Last 1-2 parts are usually the city
      city = addressAndCity[addressAndCity.length - 1];

      // Rest is the street address
      street = addressAndCity
        .slice(0, -1)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      city = city.charAt(0).toUpperCase() + city.slice(1);
    }

    const fullAddress = `${street}, ${city}, ${state.toUpperCase()} ${zipCode}`;

    return {
      propertyId,
      address: {
        street,
        city,
        state: state.toUpperCase(),
        zipCode,
        full: fullAddress,
      },
    };
  }

  /**
   * Parse /p/ format Trulia URL
   * Format: /p/[state]/[city]/[address-slug]--[property-id]
   * Example: /p/ca/san-francisco/123-main-st-san-francisco-ca-94102--12345678
   *
   * Note: The address slug often contains redundant city/state/zip at the end.
   * We need to extract the zipCode and remove duplicates to get clean street address.
   */
  private parsePFormatUrl(pathParts: string[]): {
    propertyId: string;
    address: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      full?: string;
    };
  } {
    if (pathParts.length < 4) {
      throw new Error('Invalid /p/ format Trulia URL');
    }

    const state = pathParts[1];
    const city = pathParts[2];
    const addressPart = pathParts[3];

    // Extract property ID (after --)
    const propertyId = addressPart.includes('--')
      ? addressPart.split('--')[1]
      : '';

    // Extract address from slug (before --)
    const addressSlug = addressPart.includes('--')
      ? addressPart.split('--')[0]
      : addressPart;

    // Split slug into parts
    const slugParts = addressSlug.split('-');

    // Extract zipCode (last part if it's 5 digits)
    let zipCode = '';
    let addressParts = slugParts;

    if (slugParts.length > 0) {
      const lastPart = slugParts[slugParts.length - 1];
      if (/^\d{5}$/.test(lastPart)) {
        zipCode = lastPart;
        addressParts = slugParts.slice(0, -1); // Remove zipCode
      }
    }

    // Remove state if it's at the end (after zipCode is removed)
    if (addressParts.length > 0 && addressParts[addressParts.length - 1].toLowerCase() === state.toLowerCase()) {
      addressParts = addressParts.slice(0, -1);
    }

    // Remove city if it appears at the end (handle multi-word cities)
    const cityParts = city.split('-');
    let foundCity = true;
    for (let i = cityParts.length - 1; i >= 0; i--) {
      const expectedIndex = addressParts.length - (cityParts.length - i);
      if (expectedIndex < 0 || addressParts[expectedIndex].toLowerCase() !== cityParts[i].toLowerCase()) {
        foundCity = false;
        break;
      }
    }
    if (foundCity) {
      addressParts = addressParts.slice(0, addressParts.length - cityParts.length);
    }

    // What's left is the street address
    const street = addressParts
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const cityName = city
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const fullAddress = zipCode
      ? `${street}, ${cityName}, ${state.toUpperCase()} ${zipCode}`
      : `${street}, ${cityName}, ${state.toUpperCase()}`;

    return {
      propertyId,
      address: {
        street,
        city: cityName,
        state: state.toUpperCase(),
        zipCode: zipCode || undefined,
        full: fullAddress,
      },
    };
  }
}

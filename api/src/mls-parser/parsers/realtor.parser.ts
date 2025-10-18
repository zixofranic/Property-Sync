import { Injectable, Logger } from '@nestjs/common';
import { Browser, Page } from 'puppeteer';
import { IPropertyParser } from '../interfaces/base-parser.interface';
import {
  ParsedMLSProperty,
  ImageData,
  PriceData,
} from '../interfaces/mls-property.interface';

/**
 * Realtor.com-specific property parser.
 * Handles parsing of Realtor.com property URLs (https://www.realtor.com/realestateandhomes-detail/*).
 *
 * This parser extracts property data from Realtor.com listing pages using Puppeteer.
 * Realtor.com uses Next.js and stores property data in the __NEXT_DATA__ JSON structure.
 *
 * Data Structure: The property data is located at json.props.pageProps in the __NEXT_DATA__ script tag.
 *
 * Note: Realtor.com has anti-scraping measures. This parser implements best practices
 * including rate limiting, proper user agents, and respectful crawling behavior as outlined
 * in SCRAPING_GUIDELINES.md.
 *
 * @see https://www.realtor.com/robots.txt
 * @see https://scrapfly.io/blog/posts/how-to-scrape-realtorcom - Research reference
 */
@Injectable()
export class RealtorParser implements IPropertyParser {
  private readonly logger = new Logger(RealtorParser.name);

  /**
   * Browser instance for web scraping.
   * Injected from the main MLS parser service.
   */
  private browser: Browser | null = null;

  /**
   * Last request timestamp for rate limiting
   */
  private lastRequestTime: number = 0;

  /**
   * Minimum delay between requests (2 seconds as per SCRAPING_GUIDELINES.md)
   */
  private readonly MIN_REQUEST_DELAY = 2000;

  /**
   * Sets the browser instance to use for parsing.
   * This is called by the main service to share the browser instance.
   *
   * @param browser - The Puppeteer browser instance
   */
  setBrowser(browser: Browser | null): void {
    this.browser = browser;
  }

  /**
   * Check if this parser can handle the given URL.
   * Supports:
   * - https://www.realtor.com/realestateandhomes-detail/*
   * - https://www.realtor.com/realestateandhomes-search/*
   *
   * @param url - The URL to check
   * @returns true if this parser can handle the URL
   */
  canHandle(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return (
        urlObj.hostname.includes('realtor.com') &&
        (urlObj.pathname.includes('/realestateandhomes-detail/') ||
          urlObj.pathname.includes('/realestateandhomes-search/'))
      );
    } catch {
      return false;
    }
  }

  /**
   * @inheritdoc
   */
  getParserName(): string {
    return 'Realtor.com';
  }

  /**
   * Get confidence score for parsing this URL.
   * Higher confidence for detail pages, lower for search pages.
   *
   * @param url - The URL to evaluate
   * @returns Confidence score between 0.0 and 1.0
   */
  getConfidence(url: string): number {
    if (!this.canHandle(url)) {
      return 0.0;
    }

    try {
      const urlObj = new URL(url);

      // Higher confidence for detail pages
      if (urlObj.pathname.includes('/realestateandhomes-detail/')) {
        return 0.95;
      }

      // Lower confidence for search pages
      if (urlObj.pathname.includes('/realestateandhomes-search/')) {
        return 0.5;
      }

      return 0.6;
    } catch {
      return 0.0;
    }
  }

  /**
   * Extracts basic property information directly from the URL without scraping.
   * Implements IPropertyParser.extractAddressFromUrl() interface method.
   *
   * @param url - The Realtor.com property URL
   * @returns Object containing property ID (as shareId) and address details
   * @throws Error if URL format is invalid
   *
   * @example
   * // URL: https://www.realtor.com/realestateandhomes-detail/2508-Boulevard-Napoleon_Louisville_KY_40205_M33538-25699
   * // Returns: { shareId: 'M33538-25699', address: { street: '2508 Boulevard Napoleon', city: 'Louisville', state: 'KY', zipCode: '40205', full: '2508 Boulevard Napoleon, Louisville, KY 40205' } }
   */
  extractAddressFromUrl(url: string) {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter((p) => p);

      if (
        pathParts.length < 2 ||
        pathParts[0] !== 'realestateandhomes-detail'
      ) {
        throw new Error('Invalid Realtor.com URL format');
      }

      // Extract address slug (e.g., "2508-Boulevard-Napoleon_Louisville_KY_40205_M33538-25699")
      const addressSlug = pathParts[1];
      const parts = addressSlug.split('_');

      if (parts.length < 4) {
        throw new Error('Invalid Realtor.com address slug format');
      }

      // Parse: [street-with-dashes]_[city]_[state]_[zipCode]_[propertyId]
      const streetPart = parts[0];
      const city = parts[1].replace(/-/g, ' '); // City might have dashes for multi-word names
      const state = parts[2];
      const zipCode = parts[3];

      // Property ID is optional (might be in parts[4] or combined with zipCode)
      let shareId = '';
      if (parts.length >= 5) {
        shareId = parts[4];
      } else {
        // Sometimes the property ID is combined with zipCode like "40205_M33538-25699"
        const zipParts = zipCode.split('_');
        if (zipParts.length > 1) {
          shareId = zipParts[1];
        }
      }

      const streetAddress = streetPart.replace(/-/g, ' ');
      const fullAddress = `${streetAddress}, ${city}, ${state} ${zipCode}`;

      return {
        shareId: shareId || zipCode, // Fallback to zipCode if no property ID found
        address: {
          street: streetAddress,
          city,
          state,
          zipCode,
          full: fullAddress,
        },
      };
    } catch (error) {
      throw new Error(`Failed to parse Realtor.com URL: ${error.message}`);
    }
  }

  /**
   * Parse a Realtor.com URL and extract property data.
   *
   * @param url - The Realtor.com URL to parse
   * @returns Parsed property data
   * @throws Error if URL cannot be parsed or browser is not initialized
   */
  async parse(url: string): Promise<ParsedMLSProperty> {
    if (!this.canHandle(url)) {
      throw new Error(
        `RealtorParser cannot handle URL: ${url}. Only Realtor.com property URLs are supported.`,
      );
    }

    if (!this.browser) {
      throw new Error(
        'Browser not initialized. Cannot parse Realtor.com URL without browser instance.',
      );
    }

    await this.enforceRateLimit();
    return await this.parseRealtorEnhanced(url);
  }

  /**
   * Enforce rate limiting between requests.
   * Waits MIN_REQUEST_DELAY milliseconds since last request.
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
   * Enhanced parser for Realtor.com properties.
   * Uses Puppeteer to load the page and extract data from __INITIAL_STATE__.
   *
   * @param realtorUrl - The Realtor.com URL to parse
   * @returns Parsed property data
   */
  private async parseRealtorEnhanced(
    realtorUrl: string,
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
      this.logger.log(`🚀 Starting to parse Realtor.com URL: ${realtorUrl}`);

      // Configure stealth mode to avoid detection
      await this.configureStealthMode(page);

      // Random delay to avoid pattern detection (2-5 seconds)
      const randomDelay = 2000 + Math.random() * 3000;
      this.logger.log(`⏳ Waiting ${Math.round(randomDelay)}ms before navigation (anti-bot)`);
      await new Promise((resolve) => setTimeout(resolve, randomDelay));

      this.logger.log(`📡 Navigating to URL...`);
      const response = await page.goto(realtorUrl, {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      const finalUrl = page.url();
      const statusCode = response?.status() || 0;

      this.logger.log(`🔗 Final URL: ${finalUrl}`);
      this.logger.log(`📊 Response status: ${statusCode}`);

      if (statusCode === 403 || statusCode === 429) {
        throw new Error(
          `Realtor.com blocked the request (HTTP ${statusCode}). This may indicate rate limiting or anti-bot detection. Please wait before retrying.`,
        );
      }

      if (statusCode >= 400) {
        throw new Error(
          `HTTP error ${statusCode} when accessing Realtor.com URL`,
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

      // Parse address from URL as fallback
      const urlData = this.parseRealtorUrl(realtorUrl);

      // Merge URL-based address with extracted data
      const mergedAddress = {
        ...urlData.address,
        ...extractedData.address,
      };

      this.logger.log(
        `✅ Data extraction completed. Images found: ${extractedData.images?.length || 0}`,
      );

      return {
        shareId: urlData.propertyId || realtorUrl,
        address: mergedAddress,
        pricing: extractedData.pricing,
        images: extractedData.images || [],
        propertyDetails: extractedData.propertyDetails || {},
        listingInfo: extractedData.listingInfo || {},
        scrapedAt: new Date(),
        sourceUrl: realtorUrl,
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

      // Add chrome object with more properties
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

      // Add more realistic plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Set languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Override platform
      Object.defineProperty(navigator, 'platform', {
        get: () => 'Win32',
      });

      // Add hardware concurrency
      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8,
      });

      // Add device memory
      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8,
      });
    });

    // Set realistic and current user agent (Chrome 131)
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    );

    // Set viewport with random variation
    const width = 1920 + Math.floor(Math.random() * 100);
    const height = 1080 + Math.floor(Math.random() * 100);
    await page.setViewport({ width, height });

    // Set HTTP headers with Referer
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'max-age=0',
      'Sec-Ch-Ua':
        '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
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
   * Extract property data from the Realtor.com page.
   * Looks for __NEXT_DATA__ script tag and extracts property information.
   *
   * Based on research from https://scrapfly.io/blog/posts/how-to-scrape-realtorcom
   * Data structure: __NEXT_DATA__ → props.pageProps
   *
   * TODO: Complete implementation after inspecting actual Realtor.com page structure.
   * This is a foundation that needs refinement based on real data.
   */
  private async extractPropertyData(page: Page): Promise<any> {
    return await page.evaluate(() => {
      // Helper function to safely get nested values
      const getNestedValue = (obj: any, path: string): any => {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
      };

      // Try to find __NEXT_DATA__ script tag
      const scriptTag = document.querySelector(
        'script#__NEXT_DATA__[type="application/json"]',
      );

      if (!scriptTag || !scriptTag.textContent) {
        // Fallback: try to find other script tags with JSON data
        return {
          pricing: null,
          images: [],
          propertyDetails: {},
          listingInfo: {},
          address: {},
          _debugInfo: {
            error: '__NEXT_DATA__ script tag not found',
            availableScripts: Array.from(document.querySelectorAll('script')).map(
              (s: any) => ({
                id: s.id,
                type: s.type,
                hasContent: !!s.textContent,
              }),
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
            error: 'Failed to parse __NEXT_DATA__ JSON',
            rawLength: scriptTag.textContent?.length || 0,
          },
        };
      }

      // Extract pageProps - main data container
      const pageProps = getNestedValue(nextData, 'props.pageProps');

      if (!pageProps) {
        return {
          pricing: null,
          images: [],
          propertyDetails: {},
          listingInfo: {},
          address: {},
          _debugInfo: {
            error: 'props.pageProps not found in __NEXT_DATA__',
            availableKeys: Object.keys(nextData || {}),
            propsKeys: Object.keys(nextData?.props || {}),
          },
        };
      }

      // TODO: Extract property data from pageProps
      // The exact structure needs to be determined by inspecting real Realtor.com pages
      // Common patterns to look for:
      // - pageProps.property or pageProps.propertyData
      // - pageProps.listing or pageProps.listingData
      // - Price info, photos array, beds/baths, square footage

      return {
        pricing: null, // TODO: Extract from pageProps structure
        images: [], // TODO: Extract photos array
        propertyDetails: {}, // TODO: Extract beds, baths, sqft, etc.
        listingInfo: {}, // TODO: Extract MLS number, agent info, status
        address: {}, // TODO: Extract address components
        _debugInfo: {
          success: true,
          pagePropsKeys: Object.keys(pageProps),
          hasPropertyData: !!pageProps.property,
          hasListingData: !!pageProps.listing,
        },
      };
    });
  }

  /**
   * Parse Realtor.com URL to extract property ID and address.
   *
   * Example URL:
   * https://www.realtor.com/realestateandhomes-detail/123-Main-St_City_ST_12345_M12345-67890
   *
   * @param url - Realtor.com URL
   * @returns Parsed URL data with property ID and address
   */
  private parseRealtorUrl(url: string): {
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

      // Example: realestateandhomes-detail/123-Main-St_City_ST_12345_M12345-67890
      if (
        pathParts.length >= 2 &&
        pathParts[0] === 'realestateandhomes-detail'
      ) {
        const slugPart = pathParts[1];
        const parts = slugPart.split('_');

        // Extract property ID (usually last part starting with M)
        const propertyId = parts.find((p) => p.startsWith('M')) || slugPart;

        // Try to extract address components
        let street: string | undefined;
        let city: string | undefined;
        let state: string | undefined;
        let zipCode: string | undefined;

        // Pattern: Street_City_ST_Zip_PropertyID
        if (parts.length >= 4) {
          street = parts[0]?.replace(/-/g, ' ');
          city = parts[1]?.replace(/-/g, ' ');
          state = parts[2];
          zipCode = parts[3];
        }

        const fullAddress = [street, city, state, zipCode]
          .filter(Boolean)
          .join(', ');

        return {
          propertyId,
          address: {
            street,
            city,
            state,
            zipCode,
            full: fullAddress || 'Parsing property address...',
          },
        };
      }

      // Fallback for unrecognized URL patterns
      return {
        propertyId: url,
        address: {
          full: 'Parsing property address...',
        },
      };
    } catch (error: any) {
      throw new Error(`Failed to parse Realtor.com URL: ${error.message}`);
    }
  }
}

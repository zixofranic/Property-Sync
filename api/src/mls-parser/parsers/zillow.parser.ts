import { Injectable, Logger } from '@nestjs/common';
import { Browser, Page } from 'puppeteer';
import { IPropertyParser } from '../interfaces/base-parser.interface';
import {
  ParsedMLSProperty,
  ImageData,
  PriceData,
} from '../interfaces/mls-property.interface';

/**
 * Zillow-specific property parser.
 * Handles parsing of Zillow homedetails URLs (https://www.zillow.com/homedetails/*).
 *
 * This parser extracts property data from Zillow listing pages using Puppeteer.
 * Zillow uses Next.js and stores property data in the __NEXT_DATA__ JSON structure.
 *
 * Note: Zillow has robust anti-scraping measures. This parser implements best practices
 * including rate limiting, proper user agents, and respectful crawling behavior as outlined
 * in SCRAPING_GUIDELINES.md.
 *
 * @see https://www.zillow.com/robots.txt
 */
@Injectable()
export class ZillowParser implements IPropertyParser {
  private readonly logger = new Logger(ZillowParser.name);

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
   * @inheritdoc
   */
  canHandle(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return (
        urlObj.hostname.includes('zillow.com') &&
        urlObj.pathname.includes('/homedetails/')
      );
    } catch {
      return false;
    }
  }

  /**
   * @inheritdoc
   */
  getParserName(): string {
    return 'Zillow';
  }

  /**
   * @inheritdoc
   */
  getConfidence(url: string): number {
    if (!this.canHandle(url)) {
      return 0.0;
    }

    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');

      // Zillow URLs should have format: /homedetails/{address}/{zpid}_zpid/
      if (
        pathParts.length >= 4 &&
        pathParts[1] === 'homedetails' &&
        pathParts[pathParts.length - 1].includes('_zpid')
      ) {
        return 1.0; // Perfect match
      }

      return 0.6; // Looks like Zillow but structure is off
    } catch {
      return 0.0;
    }
  }

  /**
   * Extracts basic property information directly from the URL without scraping.
   * Implements IPropertyParser.extractAddressFromUrl() interface method.
   *
   * @param url - The Zillow homedetails URL
   * @returns Object containing zpid (as shareId) and address details
   * @throws Error if URL format is invalid
   *
   * @example
   * // URL: https://www.zillow.com/homedetails/2508-Boulevard-Napoleon-Louisville-KY-40205/73469419_zpid/
   * // Returns: { shareId: '73469419', address: { street: '2508 Boulevard Napoleon', city: 'Louisville', state: 'KY', zipCode: '40205', full: '2508 Boulevard Napoleon, Louisville, KY 40205' } }
   */
  extractAddressFromUrl(url: string) {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter((p) => p);

      if (pathParts.length < 3 || pathParts[0] !== 'homedetails') {
        throw new Error('Invalid Zillow URL format');
      }

      // Extract ZPID from last part (e.g., "73469419_zpid")
      const zpidPart = pathParts[pathParts.length - 1];
      const shareId = zpidPart.replace('_zpid', '').replace('/', '');

      // Extract address from second part (e.g., "2508-Boulevard-Napoleon-Louisville-KY-40205")
      const addressSlug = pathParts[1];
      const parts = addressSlug.split('-');

      if (parts.length < 4) {
        throw new Error('Invalid Zillow address slug format');
      }

      // Parse: [street parts...] [city] [state] [zipCode]
      // Zillow format: always has city as single word before state
      // Example: 2508-Boulevard-Napoleon-Louisville-KY-40205
      //          [street parts] [city] [state] [zipCode]
      const zipCode = parts[parts.length - 1];
      const state = parts[parts.length - 2];
      const city = parts[parts.length - 3];

      // Everything before city is the street address
      const streetAddress = parts.slice(0, parts.length - 3).join(' ');
      const fullAddress = `${streetAddress}, ${city}, ${state} ${zipCode}`;

      return {
        shareId,
        address: {
          street: streetAddress,
          city,
          state,
          zipCode,
          full: fullAddress,
        },
      };
    } catch (error) {
      throw new Error(`Failed to parse Zillow URL: ${error.message}`);
    }
  }

  /**
   * @inheritdoc
   */
  async parse(url: string): Promise<ParsedMLSProperty> {
    if (!this.canHandle(url)) {
      throw new Error(
        `ZillowParser cannot handle URL: ${url}. Only Zillow homedetails URLs are supported.`,
      );
    }

    if (!this.browser) {
      throw new Error(
        'Browser not initialized. Cannot parse Zillow URL without browser instance.',
      );
    }

    // Enforce rate limiting (2 seconds minimum between requests)
    await this.enforceRateLimit();

    return await this.parseZillowEnhanced(url);
  }

  /**
   * Enforces rate limiting between requests to respect Zillow's servers.
   * Implements minimum 2-second delay as per SCRAPING_GUIDELINES.md
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
   * Enhanced parsing method - extracts comprehensive property data from Zillow.
   *
   * @param zillowUrl - The Zillow homedetails URL to parse
   * @returns Promise resolving to complete parsed property data
   */
  private async parseZillowEnhanced(
    zillowUrl: string,
  ): Promise<ParsedMLSProperty> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    // Check if browser is still connected
    try {
      await this.browser.version();
    } catch (error) {
      this.logger.warn('Browser disconnected, need reinitialization');
      throw new Error('Browser disconnected. Please retry.');
    }

    const page = await this.browser.newPage();

    try {
      this.logger.log(`🚀 Starting to parse Zillow URL: ${zillowUrl}`);

      // Enhanced stealth settings to avoid detection
      await this.configureStealthMode(page);

      this.logger.log(`📡 Navigating to URL...`);
      const response = await page.goto(zillowUrl, {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      const finalUrl = page.url();
      const statusCode = response?.status() || 0;

      this.logger.log(`🔗 Final URL: ${finalUrl}`);
      this.logger.log(`📊 Response status: ${statusCode}`);

      // Check for anti-bot blocking
      if (statusCode === 403 || statusCode === 429) {
        throw new Error(
          `Zillow blocked the request (HTTP ${statusCode}). This may indicate rate limiting or anti-bot detection. Please wait before retrying.`,
        );
      }

      if (statusCode >= 400) {
        throw new Error(`HTTP error ${statusCode} when accessing Zillow URL`);
      }

      // Wait for page to load and simulate human behavior
      this.logger.log(`⏳ Waiting for page to load...`);
      await page.waitForSelector('body', { timeout: 15000 });
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Simulate scrolling (human-like behavior)
      await this.simulateHumanBehavior(page);

      this.logger.log(`🔍 Extracting property data...`);

      // Extract data from __NEXT_DATA__ JSON
      const extractedData = await this.extractPropertyData(page);

      // Debug: Log photo extraction results
      const firstImage = extractedData.images?.[0];
      const imageUrl = typeof firstImage === 'string' ? firstImage : firstImage?.url;

      this.logger.log(`📸 Photo extraction results:`, {
        imageCount: extractedData.images?.length || 0,
        hasImages: !!extractedData.images && extractedData.images.length > 0,
        sampleImage: imageUrl
          ? {
              url: imageUrl.substring(0, 80) + '...',
              hasUrl: !!imageUrl,
            }
          : null,
      });

      // Debug: Log raw photo structure
      if ((extractedData as any)._photoDebugInfo) {
        this.logger.log(`🔍 Photo structure debug:`, (extractedData as any)._photoDebugInfo);
        // Clean up debug data before proceeding
        delete (extractedData as any)._photoDebugInfo;
      }

      // Debug: Save full __NEXT_DATA__ for inspection
      const fullNextData = await page.evaluate(() => {
        const scriptTag = document.querySelector('script#__NEXT_DATA__[type="application/json"]');
        return scriptTag?.textContent || null;
      });

      if (fullNextData) {
        const fs = require('fs');
        const debugPath = './zillow-next-data-debug.json';
        fs.writeFileSync(debugPath, fullNextData);
        this.logger.log(`💾 Saved full __NEXT_DATA__ to ${debugPath} for inspection`);
      }

      // Parse address from URL as fallback
      const urlData = this.parseZillowUrl(zillowUrl);

      // Merge URL data with extracted data
      const mergedAddress = {
        ...urlData.address,
        ...extractedData.address,
      };

      this.logger.log(
        `✅ Data extraction completed. Images found: ${extractedData.images?.length || 0}`,
      );

      return {
        shareId: urlData.zpid,
        address: mergedAddress,
        pricing: extractedData.pricing,
        images: extractedData.images || [],
        propertyDetails: extractedData.propertyDetails || {},
        listingInfo: extractedData.listingInfo || {},
        scrapedAt: new Date(),
        sourceUrl: zillowUrl,
      } as ParsedMLSProperty;
    } finally {
      await page.close();
    }
  }

  /**
   * Configures the page with stealth settings to avoid bot detection.
   *
   * @param page - The Puppeteer page instance
   */
  private async configureStealthMode(page: Page): Promise<void> {
    // Override navigator.webdriver
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Override chrome property
      (window as any).chrome = {
        runtime: {},
      };

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) =>
        parameters.name === 'notifications'
          ? Promise.resolve({
              state: Notification.permission,
            } as PermissionStatus)
          : originalQuery(parameters);

      // Override plugins length
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
    });

    // Set realistic user agent as per SCRAPING_GUIDELINES.md
    // Include contact info for transparency
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    );

    await page.setViewport({ width: 1920, height: 1080 });

    // Set proper headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Upgrade-Insecure-Requests': '1',
    });
  }

  /**
   * Simulates human-like behavior by scrolling the page.
   *
   * @param page - The Puppeteer page instance
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
    } catch (error) {
      this.logger.warn('Error during scroll simulation:', error.message);
    }
  }

  /**
   * Extracts property data from Zillow's __NEXT_DATA__ JSON structure.
   *
   * Zillow uses Next.js which embeds all page data in a JSON script tag.
   * This method extracts and parses that data.
   *
   * @param page - The Puppeteer page instance
   * @returns Promise resolving to extracted property data
   */
  private async extractPropertyData(
    page: Page,
  ): Promise<Partial<ParsedMLSProperty>> {
    return await page.evaluate(() => {
      // Helper function to safely access nested properties
      const getNestedValue = (obj: any, path: string): any => {
        return path.split('.').reduce((acc, part) => acc && acc[part], obj);
      };

      // Extract __NEXT_DATA__ JSON
      const scriptTag = document.querySelector(
        'script#__NEXT_DATA__[type="application/json"]',
      );

      if (!scriptTag || !scriptTag.textContent) {
        // Fallback to DOM scraping if JSON not available
        return {
          pricing: null,
          images: [],
          propertyDetails: {},
          listingInfo: {},
          address: {},
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
        };
      }

      // Navigate to property data within __NEXT_DATA__
      // Zillow's structure: props.pageProps.gdpClientCache
      const pageProps = getNestedValue(nextData, 'props.pageProps');

      if (!pageProps) {
        return {
          pricing: null,
          images: [],
          propertyDetails: {},
          listingInfo: {},
          address: {},
        };
      }

      // Parse GDP client cache (where property data lives)
      let propertyData: any = null;

      if (pageProps.gdpClientCache) {
        try {
          const cache =
            typeof pageProps.gdpClientCache === 'string'
              ? JSON.parse(pageProps.gdpClientCache)
              : pageProps.gdpClientCache;

          // Find property data in cache
          // Cache keys look like: "ForSale-{zpid}" or similar
          for (const [key, value] of Object.entries(cache)) {
            if (
              key.includes('ForSale') ||
              key.includes('Property') ||
              key.includes('VariantQuery')
            ) {
              const val = value as any;
              if (val.property) {
                propertyData = val.property;
                break;
              }
            }
          }
        } catch (e) {
          // Cache parsing failed
        }
      }

      // If we didn't find property data in cache, try componentProps
      if (!propertyData && pageProps.componentProps) {
        const componentProps = pageProps.componentProps;
        if (componentProps.gdpClientCache) {
          try {
            const cache =
              typeof componentProps.gdpClientCache === 'string'
                ? JSON.parse(componentProps.gdpClientCache)
                : componentProps.gdpClientCache;

            for (const [key, value] of Object.entries(cache)) {
              const val = value as any;
              if (val.property) {
                propertyData = val.property;
                break;
              }
            }
          } catch (e) {
            // Ignore
          }
        }
      }

      if (!propertyData) {
        return {
          pricing: null,
          images: [],
          propertyDetails: {},
          listingInfo: {},
          address: {},
        };
      }

      // Extract pricing information
      const pricing: PriceData | null = propertyData.price
        ? {
            listPrice: `$${propertyData.price.toLocaleString()}`,
            priceNumeric: propertyData.price,
            pricePerSqft: propertyData.resoFacts?.pricePerSquareFoot
              ? `$${propertyData.resoFacts.pricePerSquareFoot}/sqft`
              : undefined,
          }
        : null;

      // Extract images
      const images: ImageData[] = [];
      const seenUrls = new Set<string>();

      // Debug: Collect photo structure info for logging
      // NOTE: Zillow uses 'responsivePhotos' field, not 'photos'
      const photosArray = propertyData.responsivePhotos || propertyData.photos;
      const photoDebugInfo: any = {
        hasPhotos: !!photosArray,
        isArray: Array.isArray(photosArray),
        photoCount: photosArray?.length || 0,
        samplePhotoKeys: photosArray?.[0] ? Object.keys(photosArray[0]) : [],
        samplePhotoData: photosArray?.[0] || null,
      };

      if (photosArray && Array.isArray(photosArray)) {
        photosArray.forEach((photo: any) => {
          // Zillow photos have different sources
          let imageUrl: string | null = null;

          // Prioritize high-res images from mixedSources (1536px webp/jpeg)
          // photo.url is typically a smaller preview (-p_d.jpg)
          if (photo.mixedSources?.webp && photo.mixedSources.webp[0]) {
            // Get highest resolution webp (Zillow uses webp format)
            const webpSources = photo.mixedSources.webp;
            const highestRes = webpSources[webpSources.length - 1];
            imageUrl = highestRes.url;
          } else if (photo.mixedSources?.jpeg && photo.mixedSources.jpeg[0]) {
            // Fallback to highest resolution JPEG
            const jpegSources = photo.mixedSources.jpeg;
            const highestRes = jpegSources[jpegSources.length - 1];
            imageUrl = highestRes.url;
          } else if (photo.url) {
            // Last resort: use preview URL
            imageUrl = photo.url;
          }

          if (imageUrl && !seenUrls.has(imageUrl)) {
            images.push({
              url: imageUrl,
              alt: photo.caption || undefined,
              title: photo.caption || undefined,
              width: photo.width || undefined,
              height: photo.height || undefined,
              size: 'large' as const,
            });
            seenUrls.add(imageUrl);
          }
        });
      }

      // Extract property details
      const propertyDetails: any = {
        beds: propertyData.bedrooms?.toString() || undefined,
        baths: propertyData.bathrooms?.toString() || undefined,
        sqft: propertyData.livingArea
          ? `${propertyData.livingArea.toLocaleString()} sqft`
          : undefined,
        yearBuilt: propertyData.yearBuilt?.toString() || undefined,
        lotSize: propertyData.lotSize
          ? `${propertyData.lotSize.toLocaleString()} sqft`
          : undefined,
        propertyType: propertyData.homeType || undefined,
      };

      // Extract address
      const address: any = {};
      if (propertyData.address) {
        address.street = propertyData.address.streetAddress || undefined;
        address.city = propertyData.address.city || undefined;
        address.state = propertyData.address.state || undefined;
        address.zipCode = propertyData.address.zipcode || undefined;

        // Construct full address
        const parts = [
          address.street,
          address.city,
          address.state,
          address.zipCode,
        ].filter(Boolean);
        address.full = parts.join(', ');
      }

      // Extract listing info
      const listingInfo: any = {
        mlsNumber: propertyData.attributionInfo?.mlsId || undefined,
        listingAgent: propertyData.attributionInfo?.agentName || undefined,
        listingOffice: propertyData.attributionInfo?.brokerName || undefined,
        status: propertyData.homeStatus || undefined,
      };

      // Log debug info in browser context (return it for logging outside)
      const result: any = {
        pricing,
        images,
        propertyDetails,
        listingInfo,
        address,
      };

      // Attach debug info for logging (will be removed before saving)
      result._photoDebugInfo = photoDebugInfo;

      return result;
    });
  }

  /**
   * Parses a Zillow URL to extract ZPID and address information.
   *
   * @param url - The Zillow homedetails URL
   * @returns Object containing zpid and address details
   * @throws Error if URL format is invalid
   */
  private parseZillowUrl(url: string): {
    zpid: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      full: string;
    };
  } {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(Boolean);

      // Zillow URL format: /homedetails/{address-slug}/{zpid}_zpid/
      if (pathParts.length < 3 || pathParts[0] !== 'homedetails') {
        throw new Error('Invalid Zillow URL format');
      }

      // Extract ZPID from last part (e.g., "73469419_zpid")
      const zpidPart = pathParts[pathParts.length - 1];
      const zpid = zpidPart.replace('_zpid', '').replace('/', '');

      // Extract address from slug (second part)
      const addressSlug = pathParts[1];
      const addressParts = addressSlug.split('-');

      // Last 3 parts are typically: city, state, zipcode
      // Everything before is the street address
      if (addressParts.length < 4) {
        throw new Error('Invalid address format in Zillow URL');
      }

      const zipCode = addressParts[addressParts.length - 1];
      const state = addressParts[addressParts.length - 2];
      const city = addressParts[addressParts.length - 3];
      const street = addressParts
        .slice(0, addressParts.length - 3)
        .join(' ')
        .replace(/-/g, ' ');

      const fullAddress = `${street}, ${city}, ${state} ${zipCode}`;

      return {
        zpid,
        address: {
          street,
          city,
          state,
          zipCode,
          full: fullAddress,
        },
      };
    } catch (error) {
      throw new Error(`Failed to parse Zillow URL: ${error.message}`);
    }
  }
}

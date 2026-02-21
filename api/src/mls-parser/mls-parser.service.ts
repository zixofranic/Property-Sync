import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import puppeteer, { Browser } from 'puppeteer';
import {
  ParsedMLSProperty,
  ParseResult,
} from './interfaces/mls-property.interface';
import { ParserFactoryService } from './parser-factory.service';
import { FlexmlsParser } from './parsers/flexmls.parser';
import { ZillowParser } from './parsers/zillow.parser';
import { RealtorParser } from './parsers/realtor.parser';
import { TruliaParser } from './parsers/trulia.parser';

/**
 * Main MLS Parser Service
 *
 * This service orchestrates property parsing from multiple listing sites.
 * It manages the browser instance and delegates actual parsing to site-specific parsers.
 *
 * Architecture:
 * - Maintains a shared Puppeteer browser instance
 * - Uses ParserFactoryService to route URLs to appropriate parsers
 * - Provides backward compatibility with existing FlexMLS-only implementation
 * - Handles browser lifecycle and error recovery
 */
@Injectable()
export class MLSParserService {
  private readonly logger = new Logger(MLSParserService.name);
  private browser: Browser | null = null;

  constructor(
    private prisma: PrismaService,
    private parserFactory: ParserFactoryService,
    private flexmlsParser: FlexmlsParser,
    private zillowParser: ZillowParser,
    private realtorParser: RealtorParser,
    private truliaParser: TruliaParser,
  ) {}

  async onModuleInit() {
    // Initialize browser on Railway - Railway handles Puppeteer better than Vercel
    await this.initBrowser();

    // Share browser instance with all parsers
    this.flexmlsParser.setBrowser(this.browser);
    this.zillowParser.setBrowser(this.browser);
    this.realtorParser.setBrowser(this.browser);
    this.truliaParser.setBrowser(this.browser);
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  /**
   * Test method to verify browser initialization
   */
  async testBrowserConnection(): Promise<{
    success: boolean;
    message: string;
    platform: string
  }> {
    try {
      if (!this.browser) {
        return {
          success: false,
          message: 'Browser not initialized',
          platform: process.platform
        };
      }

      const page = await this.browser.newPage();
      await page.goto('https://www.google.com', {
        waitUntil: 'networkidle2',
        timeout: 10000
      });
      const title = await page.title();
      await page.close();

      return {
        success: true,
        message: `Browser test successful. Page title: ${title}`,
        platform: process.platform,
      };
    } catch (error) {
      this.logger.error('Browser test failed:', error.message);
      return {
        success: false,
        message: `Browser test failed: ${error.message}`,
        platform: process.platform,
      };
    }
  }

  /**
   * Initialize the Puppeteer browser instance
   */
  private async initBrowser(): Promise<void> {
    try {
      const isWindows = process.platform === 'win32';

      // Different configurations for local vs production
      this.browser = await puppeteer.launch({
        headless: true,
        args: isWindows
          ? [
              // Windows-compatible configuration
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-gpu',
              '--no-first-run',
              '--disable-background-networking',
              '--disable-background-timer-throttling',
              '--disable-renderer-backgrounding',
              '--disable-backgrounding-occluded-windows',
            ]
          : [
              // Linux/production configuration - minimal for Railway
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-gpu',
              '--no-first-run',
            ],
        ignoreDefaultArgs: ['--disable-extensions'],
        timeout: 30000,
      });

      this.logger.log(
        `Browser initialized successfully for MLS parsing (${isWindows ? 'Windows' : 'Linux'} mode)`,
      );

      // Share browser instance with all parsers
      this.flexmlsParser.setBrowser(this.browser);
      this.zillowParser.setBrowser(this.browser);
    } catch (error) {
      this.logger.error('Failed to initialize browser:', error);
      // Don't throw error - allow API to continue without MLS parsing
      this.browser = null;
      this.flexmlsParser.setBrowser(null);
      this.zillowParser.setBrowser(null);
    }
  }

  /**
   * Parse a single MLS URL
   *
   * Uses the parser factory to select the appropriate parser based on the URL.
   * Maintains backward compatibility with existing FlexMLS-only implementation.
   */
  async parseSingleMLS(mlsUrl: string): Promise<ParseResult> {
    try {
      this.logger.log(`Parsing MLS URL: ${mlsUrl}`);

      // Check if browser is available
      if (!this.browser) {
        return {
          success: false,
          error: 'MLS parsing temporarily unavailable - browser not initialized',
          mlsUrl,
        };
      }

      // Get appropriate parser from factory
      const parser = this.parserFactory.getParser(mlsUrl);

      if (!parser) {
        // Check if it's an old FlexMLS URL for backward compatibility
        if (this.isValidMLSUrl(mlsUrl)) {
          this.logger.warn(
            `Factory didn't find parser but URL looks like FlexMLS. Using legacy validation.`,
          );
          // Fall through to use FlexMLS parser directly
        } else {
          return {
            success: false,
            error:
              'Unsupported URL format. Currently supported: FlexMLS, Zillow, Realtor.com, Trulia',
            mlsUrl,
          };
        }
      }

      // Parse using the appropriate parser (or FlexMLS for backward compatibility)
      const parsedData = parser
        ? await parser.parse(mlsUrl)
        : await this.flexmlsParser.parse(mlsUrl);

      return {
        success: true,
        data: parsedData,
        mlsUrl,
      };
    } catch (error) {
      this.logger.error(`Failed to parse MLS URL ${mlsUrl}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown parsing error',
        mlsUrl,
      };
    }
  }

  /**
   * Quick parsing method for immediate UI feedback
   *
   * Currently only FlexMLS supports quick parsing.
   * Other parsers will use their standard parse method.
   */
  async parseQuickMLS(mlsUrl: string): Promise<ParseResult> {
    try {
      this.logger.log(`Quick parsing MLS URL: ${mlsUrl}`);

      // Get appropriate parser from factory
      const parser = this.parserFactory.getParser(mlsUrl);

      if (!parser) {
        // Backward compatibility check
        if (this.isValidMLSUrl(mlsUrl)) {
          this.logger.warn(
            `Factory didn't find parser for quick parse. Using FlexMLS parser.`,
          );
        } else {
          return {
            success: false,
            error:
              'Unsupported URL format. Currently supported: FlexMLS, Zillow, Realtor.com, Trulia',
            mlsUrl,
          };
        }
      }

      // Use FlexMLS parser's quick parse method if available
      // For now, only FlexMLS supports quick parsing
      let quickData: ParsedMLSProperty;

      if (this.flexmlsParser.canHandle(mlsUrl)) {
        quickData = await this.flexmlsParser.parseQuick(mlsUrl);
      } else {
        // For other parsers, use regular parse (they don't have quick parse yet)
        quickData = parser
          ? await parser.parse(mlsUrl)
          : await this.flexmlsParser.parseQuick(mlsUrl);
      }

      return {
        success: true,
        data: quickData,
        mlsUrl,
        isQuickParse: true,
      };
    } catch (error) {
      this.logger.error(`Failed to quick parse MLS URL ${mlsUrl}:`, error);
      return {
        success: false,
        error: error.message || 'Unknown parsing error',
        mlsUrl,
      };
    }
  }

  /**
   * Batch URL parsing method
   *
   * Parses multiple URLs sequentially with rate limiting
   */
  async parseBatchMLS(mlsUrls: string[]): Promise<ParseResult[]> {
    this.logger.log(`Parsing batch of ${mlsUrls.length} MLS URLs`);

    const results: ParseResult[] = [];

    for (const mlsUrl of mlsUrls) {
      const result = await this.parseSingleMLS(mlsUrl);
      results.push(result);

      // Add small delay between requests to be respectful
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return results;
  }

  /**
   * Validate if a URL is a valid FlexMLS URL
   *
   * @deprecated Use parserFactory.canParse() instead for multi-site support
   */
  private isValidMLSUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return (
        urlObj.hostname.includes('flexmls.com') &&
        urlObj.pathname.includes('/share/')
      );
    } catch {
      return false;
    }
  }

  /**
   * PropIQ-specific parse method.
   *
   * Uses the same browser instance but runs PropIQ's extraction logic:
   * 1. data-listing JSON attribute (richest structured data from Spark API)
   * 2. #tagged_listing_media JSON (all photos)
   * 3. Text fallback for fields missed by JSON
   *
   * Returns raw fields + photos — PropIQ maps these to its own types.
   */
  async propiqParse(
    shareUrl: string,
    options: { width?: number; height?: number; maxPhotos?: number } = {},
  ): Promise<{ rawFields: Record<string, string>; photos: Array<{ url: string; caption: string }> }> {
    const { width = 1200, height = 900, maxPhotos = 50 } = options;

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    // Verify browser is still connected
    try {
      await this.browser.version();
    } catch {
      this.logger.warn('Browser disconnected, reinitializing...');
      await this.initBrowser();
      if (!this.browser) throw new Error('Failed to reinitialize browser');
    }

    const page = await this.browser.newPage();

    try {
      await page.setViewport({ width: 1280, height: 800 });
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      );

      this.logger.log(`[PropIQ] Navigating to ${shareUrl}`);
      await page.goto(shareUrl, { waitUntil: 'networkidle2', timeout: 45000 });

      // Wait for critical data elements rendered by FlexMLS JS
      await Promise.all([
        page.waitForSelector('[data-listing]', { timeout: 15000 }).catch(() => {}),
        page.waitForSelector('#tagged_listing_media', { timeout: 15000 }).catch(() => {}),
      ]);

      // Wait for collapsible sections to appear
      await page.waitForSelector('.c-collapsible__title', { timeout: 10000 }).catch(() => {});

      // Expand all collapsible sections (county, basement, garage, etc.)
      await page.evaluate(() => {
        const titles = document.querySelectorAll('.c-collapsible__title');
        for (const t of titles) (t as HTMLElement).click();
      });

      // Wait for expanded content to render
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Poll until data-listing has 5+ keys (full render)
      await page.waitForFunction(
        () => {
          const el = document.querySelector('[data-listing]');
          if (!el) return false;
          try {
            const data = JSON.parse(el.getAttribute('data-listing') || '{}');
            return Object.keys(data).length >= 5;
          } catch { return false; }
        },
        { timeout: 10000 },
      ).catch(() => {});

      // Extract everything in one page.evaluate call
      const extracted = await page.evaluate((maxP: number) => {
        const rawFields: Record<string, string> = {};
        const photoResults: Array<{ url: string; caption: string }> = [];

        // === PRIMARY: data-listing JSON attribute ===
        const els = document.querySelectorAll('[data-listing]');
        for (const el of els) {
          const jsonStr = el.getAttribute('data-listing');
          if (!jsonStr) continue;
          try {
            const obj = JSON.parse(jsonStr);
            for (const [key, val] of Object.entries(obj)) {
              if (val != null && typeof val !== 'object') {
                rawFields[key] = String(val);
              }
            }
            break;
          } catch { /* skip */ }
        }

        // === PRIMARY: #tagged_listing_media photos ===
        const mediaEl = document.getElementById('tagged_listing_media');
        if (mediaEl) {
          try {
            const data = JSON.parse(mediaEl.textContent || '');
            const allMedia = data?.combined?.All;
            if (Array.isArray(allMedia)) {
              for (const entry of allMedia) {
                const html = entry.html || '';
                const srcMatch = html.match(/src="([^"]+)"/);
                const altMatch = html.match(/alt="([^"]+)"/);
                if (srcMatch && srcMatch[1].includes('sparkplatform.com')) {
                  photoResults.push({
                    url: srcMatch[1],
                    caption: altMatch ? altMatch[1] : '',
                  });
                }
              }
            }
          } catch { /* skip */ }
        }

        // === FALLBACK: Text extraction for fields missed by JSON ===
        const bodyText = document.body.innerText || '';

        const mlsMatch = bodyText.match(/#(\d{6,12})/);
        if (mlsMatch && !rawFields['MlsNumber']) rawFields['MlsNumber'] = mlsMatch[1];

        const priceMatch = bodyText.match(/\$[\d,]+(?:\.\d{2})?/);
        if (priceMatch && !rawFields['ListPrice']) rawFields['ListPrice'] = priceMatch[0];

        const statusMatch = bodyText.match(/\b(Active|Pending|Sold|Expired|Cancelled|Withdrawn|Under Contract)\b/i);
        if (statusMatch && !rawFields['StandardStatus']) rawFields['StandardStatus'] = statusMatch[1];

        const labelPatterns: Array<[RegExp, string]> = [
          [/Total\s*#?\s*Bedrooms?\s*\n\s*(\d+)/i, 'BedsTotal'],
          [/Total\s*Bathrooms?\s*\n\s*([\d.]+)/i, 'BathsTotal'],
          [/Baths\s*-\s*Full\s*\n\s*(\d+)/i, 'BathroomsFull'],
          [/Baths\s*-\s*1\/2\s*\n\s*(\d+)/i, 'BathroomsHalf'],
          [/Above\s*Grade\s*Finished\s*\n\s*([\d,.]+)/i, 'AboveGradeFinished'],
          [/Below\s*Grade\s*Finished\s*\n\s*([\d,.]+)/i, 'BelowGradeFinishedArea'],
          [/Below\s*Grade\s*Unfin\s*\n\s*([\d,.]+)/i, 'BelowGradeUnfinished'],
          [/SqFt\s*-\s*Total\s*Finished\s*\n\s*([\d,.]+)/i, 'BuildingAreaTotal'],
          [/Property\s*Sub\s*Type\s*\n\s*(.+)/i, 'PropertySubType'],
          [/HOA\s*Annual\s*\$\s*\n\s*([\d,]+)/i, 'HOAAnnual'],
          [/Listing\s*Office\s*\n\s*(.+)/i, 'ListOfficeName'],
          [/Listing\s*Date\s*\n\s*(.+)/i, 'ListingContractDate'],
          [/Original\s*List\s*Price\s*\n\s*\$?([\d,]+)/i, 'OriginalListPrice'],
          [/County\s*\n+\s*([A-Za-z]+)/i, 'CountyOrParish'],
          [/Area\s*\n+\s*(.+)/i, 'Area'],
          [/Zip\s*Code\s*\n\s*(\d{5})/i, 'PostalCode'],
          [/Year\s*Built\s*\n?\s*:?\s*(\d{4})/i, 'YearBuilt'],
          [/Garage\s*Spaces\s*\n\s*(\d+)/i, 'GarageSpaces'],
          [/Acres\s*\n\s*([\d.]+)/i, 'LotSizeAcres'],
          [/Total\s*Fireplaces\s*\n\s*(\d+)/i, 'Fireplaces'],
          [/Subdivision(?:\/Condo)?\s*\n+\s*(.+)/i, 'SubdivisionName'],
        ];

        for (const [pattern, key] of labelPatterns) {
          if (!rawFields[key]) {
            const match = bodyText.match(pattern);
            if (match) rawFields[key] = match[1].trim();
          }
        }

        // Description
        const descSection = bodyText.match(/Description\n\n([\s\S]+?)(?:\n\nLocation|\n\nListing Details|\n\nTaxes)/);
        if (descSection) rawFields['_description'] = descSection[1].trim();

        // === FALLBACK: img tags if tagged_listing_media had no photos ===
        if (photoResults.length === 0) {
          const imgs = document.querySelectorAll('img');
          for (const img of imgs) {
            const src = img.src || img.getAttribute('data-src') || '';
            if (src.includes('sparkplatform.com') || src.includes('resize.spark')) {
              photoResults.push({ url: src, caption: img.alt || img.title || '' });
            }
          }
        }

        // Deduplicate photos
        const seen = new Set<string>();
        const deduped = photoResults.filter((r) => {
          const base = r.url.replace(/\/\d+x\d+\//, '/KEY/').split('?')[0];
          if (seen.has(base)) return false;
          seen.add(base);
          return true;
        }).slice(0, maxP);

        return { rawFields, photos: deduped };
      }, maxPhotos);

      // Resize photo URLs to requested dimensions
      const photos = extracted.photos.map((p) => ({
        url: p.url.replace(/\/\d+x\d+\//, `/${width}x${height}/`),
        caption: p.caption,
      }));

      return { rawFields: extracted.rawFields, photos };
    } finally {
      await page.close();
    }
  }

  /**
   * Enhanced duplicate detection
   *
   * Checks if a property already exists for a given agent/client combination
   */
  async checkEnhancedDuplicate(
    agentId: string,
    clientId: string,
    parsedProperty: ParsedMLSProperty,
  ): Promise<{
    isDuplicate: boolean;
    reason?: string;
    existingProperty?: any;
  }> {
    console.log('\n🔍 DUPLICATE CHECK:');
    console.log('  Source URL:', parsedProperty.sourceUrl);
    console.log('  Full Address:', parsedProperty.address.full);

    // Check by MLS URL
    const existingByUrl = await this.prisma.property.findFirst({
      where: {
        originalMlsUrl: parsedProperty.sourceUrl,
        timeline: {
          agentId,
          clientId,
          isActive: true,
        },
      },
    });

    console.log('  Existing by URL:', existingByUrl ? `FOUND (${existingByUrl.address})` : 'Not found');

    if (existingByUrl) {
      return {
        isDuplicate: true,
        reason: 'Same MLS URL already imported',
        existingProperty: existingByUrl,
      };
    }

    // Check by normalized address
    const normalizedAddress = this.normalizeAddress(
      parsedProperty.address.full,
    );
    console.log('  Normalized Address:', normalizedAddress);

    const existingByAddress = await this.prisma.property.findFirst({
      where: {
        addressNormalized: normalizedAddress,
        timeline: {
          agentId,
          clientId,
          isActive: true,
        },
      },
    });

    console.log('  Existing by Address:', existingByAddress ? `FOUND (${existingByAddress.address})` : 'Not found');

    if (existingByAddress) {
      return {
        isDuplicate: true,
        reason: 'Similar address already exists',
        existingProperty: existingByAddress,
      };
    }

    console.log('  ✅ No duplicate found\n');
    return { isDuplicate: false };
  }

  /**
   * Normalize an address for comparison
   */
  private normalizeAddress(address: string): string {
    return address
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get price range category for a numeric price
   */
  private getPriceRange(price: number): string {
    if (price < 200000) return 'under_200k';
    if (price < 300000) return '200k_300k';
    if (price < 500000) return '300k_500k';
    if (price < 750000) return '500k_750k';
    if (price < 1000000) return '750k_1m';
    return 'over_1m';
  }
}

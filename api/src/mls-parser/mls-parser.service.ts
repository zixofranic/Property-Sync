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

    if (existingByAddress) {
      return {
        isDuplicate: true,
        reason: 'Similar address already exists',
        existingProperty: existingByAddress,
      };
    }

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

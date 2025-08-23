import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import puppeteer, { Browser, Page } from 'puppeteer';
import {
  ParsedMLSProperty,
  ParseResult,
  ImageData,
  PriceData,
} from './interfaces/mls-property.interface';

@Injectable()
export class MLSParserService {
  private readonly logger = new Logger(MLSParserService.name);
  private browser: Browser | null = null;

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.initBrowser();
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  private async initBrowser(): Promise<void> {
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.CHROMIUM_PATH || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
        ],
      });
      this.logger.log('Browser initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  // Single URL parsing method
  async parseSingleMLS(mlsUrl: string): Promise<ParseResult> {
    try {
      this.logger.log(`Parsing MLS URL: ${mlsUrl}`);

      // Validate URL format
      if (!this.isValidMLSUrl(mlsUrl)) {
        return {
          success: false,
          error:
            'Invalid MLS URL format. Only FlexMLS URLs are currently supported.',
          mlsUrl,
        };
      }

      const parsedData = await this.parseFlexMLSEnhanced(mlsUrl);

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

  // Quick parsing method for immediate UI feedback
  async parseQuickMLS(mlsUrl: string): Promise<ParseResult> {
    try {
      this.logger.log(`Quick parsing MLS URL: ${mlsUrl}`);

      // Validate URL format
      if (!this.isValidMLSUrl(mlsUrl)) {
        return {
          success: false,
          error:
            'Invalid MLS URL format. Only FlexMLS URLs are currently supported.',
          mlsUrl,
        };
      }

      const quickData = await this.parseFlexMLSQuick(mlsUrl);

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

  // Batch URL parsing method
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

  // Your enhanced FlexMLS parser (integrated from your existing code)
  // Quick parsing method - gets basic info fast
  private async parseFlexMLSQuick(
    shareUrl: string,
  ): Promise<ParsedMLSProperty> {
    if (!this.browser) {
      await this.initBrowser();
    }

    const page = await this.browser!.newPage();

    try {
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      );
      await page.setViewport({ width: 1920, height: 1080 });

      await page.goto(shareUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Quick wait for basic content
      await page.waitForSelector('body', { timeout: 10000 });
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Shorter wait

      const quickData = await this.extractQuickData(page);
      const urlData = this.parseFlexMLSUrl(shareUrl);

      return {
        ...urlData,
        ...quickData,
        scrapedAt: new Date(),
        sourceUrl: shareUrl,
      } as ParsedMLSProperty;
    } finally {
      await page.close();
    }
  }

  private async parseFlexMLSEnhanced(
    shareUrl: string,
  ): Promise<ParsedMLSProperty> {
    if (!this.browser) {
      await this.initBrowser();
    }

    const page = await this.browser!.newPage();

    try {
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      );
      await page.setViewport({ width: 1920, height: 1080 });

      await page.goto(shareUrl, {
        waitUntil: 'domcontentloaded', // Faster than networkidle0
        timeout: 30000, // Increased timeout
      });

      await page.waitForSelector('body', { timeout: 15000 });
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Reduced delay

      const extractedData = await this.extractEnhancedData(page);
      const urlData = this.parseFlexMLSUrl(shareUrl);

      return {
        ...urlData,
        ...extractedData,
        scrapedAt: new Date(),
        sourceUrl: shareUrl,
      } as ParsedMLSProperty;
    } finally {
      await page.close();
    }
  }

  // Data extraction method (your existing logic)
  // Quick data extraction - gets only essential info for immediate display
  private async extractQuickData(
    page: Page,
  ): Promise<Partial<ParsedMLSProperty>> {
    return await page.evaluate(() => {
      // Get first image quickly
      const getFirstImage = (): any[] => {
        const imageSelectors = [
          '[data-testid="hero-image"] img',
          '.hero-image img',
          '.property-images img:first-child',
          '.listing-photos img:first-child',
          'img[src*="mls"]',
        ];

        for (const selector of imageSelectors) {
          const img = document.querySelector(selector) as HTMLImageElement;
          if (img?.src) {
            return [
              {
                url: img.src,
                alt: img.alt || '',
                size: 'medium' as const,
              },
            ];
          }
        }
        return [];
      };

      // Get basic property details quickly
      const getBasicDetails = () => {
        const details: any = {};

        // Try to get beds/baths/sqft from common selectors
        const bedSelectors = [
          '[data-testid="beds"]',
          '.beds',
          '.bed-count',
          '.property-beds',
          '[class*="bed"]',
          '.bedroom-count',
          '.property-details .beds',
          '.listing-details .beds',
        ];
        const bathSelectors = [
          '[data-testid="baths"]',
          '.baths',
          '.bath-count',
          '.property-baths',
          '[class*="bath"]',
          '.bathroom-count',
          '.property-details .baths',
          '.listing-details .baths',
        ];
        const sqftSelectors = [
          '[data-testid="sqft"]',
          '.sqft',
          '.square-feet',
          '.property-sqft',
          '[class*="sqft"]',
          '.square-footage',
          '.property-details .sqft',
          '.listing-details .sqft',
        ];

        for (const selector of bedSelectors) {
          const element = document.querySelector(selector);
          if (element?.textContent) {
            details.beds = element.textContent.trim();
            break;
          }
        }

        for (const selector of bathSelectors) {
          const element = document.querySelector(selector);
          if (element?.textContent) {
            details.baths = element.textContent.trim();
            break;
          }
        }

        for (const selector of sqftSelectors) {
          const element = document.querySelector(selector);
          if (element?.textContent) {
            details.sqft = element.textContent.trim();
            break;
          }
        }

        return details;
      };

      // Get basic price info quickly
      const getBasicPrice = () => {
        const priceSelectors = [
          '[data-testid="listing-price"]',
          '.listing-price',
          '.price',
          '.property-price',
        ];

        for (const selector of priceSelectors) {
          const element = document.querySelector(selector);
          if (element?.textContent) {
            const priceText = element.textContent.trim();
            const numericPrice = parseInt(priceText.replace(/[^0-9]/g, ''));

            if (numericPrice > 0) {
              return {
                listPrice: priceText,
                priceNumeric: numericPrice,
              };
            }
          }
        }
        return null;
      };

      return {
        images: getFirstImage(),
        propertyDetails: getBasicDetails(),
        pricing: getBasicPrice(),
      };
    });
  }

  private async extractEnhancedData(
    page: Page,
  ): Promise<Partial<ParsedMLSProperty>> {
    return await page.evaluate(() => {
      // Price extraction
      const extractPrice = (): PriceData | null => {
        const priceSelectors = [
          '[data-testid="listing-price"]',
          '[data-testid="price"]',
          '.listing-price',
          '.price',
          '.property-price',
          '.list-price',
          '.current-price',
          'span[class*="price"]',
          'div[class*="price"]',
          'h1[class*="price"]',
          'h2[class*="price"]',
          '.price-container',
          '.pricing',
        ];

        let priceText = '';
        for (const selector of priceSelectors) {
          try {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
              const text = element.textContent?.trim() || '';
              if (text.match(/\$[\d,]+/)) {
                priceText = text;
                break;
              }
            }
            if (priceText) break;
          } catch (e) {
            continue;
          }
        }

        if (!priceText) {
          const allText = document.body.innerText;
          const priceMatch = allText.match(/\$[\d,]+/);
          if (priceMatch) {
            priceText = priceMatch[0];
          }
        }

        if (!priceText) return null;

        const numericMatch = priceText.match(/[\d,]+/);
        const priceNumeric = numericMatch
          ? parseInt(numericMatch[0].replace(/,/g, ''), 10)
          : 0;

        return {
          listPrice: priceText,
          priceNumeric,
        };
      };

      // Simple image extraction - just get the first good image
      const extractImages = (): ImageData[] => {
        const imageSelectors = [
          'img[src*="flexmls"]',
          'img[src*="photo"]',
          'img[src*="image"]',
          '.property-image img',
          '.gallery img',
          '.photos img',
          'img[src*="http"]',
        ];

        for (const selector of imageSelectors) {
          try {
            const imageElements = document.querySelectorAll(selector);

            for (const img of Array.from(imageElements)) {
              const htmlImg = img as HTMLImageElement;
              const src = htmlImg.src;

              if (!src) continue;

              // Basic filtering - just exclude obvious non-photos
              const srcLower = src.toLowerCase();
              if (
                srcLower.includes('logo') ||
                srcLower.includes('icon') ||
                srcLower.includes('button') ||
                htmlImg.width < 200 ||
                htmlImg.height < 150
              ) {
                continue;
              }

              // Return the first good image we find
              return [
                {
                  url: src,
                  alt: htmlImg.alt || undefined,
                  title: htmlImg.title || undefined,
                  width: htmlImg.naturalWidth || htmlImg.width,
                  height: htmlImg.naturalHeight || htmlImg.height,
                  size: 'large' as const,
                },
              ];
            }
          } catch (e) {
            continue;
          }
        }

        return [];
      };

      // Property details extraction
      const extractPropertyDetails = () => {
        const findText = (patterns: string[]): string => {
          for (const pattern of patterns) {
            const regex = new RegExp(pattern, 'i');
            const match = document.body.innerText.match(regex);
            if (match) return match[0].trim();
          }
          return '';
        };

        // Extract property description - look for common description patterns
        const findDescription = (): string => {
          const bodyText = document.body.innerText;
          const descriptionPatterns = [
            /description[:\s]+(.*?)(?=\n\n|\n[A-Z]|\n\s*$)/i,
            /remarks[:\s]+(.*?)(?=\n\n|\n[A-Z]|\n\s*$)/i,
            /about this property[:\s]+(.*?)(?=\n\n|\n[A-Z]|\n\s*$)/i,
          ];

          for (const pattern of descriptionPatterns) {
            const match = bodyText.match(pattern);
            if (match && match[1] && match[1].trim().length > 20) {
              return match[1].trim().substring(0, 500); // Limit to 500 chars
            }
          }

          // Fallback: look for longer text blocks that might be descriptions
          const paragraphs = bodyText
            .split('\n')
            .filter((p) => p.trim().length > 50);
          const possibleDescription = paragraphs.find(
            (p) =>
              p.includes('bedroom') ||
              p.includes('kitchen') ||
              p.includes('living') ||
              p.includes('home') ||
              p.includes('property') ||
              p.includes('house'),
          );

          return possibleDescription
            ? possibleDescription.substring(0, 500)
            : '';
        };

        return {
          beds: findText([
            '(\\d+)\\s*bed(?:room)?s?',
            'bed(?:room)?s?\\s*:?\\s*(\\d+)',
            '(\\d+)\\s*bd',
            '(\\d+)\\s*br',
            'beds?\\s*:?\\s*(\\d+)',
            '(\\d+)\\s*bedroom',
          ]),
          baths: findText([
            '(\\d+(?:\\.\\d+)?)\\s*bath(?:room)?s?',
            'bath(?:room)?s?\\s*:?\\s*(\\d+(?:\\.\\d+)?)',
            '(\\d+(?:\\.\\d+)?)\\s*ba',
            'baths?\\s*:?\\s*(\\d+(?:\\.\\d+)?)',
            '(\\d+(?:\\.\\d+)?)\\s*bathroom',
          ]),
          sqft: findText([
            '([\\d,]+)\\s*sq\\s*ft',
            '([\\d,]+)\\s*square\\s*feet?',
            'sq\\s*ft\\s*:?\\s*([\\d,]+)',
            'sqft\\s*:?\\s*([\\d,]+)',
            '([\\d,]+)\\s*sf',
            'square\\s*feet?\\s*:?\\s*([\\d,]+)',
          ]),
          description: findDescription(),
        };
      };

      // Listing info extraction
      const extractListingInfo = () => {
        const findText = (patterns: string[]): string => {
          for (const pattern of patterns) {
            const regex = new RegExp(pattern, 'i');
            const match = document.body.innerText.match(regex);
            if (match) return match[1] || match[0].trim();
          }
          return '';
        };

        return {
          mlsNumber: findText([
            'mls\\s*#?\\s*([\\w\\d]+)',
            'listing\\s*#?\\s*([\\w\\d]+)',
            '#\\s*([\\w\\d]{6,})',
          ]),
        };
      };

      const pricing = extractPrice();
      const images = extractImages();
      const propertyDetails = extractPropertyDetails();
      const listingInfo = extractListingInfo();

      return {
        pricing,
        images,
        propertyDetails,
        listingInfo,
      };
    });
  }

  // URL parsing method (your existing logic)
  private parseFlexMLSUrl(url: string) {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');

      if (pathParts.length < 4 || pathParts[1] !== 'share') {
        throw new Error('Invalid FlexMLS URL format');
      }

      const shareId = pathParts[2];
      const propertySlug = pathParts[3];
      const parts = propertySlug.split('-');

      if (parts.length < 4) {
        throw new Error('Invalid property slug format');
      }

      const zipCode = parts[parts.length - 1];
      const state = parts[parts.length - 2];
      const city = parts[parts.length - 3];
      const streetAddress = parts.slice(0, parts.length - 3).join(' ');

      return {
        shareId,
        address: {
          street: streetAddress,
          city,
          state,
          zipCode,
          full: `${streetAddress}, ${city}, ${state} ${zipCode}`,
        },
      };
    } catch (error) {
      throw new Error(`Failed to parse FlexMLS URL: ${error.message}`);
    }
  }

  // Validation methods
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

  // Enhanced duplicate detection
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

  private normalizeAddress(address: string): string {
    return address
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private getPriceRange(price: number): string {
    if (price < 200000) return 'under_200k';
    if (price < 300000) return '200k_300k';
    if (price < 500000) return '300k_500k';
    if (price < 750000) return '500k_750k';
    if (price < 1000000) return '750k_1m';
    return 'over_1m';
  }
}

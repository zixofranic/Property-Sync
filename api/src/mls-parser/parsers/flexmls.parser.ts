import { Injectable, Logger } from '@nestjs/common';
import { Browser, Page } from 'puppeteer';
import { IPropertyParser } from '../interfaces/base-parser.interface';
import {
  ParsedMLSProperty,
  ImageData,
  PriceData,
} from '../interfaces/mls-property.interface';

/**
 * FlexMLS-specific property parser.
 * Handles parsing of FlexMLS share URLs (https://www.flexmls.com/share/*).
 *
 * This parser extracts property data from FlexMLS listing pages using Puppeteer.
 * It supports both quick parsing (for immediate UI feedback) and enhanced parsing
 * (for comprehensive data extraction including all images and property details).
 */
@Injectable()
export class FlexmlsParser implements IPropertyParser {
  private readonly logger = new Logger(FlexmlsParser.name);

  /**
   * Browser instance for web scraping.
   * Injected from the main MLS parser service.
   */
  private browser: Browser | null = null;

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
        urlObj.hostname.includes('flexmls.com') &&
        urlObj.pathname.includes('/share/')
      );
    } catch {
      return false;
    }
  }

  /**
   * @inheritdoc
   */
  getParserName(): string {
    return 'FlexMLS';
  }

  /**
   * @inheritdoc
   */
  getConfidence(url: string): number {
    if (!this.canHandle(url)) {
      return 0.0;
    }

    // Check for valid FlexMLS share URL structure
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');

      // FlexMLS URLs should have format: /share/{shareId}/{propertySlug}
      if (pathParts.length >= 4 && pathParts[1] === 'share') {
        return 1.0; // Perfect match
      }

      return 0.5; // Looks like FlexMLS but structure is off
    } catch {
      return 0.0;
    }
  }

  /**
   * @inheritdoc
   */
  async parse(url: string): Promise<ParsedMLSProperty> {
    if (!this.canHandle(url)) {
      throw new Error(
        `FlexmlsParser cannot handle URL: ${url}. Only FlexMLS share URLs are supported.`,
      );
    }

    if (!this.browser) {
      throw new Error(
        'Browser not initialized. Cannot parse FlexMLS URL without browser instance.',
      );
    }

    return await this.parseFlexMLSEnhanced(url);
  }

  /**
   * Quick parsing method - gets basic info fast for immediate UI feedback.
   *
   * @param shareUrl - The FlexMLS share URL to parse
   * @returns Promise resolving to parsed property data with basic fields
   */
  async parseQuick(shareUrl: string): Promise<ParsedMLSProperty> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    // Check if browser is still connected, reinitialize if needed
    try {
      await this.browser.version();
    } catch (error) {
      this.logger.warn('Browser disconnected during quick parse');
      throw new Error('Browser disconnected. Please retry.');
    }

    const page = await this.browser.newPage();

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

  /**
   * Enhanced parsing method - gets comprehensive property data including all images.
   *
   * @param shareUrl - The FlexMLS share URL to parse
   * @returns Promise resolving to complete parsed property data
   */
  private async parseFlexMLSEnhanced(
    shareUrl: string,
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
      this.logger.log(`🚀 Starting to parse URL: ${shareUrl}`);

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      );
      await page.setViewport({ width: 1920, height: 1080 });

      this.logger.log(`📡 Navigating to URL...`);
      const response = await page.goto(shareUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Log final URL after any redirects
      const finalUrl = page.url();
      this.logger.log(`🔗 Final URL after navigation: ${finalUrl}`);
      this.logger.log(`📊 Response status: ${response?.status() || 'unknown'}`);

      // Check for JSON on original URL before redirect
      if (finalUrl !== shareUrl) {
        this.logger.log(`🔄 Trying original URL for JSON data...`);
        await page.goto(shareUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });

        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Check JSON on original URL
        const originalJsonCheck = await page.evaluate(() => {
          const element = document.querySelector('#tagged_listing_media');
          let jsonStructure: any = null;

          if (element && element.textContent) {
            try {
              const jsonData = JSON.parse(element.textContent);
              jsonStructure = {
                topLevelKeys: Object.keys(jsonData),
                combinedKeys: jsonData.combined
                  ? Object.keys(jsonData.combined)
                  : null,
                totalItems: jsonData.combined?.All
                  ? jsonData.combined.All.length
                  : 0,
                hasVideos: jsonData.combined?.Videos
                  ? jsonData.combined.Videos.length
                  : 0,
                hasFloorPlans: jsonData.combined?.FloorPlans
                  ? jsonData.combined.FloorPlans.length
                  : 0,
                hasDocuments: jsonData.combined?.Documents
                  ? jsonData.combined.Documents.length
                  : 0,
                otherSections: Object.keys(jsonData).filter(
                  (k) => k !== 'combined',
                ),
              };
            } catch (e) {
              jsonStructure = { error: 'Failed to parse JSON' };
            }
          }

          return {
            exists: !!element,
            hasContent: !!(element && element.textContent),
            contentLength: element ? element.textContent?.length || 0 : 0,
            structure: jsonStructure,
          };
        });

        this.logger.log(`📋 Original URL JSON check:`);
        this.logger.log(`   Element exists: ${originalJsonCheck.exists}`);
        this.logger.log(`   Has content: ${originalJsonCheck.hasContent}`);
        this.logger.log(`   Content length: ${originalJsonCheck.contentLength}`);

        if (originalJsonCheck.structure) {
          this.logger.log(`📊 JSON Structure on Original URL:`);
          this.logger.log(
            `   Top level keys: ${JSON.stringify(originalJsonCheck.structure.topLevelKeys)}`,
          );
          this.logger.log(
            `   Combined keys: ${JSON.stringify(originalJsonCheck.structure.combinedKeys)}`,
          );
          this.logger.log(
            `   Total media items: ${originalJsonCheck.structure.totalItems}`,
          );
          this.logger.log(`   Videos: ${originalJsonCheck.structure.hasVideos}`);
          this.logger.log(
            `   Floor plans: ${originalJsonCheck.structure.hasFloorPlans}`,
          );
          this.logger.log(
            `   Documents: ${originalJsonCheck.structure.hasDocuments}`,
          );
          this.logger.log(
            `   Other sections: ${JSON.stringify(originalJsonCheck.structure.otherSections)}`,
          );
        }

        // If JSON found on original, stay there and skip gallery interaction
        if (originalJsonCheck.exists && originalJsonCheck.hasContent) {
          this.logger.log(
            `✅ JSON found on original URL, extracting data directly without gallery interaction`,
          );

          // Extract data directly from JSON without gallery navigation
          const extractedData = await this.extractEnhancedData(page);
          const urlData = this.parseFlexMLSUrl(shareUrl);

          return {
            ...urlData,
            ...extractedData,
            scrapedAt: new Date(),
            sourceUrl: shareUrl,
          } as ParsedMLSProperty;
        } else {
          // No JSON on original, go back to redirect for gallery interaction
          await page.goto(finalUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });
        }
      }

      await page.waitForSelector('body', { timeout: 15000 });
      await new Promise((resolve) => setTimeout(resolve, 3000)); // Longer wait for JS to load

      // Try different approaches to access the full gallery
      try {
        this.logger.log(`🖼️ Looking for gallery controls or photo navigation...`);

        // First try to find gallery/slideshow controls
        const gallerySelectors = [
          '[class*="gallery"]',
          '[class*="slideshow"]',
          '[class*="carousel"]',
          '[class*="photo"]',
          '.rsContainer',
          '.rsNav',
          '.rsThumbsContainer',
        ];

        let galleryFound = false;
        for (const selector of gallerySelectors) {
          const elements = await page.$$(selector);
          if (elements.length > 0) {
            this.logger.log(
              `✅ Found gallery container: ${selector} (${elements.length} elements)`,
            );
            galleryFound = true;
          }
        }

        // Try clicking on photo to open gallery
        const photoSelectors = [
          'img[src*="sparkplatform.com"]',
          'img[src*="flexmls"]',
          '.property-photos img',
          '.listing-photos img',
          'img[src*="photo"]',
        ];

        let photoClicked = false;
        for (const selector of photoSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 2000 });
            this.logger.log(`✅ Found photo with selector: ${selector}`);
            await page.click(selector);

            // Wait longer for gallery to fully load
            await new Promise((resolve) => setTimeout(resolve, 4000));
            this.logger.log(`🖼️ Clicked photo - waiting for gallery to load...`);
            photoClicked = true;

            // Try to find navigation arrows or thumbnail controls and interact with them
            const navSelectors = [
              '.rsArrowRight',
              '.rsArrowLeft',
              '[class*="next"]',
              '[class*="prev"]',
              '.rsThumb',
            ];

            for (const navSelector of navSelectors) {
              const navElements = await page.$$(navSelector);
              if (navElements.length > 0) {
                this.logger.log(
                  `🔍 Found ${navElements.length} navigation elements: ${navSelector}`,
                );

                // If it's an arrow, try clicking it to advance through gallery
                if (
                  navSelector.includes('Arrow') ||
                  navSelector.includes('next')
                ) {
                  try {
                    await page.click(navSelector);
                    await new Promise((resolve) => setTimeout(resolve, 1000));
                    this.logger.log(`➡️ Clicked navigation: ${navSelector}`);
                  } catch (e) {
                    this.logger.log(
                      `⚠️ Could not click navigation: ${navSelector}`,
                    );
                  }
                }
              }
            }

            // Try to trigger thumbnail loading by scrolling through the thumbnail container
            try {
              const thumbsContainer = await page.$('.rsThumbsContainer');
              if (thumbsContainer) {
                this.logger.log(
                  `📱 Found thumbnail container, trying to scroll and trigger loading...`,
                );

                // Scroll through the thumbnails container to trigger lazy loading
                await page.evaluate(() => {
                  const container = document.querySelector('.rsThumbsContainer');
                  if (container) {
                    container.scrollLeft = 0;
                    container.scrollLeft = 500;
                    container.scrollLeft = 1000;
                    container.scrollLeft = 1500;
                    container.scrollLeft = 2000;
                  }
                });

                // Wait longer for lazy loading
                await new Promise((resolve) => setTimeout(resolve, 3000));
                this.logger.log(
                  `🔄 Scrolled thumbnails container and waited for loading`,
                );
              }
            } catch (e) {
              this.logger.log(`ℹ️ Could not scroll thumbnail container`);
            }

            break;
          } catch (e) {
            continue;
          }
        }

        if (!photoClicked && !galleryFound) {
          this.logger.log(
            `ℹ️ No gallery or clickable photo found - parsing current view`,
          );
        }
      } catch (error) {
        this.logger.log(
          `ℹ️ Error accessing gallery - continuing with parsing: ${error.message}`,
        );
      }

      this.logger.log(`🔍 Starting data extraction...`);

      const extractedData = await this.extractEnhancedData(page);
      this.logger.log(
        `✅ Data extraction completed. Images found: ${extractedData.images?.length || 0}`,
      );

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

  /**
   * Extracts quick/basic data from a FlexMLS page for immediate display.
   *
   * @param page - The Puppeteer page instance
   * @returns Promise resolving to partial property data
   */
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

  /**
   * Extracts comprehensive data from a FlexMLS page.
   *
   * @param page - The Puppeteer page instance
   * @returns Promise resolving to complete property data
   */
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

      // Extract images from FlexMLS JSON data structure
      const extractImages = (): ImageData[] => {
        const images: ImageData[] = [];
        const seenUrls = new Set<string>();
        const seenImageIds = new Set<string>();

        // First try to extract from the hidden JSON data
        const jsonDataElement = document.querySelector('#tagged_listing_media');

        if (jsonDataElement && jsonDataElement.textContent) {
          try {
            const jsonData = JSON.parse(jsonDataElement.textContent);

            if (jsonData.combined && jsonData.combined.All) {
              jsonData.combined.All.forEach((item: any) => {
                if (item.html) {
                  // Extract both high-res and thumbnail URLs from the HTML
                  const imgMatch = item.html.match(/src="([^"]+)"/);
                  const altMatch = item.html.match(/alt="([^"]+)"/);

                  // Only keep high-resolution images, skip thumbnails
                  if (imgMatch && imgMatch[1]) {
                    const src = imgMatch[1];

                    // Filter: Only keep high-res images (with resize path and dimensions)
                    const isHighRes =
                      src.includes('cdn.resize.sparkplatform.com') &&
                      src.match(/\/\d+x\d+\//); // Has dimensions like /1280x1024/

                    if (isHighRes) {
                      const imageId =
                        src.match(/\/(\d{26}-[a-z]\.jpg)/i)?.[1] || src;

                      if (!seenUrls.has(src) && !seenImageIds.has(imageId)) {
                        images.push({
                          url: src,
                          alt: altMatch ? altMatch[1] : undefined,
                          title: undefined,
                          width: undefined,
                          height: undefined,
                          size: 'large' as const,
                        });
                        seenUrls.add(src);
                        seenImageIds.add(imageId);
                      }
                    }
                  }
                }
              });
            }
          } catch (e) {
            console.log(
              'Failed to parse JSON data:',
              e.message,
              'falling back to DOM extraction',
            );
          }
        }

        // If we got images from JSON, return them
        if (images.length > 0) {
          return images;
        }

        // Fallback: COMPREHENSIVE background image extraction from DOM
        const allElements = document.querySelectorAll('*');

        allElements.forEach((el) => {
          const bgImage = window.getComputedStyle(el).backgroundImage;
          if (bgImage && bgImage !== 'none') {
            const urlMatch = bgImage.match(/url\(['"]?([^'"]+)['"]?\)/);
            if (urlMatch && urlMatch[1]) {
              let src = urlMatch[1];

              // Skip obvious non-photo backgrounds
              const srcLower = src.toLowerCase();
              if (
                srcLower.includes('data:image') ||
                srcLower.includes('gradient') ||
                srcLower.includes('logo') ||
                srcLower.includes('icon') ||
                srcLower.includes('button') ||
                srcLower.endsWith('.svg')
              ) {
                return;
              }

              // Extract image ID for deduplication
              const imageId =
                src.match(/\/(\d{26}\.jpg)/i)?.[1] ||
                src.match(/\/([^/]+\.(jpg|jpeg|png|webp))/i)?.[1] ||
                src;

              if (!seenUrls.has(src) && !seenImageIds.has(imageId)) {
                images.push({
                  url: src,
                  alt:
                    el.getAttribute('alt') ||
                    el.getAttribute('aria-label') ||
                    el.getAttribute('title') ||
                    undefined,
                  title: el.getAttribute('title') || undefined,
                  width: undefined,
                  height: undefined,
                  size: 'large' as const,
                });
                seenUrls.add(src);
                seenImageIds.add(imageId);
              }
            }
          }
        });

        // Multiple selectors for regular image tags
        const imageSelectors = [
          'img[src*="flexmls"]',
          'img[data-src*="flexmls"]',
          '.gallery img',
          '.photos img',
          '.property-photos img',
          '.listing-photos img',
          '.image-gallery img',
          '.photo-gallery img',
          '.property-image img',
          'img[src*="photo"]',
          'img[src*="image"]',
          'img[src*="listing"]',
          'img[src*="http"]',
        ];

        for (const selector of imageSelectors) {
          try {
            const imageElements = document.querySelectorAll(selector);

            for (const img of Array.from(imageElements)) {
              const htmlImg = img as HTMLImageElement;
              let src =
                htmlImg.src ||
                htmlImg.getAttribute('data-src') ||
                htmlImg.getAttribute('data-lazy-src');

              if (!src) continue;
              if (seenUrls.has(src)) continue;

              // Extract image ID from Spark CDN URLs to prevent resolution duplicates
              const extractImageId = (url: string): string => {
                const match = url.match(/\/(\d{26}-[a-z]\.jpg)/i);
                return match ? match[1] : url;
              };

              const imageId = extractImageId(src);

              if (seenImageIds.has(imageId)) {
                continue;
              }

              // Enhanced filtering - exclude obvious non-photos
              const srcLower = src.toLowerCase();

              if (
                srcLower.includes('logo') ||
                srcLower.includes('icon') ||
                srcLower.includes('button') ||
                srcLower.includes('banner') ||
                srcLower.includes('avatar') ||
                srcLower.includes('maps.googleapis.com') ||
                srcLower.includes('maps.google.com') ||
                srcLower.includes('googleusercontent.com') ||
                srcLower.includes('gstatic.com') ||
                srcLower.includes('tile') ||
                srcLower.includes('streetview') ||
                (htmlImg.width > 0 && htmlImg.width < 200) ||
                (htmlImg.height > 0 && htmlImg.height < 150)
              ) {
                continue;
              }

              const isSparkCDN =
                srcLower.includes('cdn.resize.sparkplatform.com') ||
                srcLower.includes('cdn.assets.flexmls.com');

              if (isSparkCDN) {
                images.push({
                  url: src,
                  alt: htmlImg.alt || undefined,
                  title: htmlImg.title || undefined,
                  width:
                    htmlImg.naturalWidth || htmlImg.width || undefined,
                  height:
                    htmlImg.naturalHeight || htmlImg.height || undefined,
                  size: 'large' as const,
                });
              } else {
                images.push({
                  url: src,
                  alt: htmlImg.alt || undefined,
                  title: htmlImg.title || undefined,
                  width:
                    htmlImg.naturalWidth || htmlImg.width || undefined,
                  height:
                    htmlImg.naturalHeight || htmlImg.height || undefined,
                  size: 'large' as const,
                });
              }

              seenUrls.add(src);
              seenImageIds.add(imageId);
            }
          } catch (e) {
            continue;
          }
        }

        // Filter to only return Spark CDN images (property photos) if available
        const sparkImages = images.filter(
          (img) =>
            img.url.toLowerCase().includes('cdn.resize.sparkplatform.com') ||
            img.url.toLowerCase().includes('cdn.assets.flexmls.com'),
        );

        return sparkImages.length > 0 ? sparkImages : images;
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

        // Extract property description
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
              return match[1].trim().substring(0, 500);
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

          return possibleDescription ? possibleDescription.substring(0, 500) : '';
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

  /**
   * Extracts basic property information directly from the URL without scraping.
   * Implements IPropertyParser.extractAddressFromUrl() interface method.
   *
   * @param url - The FlexMLS share URL
   * @returns Object containing shareId and address details
   * @throws Error if URL format is invalid
   */
  extractAddressFromUrl(url: string) {
    return this.parseFlexMLSUrl(url);
  }

  /**
   * Parses a FlexMLS URL to extract address and share ID information.
   *
   * @param url - The FlexMLS share URL
   * @returns Object containing shareId and address details
   * @throws Error if URL format is invalid
   */
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
      let city = parts[parts.length - 3];
      const streetAddress = parts.slice(0, parts.length - 3).join(' ');

      // Clean up city name
      city = city.replace(/\d{5}(-\d{4})?$/, '').trim();

      let fullAddress = `${streetAddress}, ${city}, ${state} ${zipCode}`;

      // Remove duplicate city names
      if (city) {
        const escapedCity = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const cityConsecutiveRegex = new RegExp(
          `(${escapedCity}[,\\s]+)+${escapedCity}`,
          'gi',
        );
        fullAddress = fullAddress.replace(cityConsecutiveRegex, city);

        const cityOccurrences = (
          fullAddress.match(new RegExp(escapedCity, 'gi')) || []
        ).length;
        if (cityOccurrences > 1) {
          const addressParts = fullAddress.split(',').map((part) => part.trim());
          const uniqueParts: string[] = [];
          let seenCity = false;

          for (const part of addressParts) {
            if (part.toLowerCase() === city.toLowerCase()) {
              if (!seenCity) {
                uniqueParts.push(part);
                seenCity = true;
              }
            } else {
              uniqueParts.push(part);
            }
          }
          fullAddress = uniqueParts.join(', ');
        }
      }

      // Clean up formatting
      fullAddress = fullAddress
        .replace(/,\s*,/g, ',')
        .replace(/\s*,\s*/g, ', ')
        .replace(/\s+/g, ' ')
        .trim();

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
      throw new Error(`Failed to parse FlexMLS URL: ${error.message}`);
    }
  }
}

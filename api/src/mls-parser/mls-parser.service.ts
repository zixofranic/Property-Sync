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
    // Initialize browser on Railway - Railway handles Puppeteer better than Vercel
    await this.initBrowser();
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  // Temporary test method to verify browser initialization
  async testBrowserConnection(): Promise<{ success: boolean; message: string; platform: string }> {
    try {
      if (!this.browser) {
        return { success: false, message: 'Browser not initialized', platform: process.platform };
      }

      const page = await this.browser.newPage();
      await page.goto('https://www.google.com', { waitUntil: 'networkidle2', timeout: 10000 });
      const title = await page.title();
      await page.close();

      return { 
        success: true, 
        message: `Browser test successful. Page title: ${title}`, 
        platform: process.platform 
      };
    } catch (error) {
      this.logger.error('Browser test failed:', error.message);
      return { 
        success: false, 
        message: `Browser test failed: ${error.message}`, 
        platform: process.platform 
      };
    }
  }

  private async initBrowser(): Promise<void> {
    try {
      const isWindows = process.platform === 'win32';
      
      // Different configurations for local vs production
      this.browser = await puppeteer.launch({
        headless: true, // Keep headless for both platforms
        args: isWindows ? [
          // Windows-compatible configuration
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--no-first-run',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows'
        ] : [
          // Linux/production configuration
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--memory-pressure-off'
        ],
        ignoreDefaultArgs: ['--disable-extensions'],
        timeout: 30000,
      });
      this.logger.log(`Browser initialized successfully for MLS parsing (${isWindows ? 'Windows' : 'Linux'} mode)`);
    } catch (error) {
      this.logger.error('Failed to initialize browser:', error);
      // Don't throw error - allow API to continue without MLS parsing
      this.browser = null;
    }
  }

  // Single URL parsing method
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

    // Check if browser is still connected, reinitialize if needed
    try {
      const version = await this.browser!.version();
    } catch (error) {
      this.logger.warn('Browser disconnected, reinitializing...');
      this.browser = null;
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

    // Check if browser is still connected, reinitialize if needed
    try {
      const version = await this.browser!.version();
    } catch (error) {
      this.logger.warn('Browser disconnected, reinitializing...');
      this.browser = null;
      await this.initBrowser();
    }

    const page = await this.browser!.newPage();

    try {
      this.logger.log(`🚀 Starting to parse URL: ${shareUrl}`);
      
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      );
      await page.setViewport({ width: 1920, height: 1080 });

      this.logger.log(`📡 Navigating to URL...`);
      const response = await page.goto(shareUrl, {
        waitUntil: 'domcontentloaded', // Faster than networkidle0
        timeout: 30000, // Increased timeout
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
                combinedKeys: jsonData.combined ? Object.keys(jsonData.combined) : null,
                totalItems: jsonData.combined?.All ? jsonData.combined.All.length : 0,
                hasVideos: jsonData.combined?.Videos ? jsonData.combined.Videos.length : 0,
                hasFloorPlans: jsonData.combined?.FloorPlans ? jsonData.combined.FloorPlans.length : 0,
                hasDocuments: jsonData.combined?.Documents ? jsonData.combined.Documents.length : 0,
                otherSections: Object.keys(jsonData).filter(k => k !== 'combined')
              };
            } catch (e) {
              jsonStructure = { error: 'Failed to parse JSON' };
            }
          }
          
          return {
            exists: !!element,
            hasContent: !!(element && element.textContent),
            contentLength: element ? (element.textContent?.length || 0) : 0,
            structure: jsonStructure
          };
        });
        
        this.logger.log(`📋 Original URL JSON check:`);
        this.logger.log(`   Element exists: ${originalJsonCheck.exists}`);
        this.logger.log(`   Has content: ${originalJsonCheck.hasContent}`);
        this.logger.log(`   Content length: ${originalJsonCheck.contentLength}`);
        
        if (originalJsonCheck.structure) {
          this.logger.log(`📊 JSON Structure on Original URL:`);
          this.logger.log(`   Top level keys: ${JSON.stringify(originalJsonCheck.structure.topLevelKeys)}`);
          this.logger.log(`   Combined keys: ${JSON.stringify(originalJsonCheck.structure.combinedKeys)}`);
          this.logger.log(`   Total media items: ${originalJsonCheck.structure.totalItems}`);
          this.logger.log(`   Videos: ${originalJsonCheck.structure.hasVideos}`);
          this.logger.log(`   Floor plans: ${originalJsonCheck.structure.hasFloorPlans}`);
          this.logger.log(`   Documents: ${originalJsonCheck.structure.hasDocuments}`);
          this.logger.log(`   Other sections: ${JSON.stringify(originalJsonCheck.structure.otherSections)}`);
        }
        
        // If JSON found on original, stay there and skip gallery interaction
        if (originalJsonCheck.exists && originalJsonCheck.hasContent) {
          this.logger.log(`✅ JSON found on original URL, extracting data directly without gallery interaction`);
          
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
          '.rsContainer', // Based on your HTML showing 'rs' prefixed classes
          '.rsNav',
          '.rsThumbsContainer'
        ];
        
        let galleryFound = false;
        for (const selector of gallerySelectors) {
          const elements = await page.$$(selector);
          if (elements.length > 0) {
            this.logger.log(`✅ Found gallery container: ${selector} (${elements.length} elements)`);
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
              '.rsThumb'
            ];
            
            for (const navSelector of navSelectors) {
              const navElements = await page.$$(navSelector);
              if (navElements.length > 0) {
                this.logger.log(`🔍 Found ${navElements.length} navigation elements: ${navSelector}`);
                
                // If it's an arrow, try clicking it to advance through gallery
                if (navSelector.includes('Arrow') || navSelector.includes('next')) {
                  try {
                    await page.click(navSelector);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    this.logger.log(`➡️ Clicked navigation: ${navSelector}`);
                  } catch (e) {
                    this.logger.log(`⚠️ Could not click navigation: ${navSelector}`);
                  }
                }
              }
            }
            
            // Try to trigger thumbnail loading by scrolling through the thumbnail container
            try {
              const thumbsContainer = await page.$('.rsThumbsContainer');
              if (thumbsContainer) {
                this.logger.log(`📱 Found thumbnail container, trying to scroll and trigger loading...`);
                
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
                await new Promise(resolve => setTimeout(resolve, 3000));
                this.logger.log(`🔄 Scrolled thumbnails container and waited for loading`);
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
          this.logger.log(`ℹ️ No gallery or clickable photo found - parsing current view`);
        }
        
      } catch (error) {
        this.logger.log(`ℹ️ Error accessing gallery - continuing with parsing: ${error.message}`);
      }

      this.logger.log(`🔍 Starting data extraction...`);
      
      // Check for JSON data element and explore its structure
      const jsonElementExists = await page.evaluate(() => {
        const element = document.querySelector('#tagged_listing_media');
        let jsonStructure: any = null;
        
        if (element && element.textContent) {
          try {
            const jsonData = JSON.parse(element.textContent);
            jsonStructure = {
              topLevelKeys: Object.keys(jsonData),
              combinedKeys: jsonData.combined ? Object.keys(jsonData.combined) : null,
              totalItems: jsonData.combined?.All ? jsonData.combined.All.length : 0,
              hasVideos: jsonData.combined?.Videos ? jsonData.combined.Videos.length : 0,
              hasFloorPlans: jsonData.combined?.FloorPlans ? jsonData.combined.FloorPlans.length : 0,
              hasDocuments: jsonData.combined?.Documents ? jsonData.combined.Documents.length : 0,
              otherSections: Object.keys(jsonData).filter(k => k !== 'combined')
            };
          } catch (e) {
            jsonStructure = { error: 'Failed to parse JSON' };
          }
        }
        
        return {
          exists: !!element,
          hasContent: !!(element && element.textContent),
          contentLength: element ? (element.textContent?.length || 0) : 0,
          innerHTML: element ? element.innerHTML.substring(0, 200) : null,
          structure: jsonStructure
        };
      });
      
      this.logger.log(`📋 JSON element check:`);
      this.logger.log(`   Element exists: ${jsonElementExists.exists}`);
      this.logger.log(`   Has content: ${jsonElementExists.hasContent}`);
      this.logger.log(`   Content length: ${jsonElementExists.contentLength}`);
      
      if (jsonElementExists.structure) {
        this.logger.log(`📊 JSON Structure Analysis:`);
        this.logger.log(`   Top level keys: ${JSON.stringify(jsonElementExists.structure.topLevelKeys)}`);
        this.logger.log(`   Combined keys: ${JSON.stringify(jsonElementExists.structure.combinedKeys)}`);
        this.logger.log(`   Total media items: ${jsonElementExists.structure.totalItems}`);
        this.logger.log(`   Videos: ${jsonElementExists.structure.hasVideos}`);
        this.logger.log(`   Floor plans: ${jsonElementExists.structure.hasFloorPlans}`);
        this.logger.log(`   Documents: ${jsonElementExists.structure.hasDocuments}`);
        this.logger.log(`   Other sections: ${JSON.stringify(jsonElementExists.structure.otherSections)}`);
      }
      
      if (jsonElementExists.innerHTML) {
        this.logger.log(`   Content preview: ${jsonElementExists.innerHTML}...`);
      }
      
      // Debug: Let's see what HTML elements are actually on the page
      const pageDebugInfo = await page.evaluate(() => {
        const allImages = document.querySelectorAll('img');
        const allImagesInfo = Array.from(allImages).map(img => ({
          src: img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src'),
          alt: img.alt,
          className: img.className,
          width: img.width,
          height: img.height
        }));
        
        // Check for background images more thoroughly
        const allElements = document.querySelectorAll('*');
        const divWithBgImages = Array.from(allElements).filter(el => {
          const style = window.getComputedStyle(el);
          return style.backgroundImage && style.backgroundImage !== 'none' && !style.backgroundImage.includes('data:image');
        }).map(el => ({
          backgroundImage: window.getComputedStyle(el).backgroundImage,
          className: el.className,
          tagName: el.tagName
        }));
        
        // Specifically look for gallery thumbnail classes
        const galleryThumbs = document.querySelectorAll('.rsTmb, .rsThumb, .rsNavItem, [class*="thumb"], [class*="photo"]');
        const thumbInfo = Array.from(galleryThumbs).map(el => ({
          className: el.className,
          backgroundImage: window.getComputedStyle(el).backgroundImage,
          tagName: el.tagName,
          hasStyle: el.getAttribute('style')
        }));
        
        return {
          totalImages: allImages.length,
          imageDetails: allImagesInfo.slice(0, 10), // First 10 for debugging
          backgroundImages: divWithBgImages.slice(0, 5),
          galleryThumbs: thumbInfo
        };
      });
      
      this.logger.log(`🔍 Page Debug Info:`);
      this.logger.log(`   Total <img> elements found: ${pageDebugInfo.totalImages}`);
      this.logger.log(`   Background images found: ${pageDebugInfo.backgroundImages.length}`);
      
      if (pageDebugInfo.imageDetails.length > 0) {
        this.logger.log(`📸 First few image elements:`);
        pageDebugInfo.imageDetails.forEach((img, idx) => {
          this.logger.log(`   ${idx + 1}. src: ${img.src || 'none'} | alt: ${img.alt || 'none'} | class: ${img.className || 'none'}`);
        });
      }
      
      if (pageDebugInfo.backgroundImages.length > 0) {
        this.logger.log(`🖼️ Background images:`);
        pageDebugInfo.backgroundImages.forEach((bg, idx) => {
          this.logger.log(`   ${idx + 1}. ${bg.backgroundImage} | class: ${bg.className || 'none'} | tag: ${bg.tagName}`);
        });
      }
      
      if (pageDebugInfo.galleryThumbs.length > 0) {
        this.logger.log(`📷 Gallery thumbnails found:`);
        pageDebugInfo.galleryThumbs.forEach((thumb, idx) => {
          this.logger.log(`   ${idx + 1}. class: ${thumb.className || 'none'} | bg: ${thumb.backgroundImage} | style: ${thumb.hasStyle || 'none'}`);
        });
      }
      
      const extractedData = await this.extractEnhancedData(page);
      this.logger.log(`✅ Data extraction completed. Images found: ${extractedData.images?.length || 0}`);
      
      // Log each image URL for debugging duplicates
      if (extractedData.images?.length) {
        this.logger.log(`📸 Image URLs found:`);
        extractedData.images.forEach((img, idx) => {
          this.logger.log(`   ${idx + 1}. ${img.url.substring(0, 150)}...`);
        });
      }
      
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

      // Extract images from FlexMLS JSON data structure
      const extractImages = (): ImageData[] => {
        const images: ImageData[] = [];
        const seenUrls = new Set<string>();
        const seenImageIds = new Set<string>();

        // First try to extract from the hidden JSON data
        const jsonDataElement = document.querySelector('#tagged_listing_media');
        console.log('JSON element found:', !!jsonDataElement);
        console.log('JSON element has content:', !!(jsonDataElement && jsonDataElement.textContent));
        
        if (jsonDataElement && jsonDataElement.textContent) {
          console.log('JSON content length:', jsonDataElement.textContent.length);
          try {
            const jsonData = JSON.parse(jsonDataElement.textContent);
            
            // Log the JSON structure for exploration
            console.log('=== JSON DATA STRUCTURE ===');
            console.log('Top level keys:', Object.keys(jsonData));
            
            if (jsonData.combined) {
              console.log('Combined keys:', Object.keys(jsonData.combined));
              if (jsonData.combined.All) {
                console.log('All array length:', jsonData.combined.All.length);
                
                // Sample the first item to see its structure
                if (jsonData.combined.All.length > 0) {
                  const firstItem = jsonData.combined.All[0];
                  console.log('First item keys:', Object.keys(firstItem));
                  console.log('First item sample:', JSON.stringify(firstItem, null, 2).substring(0, 500) + '...');
                }
              }
            }
            
            // Look for other data sections
            Object.keys(jsonData).forEach(key => {
              if (key !== 'combined') {
                console.log(`Other data section "${key}":`, typeof jsonData[key], Array.isArray(jsonData[key]) ? `(${jsonData[key].length} items)` : '');
              }
            });
            
            if (jsonData.combined && jsonData.combined.All) {
              console.log('Processing', jsonData.combined.All.length, 'media items');
              jsonData.combined.All.forEach((item: any) => {
                if (item.html) {
                  // Extract both high-res and thumbnail URLs from the HTML
                  const imgMatch = item.html.match(/src="([^"]+)"/);
                  const bgMatch = item.html.match(/background-image:\s*url\('([^']+)'\)/);
                  const altMatch = item.html.match(/alt="([^"]+)"/);
                  
                  // Only keep high-resolution images, skip thumbnails
                  if (imgMatch && imgMatch[1]) {
                    const src = imgMatch[1];
                    
                    // Filter: Only keep high-res images (with resize path and dimensions)
                    const isHighRes = src.includes('cdn.resize.sparkplatform.com') && 
                                     src.match(/\/\d+x\d+\//); // Has dimensions like /1280x1024/
                    
                    if (isHighRes) {
                      const imageId = src.match(/\/(\d{26}-[a-z]\.jpg)/i)?.[1] || src;
                      
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
                  
                  // Skip thumbnail background images - we only want high-res
                }
              });
            }
          } catch (e) {
            console.log('Failed to parse JSON data:', e.message, 'falling back to DOM extraction');
          }
        } else {
          console.log('JSON element not found or empty, checking for alternative selectors...');
          
          // Try alternative selectors for the JSON data
          const altSelectors = [
            '[id*="media"]',
            '[id*="listing"]', 
            '[id*="tagged"]',
            'script[type="application/json"]',
            'div[hidden]'
          ];
          
          for (const selector of altSelectors) {
            const elements = document.querySelectorAll(selector);
            console.log(`Found ${elements.length} elements with selector: ${selector}`);
            if (elements.length > 0) {
              Array.from(elements).forEach((el, idx) => {
                console.log(`  ${idx + 1}. id: ${el.id || 'none'}, classes: ${el.className || 'none'}`);
              });
            }
          }
        }
        
        // If we got images from JSON, return them
        if (images.length > 0) {
          console.log(`Successfully extracted ${images.length} high-resolution images from JSON`);
          return images;
        }

        // Fallback: COMPREHENSIVE background image extraction from DOM
        const allElements = document.querySelectorAll('*'); // Check every element
        
        allElements.forEach(el => {
          const bgImage = window.getComputedStyle(el).backgroundImage;
          if (bgImage && bgImage !== 'none') {
            // Extract URL from background-image: url('...')
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
              const imageId = src.match(/\/(\d{26}\.jpg)/i)?.[1] || 
                             src.match(/\/([^/]+\.(jpg|jpeg|png|webp))/i)?.[1] || src;
              
              if (!seenUrls.has(src) && !seenImageIds.has(imageId)) {
                images.push({
                  url: src,
                  alt: el.getAttribute('alt') || el.getAttribute('aria-label') || el.getAttribute('title') || undefined,
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
          
          // Also check for video elements and video thumbnails
          if (el.tagName === 'VIDEO') {
            const poster = el.getAttribute('poster');
            const src = el.getAttribute('src') || el.querySelector('source')?.getAttribute('src');
            
            if (poster && !seenUrls.has(poster)) {
              images.push({
                url: poster,
                alt: 'Video thumbnail',
                title: 'Video poster frame',
                width: undefined,
                height: undefined,
                size: 'large' as const,
              });
              seenUrls.add(poster);
            }
            
            if (src && !seenUrls.has(src)) {
              images.push({
                url: src,
                alt: 'Video file',
                title: 'Property video',
                width: undefined,
                height: undefined,
                size: 'large' as const,
              });
              seenUrls.add(src);
            }
          }
        });

        // Multiple selectors for regular image tags
        const imageSelectors = [
          // FlexMLS specific selectors
          'img[src*="flexmls"]',
          'img[data-src*="flexmls"]',
          
          // Gallery and photo containers
          '.gallery img',
          '.photos img',
          '.property-photos img',
          '.listing-photos img',
          '.image-gallery img',
          '.photo-gallery img',
          
          // Generic property images
          '.property-image img',
          'img[src*="photo"]',
          'img[src*="image"]',
          'img[src*="listing"]',
          
          // Backup - any image with http/https
          'img[src*="http"]',
        ];

        // Try each selector and collect all unique images
        for (const selector of imageSelectors) {
          try {
            const imageElements = document.querySelectorAll(selector);

            for (const img of Array.from(imageElements)) {
              const htmlImg = img as HTMLImageElement;
              let src = htmlImg.src || htmlImg.getAttribute('data-src') || htmlImg.getAttribute('data-lazy-src');

              if (!src) continue;

              // Skip URL duplicates
              if (seenUrls.has(src)) continue;
              
              // Extract image ID from Spark CDN URLs to prevent resolution duplicates
              const extractImageId = (url: string): string => {
                const match = url.match(/\/(\d{26}-[a-z]\.jpg)/i);
                return match ? match[1] : url;
              };
              
              const imageId = extractImageId(src);
              const currentResolution = src.match(/\/(\d+x\d+)\//)?.[1] || '0x0';
              
              // Skip if we've seen this image ID before, unless this is a higher resolution
              if (seenImageIds.has(imageId)) {
                const existingIndex = images.findIndex(img => extractImageId(img.url) === imageId);
                if (existingIndex !== -1) {
                  const existingResolution = images[existingIndex].url.match(/\/(\d+x\d+)\//)?.[1] || '0x0';
                  const [currentW, currentH] = currentResolution.split('x').map(Number);
                  const [existingW, existingH] = existingResolution.split('x').map(Number);
                  
                  if (currentW * currentH > existingW * existingH) {
                    images.splice(existingIndex, 1);
                    seenUrls.delete(images[existingIndex]?.url || '');
                  } else {
                    continue;
                  }
                }
              }

              // Enhanced filtering - exclude obvious non-photos
              const srcLower = src.toLowerCase();
              const altText = (htmlImg.alt || '').toLowerCase();
              
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
              
              const isSparkCDN = srcLower.includes('cdn.resize.sparkplatform.com') || 
                                srcLower.includes('cdn.assets.flexmls.com');
              const isPropertyPhoto = altText.includes('photo') && 
                                    (altText.includes(' photo ') || /photo\s+[a-z]/.test(altText));
              
              if (isSparkCDN && isPropertyPhoto) {
                images.unshift({
                  url: src,
                  alt: htmlImg.alt || undefined,
                  title: htmlImg.title || undefined,
                  width: htmlImg.naturalWidth || htmlImg.width || undefined,
                  height: htmlImg.naturalHeight || htmlImg.height || undefined,
                  size: 'large' as const,
                });
              } else {
                images.push({
                  url: src,
                  alt: htmlImg.alt || undefined,
                  title: htmlImg.title || undefined,
                  width: htmlImg.naturalWidth || htmlImg.width || undefined,
                  height: htmlImg.naturalHeight || htmlImg.height || undefined,
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
        const sparkImages = images.filter(img => 
          img.url.toLowerCase().includes('cdn.resize.sparkplatform.com') ||
          img.url.toLowerCase().includes('cdn.assets.flexmls.com')
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
      let city = parts[parts.length - 3];
      const streetAddress = parts.slice(0, parts.length - 3).join(' ');

      // Clean up city name - remove any zip code that might already be included
      city = city.replace(/\d{5}(-\d{4})?$/, '').trim();
      
      // Clean up any duplicate zip codes or city names in the full address
      let fullAddress = `${streetAddress}, ${city}, ${state} ${zipCode}`;
      
      // Remove duplicate city names - more specific pattern
      if (city) {
        const escapedCity = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape special regex chars
        const cityDuplicateRegex = new RegExp(`(${escapedCity}[,\\s]+)+${escapedCity}`, 'gi');
        fullAddress = fullAddress.replace(cityDuplicateRegex, city);
      }
      
      // Remove duplicate zip codes - more specific pattern
      if (zipCode) {
        const zipDuplicateRegex = new RegExp(`(${zipCode}[,\\s]+)+${zipCode}`, 'g');
        fullAddress = fullAddress.replace(zipDuplicateRegex, zipCode);
      }
      
      // Clean up any extra commas, spaces, and normalize formatting
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

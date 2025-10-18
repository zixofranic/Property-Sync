import { Injectable, Logger } from '@nestjs/common';

/**
 * Enum representing different property listing site types.
 * Each type corresponds to a specific parser implementation.
 */
export enum SiteType {
  /** FlexMLS share URLs (https://www.flexmls.com/share/*) */
  FLEXMLS = 'FLEXMLS',

  /** Zillow property listings (https://www.zillow.com/homedetails/*) */
  ZILLOW = 'ZILLOW',

  /** Realtor.com property listings (https://www.realtor.com/realestateandhomes-detail/*) */
  REALTOR = 'REALTOR',

  /** Trulia property listings (https://www.trulia.com/p/*) */
  TRULIA = 'TRULIA',

  /** Unknown or unsupported site type */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Service responsible for detecting which property listing site a URL belongs to.
 * Uses regex pattern matching to identify the site type.
 *
 * @example
 * ```typescript
 * const siteType = this.siteDetector.detectSite('https://www.flexmls.com/share/abc123/...');
 * // Returns: SiteType.FLEXMLS
 * ```
 */
@Injectable()
export class SiteDetectorService {
  private readonly logger = new Logger(SiteDetectorService.name);

  /**
   * URL patterns for each supported site type.
   * Patterns are tested in order, so more specific patterns should come first.
   */
  private readonly sitePatterns: Array<{ type: SiteType; pattern: RegExp }> = [
    {
      type: SiteType.FLEXMLS,
      pattern: /^https?:\/\/(www\.)?flexmls\.com\/share\/.+/i,
    },
    {
      type: SiteType.ZILLOW,
      pattern: /^https?:\/\/(www\.)?zillow\.com\/homedetails\/.+/i,
    },
    {
      type: SiteType.REALTOR,
      pattern: /^https?:\/\/(www\.)?realtor\.com\/realestateandhomes-detail\/.+/i,
    },
    {
      type: SiteType.TRULIA,
      pattern: /^https?:\/\/(www\.)?trulia\.com\/(p|home)\/.+/i,
    },
  ];

  /**
   * Detects the site type for a given URL.
   *
   * @param url - The property listing URL to analyze
   * @returns The detected SiteType, or SiteType.UNKNOWN if not recognized
   */
  detectSite(url: string): SiteType {
    // Validate URL format
    if (!this.isValidUrl(url)) {
      this.logger.warn(`Invalid URL format: ${url}`);
      return SiteType.UNKNOWN;
    }

    // Check against each pattern
    for (const { type, pattern } of this.sitePatterns) {
      if (pattern.test(url)) {
        this.logger.log(`Detected site type ${type} for URL: ${url}`);
        return type;
      }
    }

    // No match found
    this.logger.warn(`Unsupported site URL: ${url}`);
    return SiteType.UNKNOWN;
  }

  /**
   * Validates that a string is a properly formatted URL.
   *
   * @param url - The string to validate
   * @returns True if valid URL, false otherwise
   */
  private isValidUrl(url: string): boolean {
    if (!url || typeof url !== 'string') {
      return false;
    }

    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Checks if a URL is from a supported site type.
   *
   * @param url - The URL to check
   * @returns True if the URL is from a supported site, false otherwise
   */
  isSupportedSite(url: string): boolean {
    return this.detectSite(url) !== SiteType.UNKNOWN;
  }

  /**
   * Gets a human-readable name for a site type.
   *
   * @param siteType - The SiteType to get name for
   * @returns The human-readable site name
   */
  getSiteName(siteType: SiteType): string {
    const names: Record<SiteType, string> = {
      [SiteType.FLEXMLS]: 'FlexMLS',
      [SiteType.ZILLOW]: 'Zillow',
      [SiteType.REALTOR]: 'Realtor.com',
      [SiteType.TRULIA]: 'Trulia',
      [SiteType.UNKNOWN]: 'Unknown',
    };

    return names[siteType] || 'Unknown';
  }
}

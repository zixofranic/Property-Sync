import { ParsedMLSProperty } from './mls-property.interface';

/**
 * Base interface that all property site parsers must implement.
 * This interface defines the contract for parsing property data from different listing sites.
 *
 * @example
 * ```typescript
 * class FlexmlsParser implements IPropertyParser {
 *   canHandle(url: string): boolean {
 *     return url.includes('flexmls.com');
 *   }
 *
 *   async parse(url: string): Promise<ParsedMLSProperty> {
 *     // Implementation
 *   }
 *
 *   getParserName(): string {
 *     return 'FlexMLS';
 *   }
 *
 *   getConfidence(url: string): number {
 *     return this.canHandle(url) ? 1.0 : 0.0;
 *   }
 * }
 * ```
 */
export interface IPropertyParser {
  /**
   * Determines if this parser can handle the given URL.
   *
   * @param url - The property listing URL to check
   * @returns True if this parser can handle the URL, false otherwise
   */
  canHandle(url: string): boolean;

  /**
   * Parses a property listing URL and extracts structured data.
   *
   * @param url - The property listing URL to parse
   * @returns Promise resolving to parsed property data
   * @throws Error if parsing fails or URL cannot be handled
   */
  parse(url: string): Promise<ParsedMLSProperty>;

  /**
   * Returns the name of this parser for logging and debugging purposes.
   *
   * @returns The parser name (e.g., "FlexMLS", "Zillow", "Realtor.com")
   */
  getParserName(): string;

  /**
   * Returns a confidence score (0-1) indicating how well this parser
   * can handle the given URL. Higher scores indicate better matches.
   *
   * This is useful when multiple parsers might claim to handle a URL,
   * allowing the factory to select the most appropriate one.
   *
   * @param url - The property listing URL to evaluate
   * @returns Confidence score between 0.0 (cannot handle) and 1.0 (perfect match)
   */
  getConfidence(url: string): number;

  /**
   * Extracts basic property information directly from the URL without scraping.
   * This is used for instant property creation before full parsing.
   *
   * Most listing sites include the address in the URL slug, allowing us to
   * extract it without browser automation or API calls.
   *
   * @param url - The property listing URL
   * @returns Object containing shareId/propertyId and address details
   * @throws Error if URL format is invalid
   *
   * @example
   * ```typescript
   * // FlexMLS: /share/Ct3N6/2508-Boulevard-Napoleon-Louisville-KY-40205
   * // Zillow: /homedetails/2508-Boulevard-Napoleon-Louisville-KY-40205/73469419_zpid/
   * // Returns: { shareId: '...', address: { street, city, state, zipCode, full } }
   * ```
   */
  extractAddressFromUrl(url: string): {
    shareId: string;
    address: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      full?: string;
    };
  };
}

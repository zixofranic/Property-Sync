import { Injectable, Logger } from '@nestjs/common';
import { IPropertyParser } from './interfaces/base-parser.interface';
import { SiteDetectorService, SiteType } from './site-detector.service';
import { FlexmlsParser } from './parsers/flexmls.parser';
import { ZillowParser } from './parsers/zillow.parser';
import { RealtorParser } from './parsers/realtor.parser';
import { TruliaParser } from './parsers/trulia.parser';

/**
 * Factory service responsible for routing URLs to appropriate parsers.
 * Maintains a registry of available parsers and selects the best one for each URL.
 *
 * This service uses the site detector to identify the site type and then
 * delegates parsing to the appropriate parser implementation.
 *
 * @example
 * ```typescript
 * const parser = this.parserFactory.getParser('https://www.flexmls.com/share/...');
 * if (parser) {
 *   const data = await parser.parse(url);
 * }
 * ```
 */
@Injectable()
export class ParserFactoryService {
  private readonly logger = new Logger(ParserFactoryService.name);

  /**
   * Registry mapping site types to parser instances.
   */
  private readonly parserRegistry: Map<SiteType, IPropertyParser>;

  constructor(
    private readonly siteDetector: SiteDetectorService,
    private readonly flexmlsParser: FlexmlsParser,
    private readonly zillowParser: ZillowParser,
    private readonly realtorParser: RealtorParser,
    private readonly truliaParser: TruliaParser,
  ) {
    // Initialize parser registry
    this.parserRegistry = new Map<SiteType, IPropertyParser>();

    // Register available parsers
    this.registerParser(SiteType.FLEXMLS, this.flexmlsParser);
    this.registerParser(SiteType.ZILLOW, this.zillowParser);
    this.registerParser(SiteType.REALTOR, this.realtorParser);
    this.registerParser(SiteType.TRULIA, this.truliaParser);

    this.logger.log(
      `Parser factory initialized with ${this.parserRegistry.size} registered parsers`,
    );
  }

  /**
   * Registers a parser for a specific site type.
   *
   * @param siteType - The site type this parser handles
   * @param parser - The parser instance
   */
  private registerParser(siteType: SiteType, parser: IPropertyParser): void {
    this.parserRegistry.set(siteType, parser);
    this.logger.log(
      `Registered parser: ${parser.getParserName()} for site type: ${siteType}`,
    );
  }

  /**
   * Gets the appropriate parser for a given URL.
   *
   * Uses the site detector to identify the site type, then returns
   * the corresponding parser from the registry.
   *
   * @param url - The property listing URL
   * @returns The appropriate parser instance, or null if no parser available
   */
  getParser(url: string): IPropertyParser | null {
    // Detect site type
    const siteType = this.siteDetector.detectSite(url);

    if (siteType === SiteType.UNKNOWN) {
      this.logger.warn(`No parser available for URL: ${url}`);
      return null;
    }

    // Get parser from registry
    const parser = this.parserRegistry.get(siteType);

    if (!parser) {
      this.logger.warn(
        `Site type ${siteType} detected but no parser registered for URL: ${url}`,
      );
      return null;
    }

    // Verify parser can handle the URL
    if (!parser.canHandle(url)) {
      this.logger.warn(
        `Parser ${parser.getParserName()} cannot handle URL despite matching site type: ${url}`,
      );
      return null;
    }

    const confidence = parser.getConfidence(url);
    this.logger.log(
      `Selected parser: ${parser.getParserName()} for URL: ${url} (confidence: ${confidence.toFixed(2)})`,
    );

    return parser;
  }

  /**
   * Gets a parser by site type directly.
   * Useful when you already know the site type.
   *
   * @param siteType - The site type
   * @returns The parser instance, or null if not registered
   */
  getParserBySiteType(siteType: SiteType): IPropertyParser | null {
    return this.parserRegistry.get(siteType) || null;
  }

  /**
   * Checks if a URL can be parsed by any registered parser.
   *
   * @param url - The URL to check
   * @returns True if a parser is available, false otherwise
   */
  canParse(url: string): boolean {
    return this.getParser(url) !== null;
  }

  /**
   * Gets all registered parsers.
   *
   * @returns Array of all registered parser instances
   */
  getAllParsers(): IPropertyParser[] {
    return Array.from(this.parserRegistry.values());
  }

  /**
   * Gets the names of all registered parsers.
   *
   * @returns Array of parser names
   */
  getRegisteredParserNames(): string[] {
    return this.getAllParsers().map((parser) => parser.getParserName());
  }

  /**
   * Gets statistics about registered parsers.
   *
   * @returns Object with parser statistics
   */
  getParserStats(): {
    totalParsers: number;
    registeredSiteTypes: SiteType[];
    parserNames: string[];
  } {
    return {
      totalParsers: this.parserRegistry.size,
      registeredSiteTypes: Array.from(this.parserRegistry.keys()),
      parserNames: this.getRegisteredParserNames(),
    };
  }
}

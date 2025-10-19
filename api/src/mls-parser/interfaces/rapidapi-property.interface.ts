/**
 * RapidAPI Property Interface
 *
 * Separate from ParsedMLSProperty - this is for RapidAPI's "Realty in US" API
 * which provides address-based property search, not URL scraping.
 */

export interface RapidAPIProperty {
  // Core identification
  property_id: string;
  listing_id?: string;

  // Address
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    full: string;
  };

  // Pricing
  pricing: {
    listPrice: string;        // Formatted: "$715,000"
    priceNumeric: number;     // Raw: 715000
    pricePerSqft?: number | null;
  };

  // Property details
  propertyDetails: {
    beds?: string;
    baths?: string;
    sqft?: string;
    yearBuilt?: string;
    lotSize?: string;
    propertyType?: string;
  };

  // Images
  images: string[];

  // Description
  description?: string;

  // Listing info
  listingInfo: {
    status?: string;
    listDate?: string;
    mlsNumber?: string;
  };

  // RapidAPI-specific enriched data
  rawData: {
    href?: string;
    permalink?: string;

    // Enriched data from RapidAPI
    tax_history?: any[];
    nearby_schools?: any[];
    flood_risk?: string;       // "minimal", "low", "moderate", "high"
    fire_risk?: string;        // "minimal", "low", "moderate", "high"
    noise_score?: number;      // 0-100
    last_sold_price?: number;
    last_sold_date?: string;
  };

  // Source tracking
  sourceUrl?: string;
  scrapedAt?: Date;
}

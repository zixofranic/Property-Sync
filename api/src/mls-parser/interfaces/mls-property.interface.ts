export interface ImageData {
  url: string;
  alt?: string;
  title?: string;
  width?: number;
  height?: number;
  size?: 'thumbnail' | 'medium' | 'large' | 'original';
}

export interface PriceData {
  listPrice: string;
  priceNumeric: number;
  pricePerSqft?: string;
  originalPrice?: string;
  priceReduction?: string;
}

export interface ParsedMLSProperty {
  shareId: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    full: string;
  };
  pricing: PriceData | null;
  images: ImageData[];
  propertyDetails: {
    beds?: string;
    baths?: string;
    sqft?: string;
    yearBuilt?: string;
    lotSize?: string;
    propertyType?: string;
  };
  listingInfo: {
    mlsNumber?: string;
    listingAgent?: string;
    listingOffice?: string;
    status?: string;
  };
  scrapedAt: Date;
  sourceUrl: string;
}

export interface ParseResult {
  success: boolean;
  data?: ParsedMLSProperty;
  error?: string;
  mlsUrl: string;
  isQuickParse?: boolean;
}

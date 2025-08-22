export class PropertyResponseDto {
  id: string;
  clientId: string; // Frontend expects this

  // 🆕 FRONTEND-COMPATIBLE FIELDS
  address: string; // Combined address string
  price: number;
  description: string;
  imageUrl: string; // Primary image (first from imageUrls array)
  mlsLink?: string; // Mapped from listingUrl
  addedAt: string; // ISO string format (mapped from createdAt)
  clientFeedback?: 'love' | 'like' | 'dislike'; // Latest feedback
  notes?: string; // Feedback notes
  isActive: boolean; // Frontend expects this

  // 🆕 ENHANCED BACKEND DATA (for future features)
  city?: string; // Keep detailed address parts
  state?: string;
  zipCode?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  propertyType?: string;
  imageUrls: string[]; // All images
  listingUrl?: string; // Original MLS link
  isHighlighted: boolean;
  position: number; // For sorting
  isViewed: boolean;
  viewedAt?: string; // ISO string format
  createdAt: string; // ISO string format
  updatedAt: string; // ISO string format
  loadingProgress: number; // 0-100 parsing progress
  isFullyParsed: boolean; // Whether property is fully parsed

  // 🆕 FEEDBACK DATA
  feedback?: {
    id: string;
    feedback: 'love' | 'like' | 'dislike';
    notes?: string;
    createdAt: string;
  };
}

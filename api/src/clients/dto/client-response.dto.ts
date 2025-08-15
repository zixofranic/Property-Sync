export class ClientResponseDto {
  id: string;
  
  // 🆕 FRONTEND-COMPATIBLE FIELDS
  name: string;                    // Combined firstName + lastName
  email: string;                   // Primary email
  phone?: string;
  avatar?: string;                 // Profile image URL
  propertiesViewed: number;        // Mapped from propertyCount
  lastActive: string;              // ISO string format for frontend
  engagementScore: number;         // Calculated engagement percentage
  status: 'active' | 'warm' | 'cold';  // Derived from activity/engagement
  createdAt: string;               // ISO string format
  
  // 🆕 SPOUSE EMAIL SUPPORT (for future release)
  spouseEmail?: string;            // Secondary email
  
  // 🆕 ENHANCED BACKEND STATS (for frontend display)
  totalViews: number;              // Keep for analytics
  avgResponseTime: number;         // Keep for analytics  
  feedbackRate: number;            // Keep for analytics
  lastActivity?: string;           // ISO string format
  
  // 🆕 BACKEND INTERNAL FIELDS (keep for admin/analytics)
  firstName: string;               // Keep for backend processing
  lastName: string;                // Keep for backend processing
  notes?: string;
  isActive: boolean;
  updatedAt: string;               // ISO string format
  
  // 🆕 TIMELINE DATA (frontend expects this structure)
  timeline?: {
    id: string;
    shareToken: string;
    isPublic: boolean;            // Mapped from timeline.isActive
    shareUrl: string;
    clientLoginCode: string;
    totalViews: number;
    lastViewed?: string;          // ISO string format
    propertyCount: number;
  };
}
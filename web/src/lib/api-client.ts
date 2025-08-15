// apps/web/src/lib/api-client.ts - ENHANCED API CLIENT WITH JWT MANAGEMENT
import { Client, Property, Timeline } from '@/stores/missionControlStore';

// 🔧 API Response Types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

export interface LoginResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    plan: string;
    emailVerified: boolean;
  };
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: string;
}

export interface ClientResponse {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  propertiesViewed: number;
  lastActive: string;
  engagementScore: number;
  status: 'active' | 'warm' | 'cold';
  createdAt: string;
  spouseEmail?: string;
  totalViews: number;
  avgResponseTime: number;
  feedbackRate: number;
  lastActivity?: string;
  firstName: string;
  lastName: string;
  notes?: string;
  isActive: boolean;
  updatedAt: string;
  timeline?: {
    id: string;
    shareToken: string;
    isPublic: boolean;
    shareUrl: string;
    clientLoginCode: string;
    totalViews: number;
    lastViewed?: string;
    propertyCount: number;
  };
}

export interface TimelineResponse {
  id: string;
  clientId: string;
  properties: Property[];
  createdAt: string;
  updatedAt: string;
  shareToken?: string;
  isPublic: boolean;
}

export interface AnalyticsDashboard {
  totalClients: number;
  totalProperties: number;
  totalViews: number;
  recentActivity: number;
  feedbackStats: {
    love: number;
    like: number;
    dislike: number;
  };
  activeTimelines: number;
}

// 🔒 Token Management Types
interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface QueuedRequest {
  url: string;
  options: RequestInit;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

class ApiClient {
  private baseUrl: string;
  private tokenData: TokenData | null = null;
  private isRefreshing: boolean = false;
  private requestQueue: QueuedRequest[] = [];
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  // Event callbacks for auth state changes
  private onAuthExpired: (() => void) | null = null;
  private onAuthRefreshed: ((user: LoginResponse['user']) => void) | null = null;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    // Initialize with stored tokens
    if (typeof window !== 'undefined') {
      this.loadStoredTokens();
    }
  }

  // 🔧 Token Management Methods
  private loadStoredTokens(): void {
    try {
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');
      const expiresAt = localStorage.getItem('tokenExpiresAt');

      if (accessToken && refreshToken && expiresAt) {
        this.tokenData = {
          accessToken,
          refreshToken,
          expiresAt: parseInt(expiresAt, 10),
        };
      }
    } catch (error) {
      console.warn('Failed to load stored tokens:', error);
      this.clearTokens();
    }
  }

  private storeTokens(loginResponse: LoginResponse): void {
    try {
      // Calculate expiry time based on expiresIn
      const expiresIn = this.parseExpiresIn(loginResponse.expiresIn);
      const expiresAt = Date.now() + (expiresIn * 1000);

      this.tokenData = {
        accessToken: loginResponse.accessToken,
        refreshToken: loginResponse.refreshToken,
        expiresAt,
      };

      localStorage.setItem('accessToken', loginResponse.accessToken);
      localStorage.setItem('refreshToken', loginResponse.refreshToken);
      localStorage.setItem('tokenExpiresAt', expiresAt.toString());
      localStorage.setItem('user', JSON.stringify(loginResponse.user));
    } catch (error) {
      console.error('Failed to store tokens:', error);
    }
  }

  private clearTokens(): void {
    try {
      this.tokenData = null;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('tokenExpiresAt');
      localStorage.removeItem('user');
    } catch (error) {
      console.warn('Failed to clear tokens:', error);
    }
  }

  private parseExpiresIn(expiresIn: string): number {
    // Convert "15m", "1h", "24h" etc to seconds
    const unit = expiresIn.slice(-1);
    const value = parseInt(expiresIn.slice(0, -1), 10);

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 900; // Default to 15 minutes
    }
  }

  private isTokenExpired(): boolean {
    if (!this.tokenData) return true;
    
    // Consider token expired if it expires within the next 30 seconds
    const buffer = 30 * 1000; // 30 seconds
    return Date.now() >= (this.tokenData.expiresAt - buffer);
  }

  private async refreshTokens(): Promise<boolean> {
    if (!this.tokenData?.refreshToken) {
      this.handleAuthExpired();
      return false;
    }

    if (this.isRefreshing) {
      // Wait for ongoing refresh
      return new Promise((resolve) => {
        const checkRefresh = () => {
          if (!this.isRefreshing) {
            resolve(!this.isTokenExpired());
          } else {
            setTimeout(checkRefresh, 100);
          }
        };
        checkRefresh();
      });
    }

    this.isRefreshing = true;

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: this.tokenData.refreshToken }),
      });

      if (!response.ok) {
        throw new Error(`Refresh failed: ${response.status}`);
      }

      const data: LoginResponse = await response.json();
      this.storeTokens(data);
      
      // Notify about successful refresh
      if (this.onAuthRefreshed) {
        this.onAuthRefreshed(data.user);
      }

      // Process queued requests
      this.processQueuedRequests();
      
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.handleAuthExpired();
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  private handleAuthExpired(): void {
    this.clearTokens();
    this.rejectQueuedRequests();
    
    if (this.onAuthExpired) {
      this.onAuthExpired();
    }
  }

  private processQueuedRequests(): void {
    const queue = [...this.requestQueue];
    this.requestQueue = [];

    queue.forEach(({ url, options, resolve, reject }) => {
      this.executeRequest(url, options)
        .then(resolve)
        .catch(reject);
    });
  }

  private rejectQueuedRequests(): void {
    const queue = [...this.requestQueue];
    this.requestQueue = [];

    queue.forEach(({ reject }) => {
      reject(new Error('Authentication expired'));
    });
  }

  private async queueRequest(url: string, options: RequestInit): Promise<any> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ url, options, resolve, reject });
    });
  }

  // 🔧 Enhanced HTTP Request Method
  private async executeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      // Add auth header if we have a valid token
      if (this.tokenData?.accessToken) {
        headers.Authorization = `Bearer ${this.tokenData.accessToken}`;
      }

      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle different response types
      if (response.status === 204) {
        return { data: {} as T };
      }

      const contentType = response.headers.get('content-type');
      let data: any;

      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = { message: await response.text() };
      }

      if (!response.ok) {
        return { 
          error: data.message || data.error || `HTTP ${response.status}` 
        };
      }

      return { data };
    } catch (error) {
      console.error('API request failed:', error);
      return { 
        error: error instanceof Error ? error.message : 'Network error' 
      };
    }
  }

  public async request<T>(
    endpoint: string,
    options: RequestInit = {},
    skipAuth: boolean = false
  ): Promise<ApiResponse<T>> {
    // Skip auth for public endpoints
    if (skipAuth) {
      return this.executeRequest<T>(endpoint, options);
    }

    // Check if we need to refresh token
    if (this.isTokenExpired()) {
      if (this.isRefreshing) {
        // Queue this request
        return this.queueRequest(endpoint, options);
      }

      const refreshSuccess = await this.refreshTokens();
      if (!refreshSuccess) {
        return { error: 'Authentication expired. Please login again.' };
      }
    }

    const response = await this.executeRequest<T>(endpoint, options);

    // Handle 401 responses (token might be invalid)
    if (response.error?.includes('401') || response.error?.includes('Unauthorized')) {
      // Try to refresh token once
      const refreshSuccess = await this.refreshTokens();
      if (refreshSuccess) {
        // Retry the original request
        return this.executeRequest<T>(endpoint, options);
      } else {
        return { error: 'Authentication expired. Please login again.' };
      }
    }

    return response;
  }

  // 🔧 Event Handlers
  public onAuthenticationExpired(callback: () => void): void {
    this.onAuthExpired = callback;
  }

  public onAuthenticationRefreshed(callback: (user: LoginResponse['user']) => void): void {
    this.onAuthRefreshed = callback;
  }

  // 🔧 Auth Status Methods
  public isAuthenticated(): boolean {
    return !!this.tokenData?.accessToken && !this.isTokenExpired();
  }

  public getStoredUser(): LoginResponse['user'] | null {
    try {
      const userStr = localStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }

  // 🔐 Authentication Methods
  async login(email: string, password: string): Promise<ApiResponse<LoginResponse>> {
    const response = await this.request<LoginResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, true); // Skip auth for login

    if (response.data) {
      this.storeTokens(response.data);
    }

    return response;
  }

  async register(userData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    company?: string;
  }): Promise<ApiResponse<{ message: string; userId: string }>> {
    return this.request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    }, true); // Skip auth for register
  }

  async getProfile(): Promise<ApiResponse<LoginResponse['user']>> {
    return this.request('/api/v1/auth/profile');
  }

  async logout(): Promise<void> {
    try {
      // Call logout endpoint if available
      await this.request('/api/v1/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.warn('Logout request failed:', error);
    } finally {
      this.clearTokens();
    }
  }

  // 👥 Client Methods
  async getClients(): Promise<ApiResponse<ClientResponse[]>> {
    return this.request('/api/v1/clients');
  }

  async createClient(clientData: {
    name?: string;
    firstName?: string;
    lastName?: string;
    email: string;
    phone?: string;
    spouseEmail?: string;
    notes?: string;
  }): Promise<ApiResponse<ClientResponse>> {
    return this.request('/api/v1/clients', {
      method: 'POST',
      body: JSON.stringify(clientData),
    });
  }

  async updateClient(clientId: string, updates: {
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    spouseEmail?: string;
    notes?: string;
  }): Promise<ApiResponse<ClientResponse>> {
    return this.request(`/api/v1/clients/${clientId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteClient(clientId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/api/v1/clients/${clientId}`, {
      method: 'DELETE',
    });
  }

  // 📈 Timeline Methods
  async getTimeline(clientId: string): Promise<ApiResponse<TimelineResponse>> {
    return this.request(`/api/v1/timelines/agent/${clientId}`);
  }

  async addProperty(timelineId: string, propertyData: {
    address: string;
    price: number;
    description: string;
    imageUrl: string;
    mlsLink?: string;
  }): Promise<ApiResponse<Property>> {
    return this.request(`/api/v1/timelines/${timelineId}/properties`, {
      method: 'POST',
      body: JSON.stringify(propertyData),
    });
  }

  async updateProperty(propertyId: string, updates: Partial<Property>): Promise<ApiResponse<Property>> {
    return this.request(`/api/v1/timelines/properties/${propertyId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteProperty(propertyId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/api/v1/timelines/properties/${propertyId}`, {
      method: 'DELETE',
    });
  }

  async sendTimelineEmail(timelineId: string): Promise<ApiResponse<{
    message: string;
    sentTo: string;
    spouseSentTo?: string;
    propertyCount: number;
    shareUrl: string;
  }>> {
    return this.request(`/api/v1/timelines/${timelineId}/send-email`, {
      method: 'POST',
    });
  }

  async revokeTimelineAccess(timelineId: string): Promise<ApiResponse<{
    message: string;
    newShareToken: string;
  }>> {
    return this.request(`/api/v1/timelines/${timelineId}/revoke-access`, {
      method: 'POST',
    });
  }

  // 📊 Analytics Methods
  async getDashboardAnalytics(): Promise<ApiResponse<AnalyticsDashboard>> {
    return this.request('/api/v1/analytics/dashboard');
  }

  // 🔍 Utility Methods
  async checkMLSDuplicate(clientId: string, mlsLink: string): Promise<ApiResponse<{ isDuplicate: boolean }>> {
    const params = new URLSearchParams({
      clientId,
      mlsLink,
    });
    
    return this.request(`/api/v1/timelines/check-duplicate?${params}`);
  }

  // 🌐 Public Timeline Methods (for client access)
  async getPublicTimeline(shareToken: string, clientCode?: string): Promise<ApiResponse<any>> {
    const params = clientCode ? `?client=${clientCode}` : '';
    return this.request(`/api/v1/timelines/${shareToken}${params}`, {}, true); // Skip auth for public
  }

  async submitPropertyFeedback(
    shareToken: string,
    propertyId: string,
    feedback: 'love' | 'like' | 'dislike',
    notes?: string,
    clientCode?: string,
    clientName?: string,
    clientEmail?: string
  ): Promise<ApiResponse<{ message: string }>> {
    const params = clientCode ? `?client=${clientCode}` : '';
    return this.request(`/api/v1/timelines/${shareToken}/properties/${propertyId}/feedback${params}`, {
      method: 'POST',
      body: JSON.stringify({ 
        feedback, 
        notes,
        clientName: clientName || 'Unknown Client',
        clientEmail: clientEmail || 'unknown@email.com'
      }),
    }, true); // Skip auth for public feedback
  }

  async validateClientAccess(shareToken: string, clientCode: string): Promise<ApiResponse<{
    valid: boolean;
    clientName?: string;
  }>> {
    return this.request(`/api/v1/timelines/${shareToken}/validate-client?client=${clientCode}`, {}, true);
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export types for use in store
export type { ClientResponse, TimelineResponse, AnalyticsDashboard };
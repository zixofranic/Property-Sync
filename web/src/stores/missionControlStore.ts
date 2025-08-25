// apps/web/src/stores/missionControlStore.ts - FIXED: Updated to use correct API methods

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { apiClient, type ClientResponse, type TimelineResponse, type AnalyticsDashboard } from '@/lib/api-client';
import { generateUUID } from '@/lib/uuid';

// Store Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  plan: string;
  emailVerified: boolean;
}

export interface UserPreferences {
  emailTemplateStyle: 'modern' | 'classical';
  notificationEmail: boolean;
  notificationDesktop: boolean;
  notificationFeedback: boolean;
  notificationNewProperties: boolean;
  // New client activity notification preferences
  notificationClientViews: boolean; // Timeline and property views
  notificationClientLogin: boolean; // Client authentication events
  notificationEmailOpens: boolean; // Email engagement tracking
  notificationInactiveClients: boolean; // Client hasn't visited in X days
  theme: 'dark' | 'light' | 'system';
  soundEnabled: boolean;
  timezone: string;
  brandColor: string;
  logo: string;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  spouseEmail?: string;
  avatar?: string;
  propertiesViewed: number;
  lastActive: string;
  engagementScore: number;
  status: 'active' | 'warm' | 'cold';
  createdAt: string;
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

export interface Property {
  id: string;
  clientId: string;
  address: string;
  price: number;
  description: string;
  imageUrl: string;
  imageUrls?: string[];
  mlsLink?: string;
  addedAt: string;
  clientFeedback?: 'love' | 'like' | 'dislike';
  notes?: string;
  isActive: boolean;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  beds?: number;  // Computed property for backward compatibility
  baths?: number; // Computed property for backward compatibility  
  sqft?: number;  // Computed property for backward compatibility
  loadingProgress?: number;
  isFullyParsed?: boolean;
}

// MLS Batch Import Interfaces
export interface BatchProperty {
  id: string;
  mlsUrl: string;
  parseStatus: 'pending' | 'parsing' | 'parsed' | 'failed' | 'imported';
  parseError?: string;
  position: number;
  parsedData?: {
    address: string;
    price: string;
    priceNumeric: number;
    beds?: string;
    baths?: string;
    sqft?: string;
    imageCount: number;
    images: string[];
  };
}

export interface PropertyBatch {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalProperties: number;
  successCount: number;
  failureCount: number;
  startedAt?: string;
  completedAt?: string;
  properties: BatchProperty[];
}

export interface Timeline {
  id: string;
  clientId: string;
  properties: Property[];
  createdAt: string;
  updatedAt: string;
  shareToken?: string;
  isPublic: boolean;
}

// Notification Interface
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'activity';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  clientId?: string; // For client activity notifications
  propertyId?: string; // For property-specific notifications
  metadata?: {
    eventType?: 'timeline_view' | 'property_view' | 'feedback_submit' | 'email_open' | 'client_login';
    clientName?: string;
    propertyAddress?: string;
    feedbackType?: 'love' | 'like' | 'dislike';
  };
}

// Email State Interface
interface EmailState {
  emailPreferences: {
    preferredTemplate: 'modern' | 'classical';
    brandColor: string;
    companyName: string;
    agentName: string;
  } | null;
  emailPreferencesLoading: boolean;
  emailPreferencesError: string | null;
}

// Store State Interface
interface MissionControlState extends EmailState {
  // Authentication State
  user: User | null;
  userPreferences: UserPreferences;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;

  // Client Management
  clients: Client[];
  selectedClient: Client | null;
  clientsLoading: boolean;
  clientsError: string | null;

  // Timeline Management
  activeTimeline: Timeline | null;
  timelineLoading: boolean;
  timelineError: string | null;

  // Analytics
  analytics: AnalyticsDashboard | null;
  analyticsLoading: boolean;
  analyticsError: string | null;

  // Notifications
  notifications: Notification[];

  // Activity Polling
  lastActivityCheck: string | null;
  activityPollingInterval: NodeJS.Timeout | null;

  // UI State
  sidebarOpen: boolean;
  selectedView: 'clients' | 'timeline' | 'analytics';
  activeModal: string | null;
  editingProperty: Property | null;
  bulkMode: boolean;

  // Polling State
  pollingInterval: NodeJS.Timeout | null;
  
  // Retry and error recovery state
  retryCount: number;
  lastDataLoadAttempt: number;
  isRetrying: boolean;

  // Batch Property State
  currentBatch: PropertyBatch | null;
  batchLoading: boolean;
  batchError: string | null;
}

// Email Actions Interface
interface EmailActions {
  // Email Preferences
  loadEmailPreferences: () => Promise<void>;
  updateEmailPreferences: (preferences: { 
    preferredTemplate?: 'modern' | 'classical'; 
    brandColor?: string; 
  }) => Promise<void>;
  
  // Email Sending
  sendTimelineEmail: (timelineId: string, templateOverride?: 'modern' | 'classical', emailType?: 'initial' | 'reminder') => Promise<void>;
  sendPropertyNotification: (timelineId: string, propertyId: string) => Promise<void>;
}

// Store Actions Interface
interface MissionControlActions extends EmailActions {
  // Authentication Actions
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  setUser: (user: User) => void;
  checkAuthStatus: () => void;
  refreshAuth: () => Promise<boolean>;
  loadProfile: () => Promise<void>;
  loadInitialData: () => Promise<void>;

  // User Preferences Actions
  updateUserPreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  loadUserPreferences: () => Promise<void>;
  resetPreferencesToDefaults: () => void;

  // Client Actions
  loadClients: () => Promise<void>;
  createClient: (clientData: Partial<Client>) => Promise<Client | null>;
  updateClient: (clientId: string, updates: Partial<Client>) => Promise<void>;
  deleteClient: (clientId: string) => Promise<void>;
  selectClient: (client: Client | null) => void;

  // Timeline Actions
  loadTimeline: (clientId: string) => Promise<void>;
  addProperty: (propertyData: Omit<Property, 'id' | 'clientId' | 'addedAt'>) => Promise<void>;
  updateProperty: (propertyId: string, updates: Partial<Property>) => Promise<void>;
  deleteProperty: (propertyId: string) => Promise<void>;
  revokeTimelineAccess: (timelineId: string) => Promise<void>;

  // Analytics Actions
  loadAnalytics: () => Promise<void>;

  // Batch Property Actions
  createAndParseBatch: (clientId: string, timelineId: string, mlsUrls: string[]) => Promise<void>;
  getBatchStatus: (batchId: string) => Promise<void>;
  importBatchProperties: (batchId: string, properties: any[]) => Promise<any>;
  clearCurrentBatch: () => void;
  loadDashboardAnalytics: () => Promise<void>;

  // Notification Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  markNotificationAsRead: (id: string) => void;
  clearAllNotifications: () => void;
  
  // Activity Polling Actions
  startActivityPolling: () => void;
  stopActivityPolling: () => void;
  processRecentActivity: (activities: any[]) => void;

  // Polling Actions
  startPolling: () => void;
  stopPolling: () => void;

  // UI Actions
  setSidebarOpen: (open: boolean) => void;
  setSelectedView: (view: 'clients' | 'timeline' | 'analytics') => void;
  setActiveModal: (modal: string | null) => void;
  setEditingProperty: (property: Property | null) => void;
  clearErrors: () => void;

  // Retry and recovery actions
  retryFailedOperations: () => Promise<void>;
  resetRetryState: () => void;

  // Helper Actions
  getClientTimeline: (clientId: string) => Timeline | null;
  getPropertyById: (propertyId: string) => Property | undefined;
  updatePropertyFeedback: (propertyId: string, feedback: 'love' | 'like' | 'dislike', notes?: string) => void;
  sendBulkProperties: (clientId: string) => void;
  setBulkMode: (enabled: boolean) => void;
  shareTimeline: (clientId: string) => string;
  checkMLSDuplicate: (clientId: string, mlsLink: string) => Promise<boolean>;
  addClient: (clientData: any) => Promise<Client | null>;
}

// Default preferences
const defaultPreferences: UserPreferences = {
  emailTemplateStyle: 'modern',
  notificationEmail: true,
  notificationDesktop: true,
  notificationFeedback: true,
  notificationNewProperties: true,
  // New activity notification defaults - enable the most important ones
  notificationClientViews: true,    // Timeline and property views
  notificationClientLogin: false,   // Less critical
  notificationEmailOpens: true,     // Important for engagement
  notificationInactiveClients: false, // Will implement separately
  theme: 'dark',
  soundEnabled: true,
  timezone: 'America/New_York',
  brandColor: '#3b82f6',
  logo: '',
};

class LoadingTracker {
  private lastLoads: Map<string, number> = new Map();
  private readonly DEDUPE_WINDOW = 2000; // 2 seconds
  
  canLoad(key: string): boolean {
    const now = Date.now();
    const lastLoad = this.lastLoads.get(key) || 0;
    
    if (now - lastLoad < this.DEDUPE_WINDOW) {
      console.log(`LoadingTracker: Skipping ${key} - already loaded ${now - lastLoad}ms ago`);
      return false;
    }
    
    this.lastLoads.set(key, now);
    return true;
  }
  
  reset() {
    this.lastLoads.clear();
  }
}

const loadingTracker = new LoadingTracker();

// Zustand Store Creation
export const useMissionControlStore = create<MissionControlState & MissionControlActions>()(
  devtools(
    persist(
      subscribeWithSelector((set, get) => ({
        // Initial State
        user: null,
        userPreferences: defaultPreferences,
        isAuthenticated: false,
        isLoading: false,
        authError: null,

        // Initial Email State
        emailPreferences: null,
        emailPreferencesLoading: false,
        emailPreferencesError: null,

        // Initial Client State
        clients: [],
        selectedClient: null,
        clientsLoading: false,
        clientsError: null,

        // Initial Timeline State
        activeTimeline: null,
        timelineLoading: false,
        timelineError: null,

        // Initial Analytics State
        analytics: null,
        analyticsLoading: false,
        analyticsError: null,

        // Initial Notifications State
        notifications: [],

        // Initial Activity Polling State
        lastActivityCheck: null,
        activityPollingInterval: null,

        // Initial UI State
        sidebarOpen: true,
        selectedView: 'clients',
        activeModal: null,
        editingProperty: null,
        bulkMode: false,

        // Initial Polling State
        pollingInterval: null,

        // Initial retry state
        retryCount: 0,
        lastDataLoadAttempt: 0,
        isRetrying: false,

        // Initial Batch State
        currentBatch: null,
        batchLoading: false,
        batchError: null,

        // Authentication Actions
        login: async (email: string, password: string): Promise<boolean> => {
          set({ isLoading: true, authError: null });

          try {
            console.log('Store: Attempting login...');
            const response = await apiClient.login(email, password);
            
            if (response.error) {
              console.log('Store: Login failed:', response.error);
              set({ authError: response.error, isLoading: false });
              
              get().addNotification({
                type: 'error',
                title: 'Login Failed',
                message: response.error,
                read: false,
              });
              
              return false;
            }

            if (response.data) {
              console.log('Store: Login successful, setting user state');
              set({
                user: response.data.user,
                isAuthenticated: true,
                isLoading: false,
                authError: null,
                retryCount: 0,
              });

              get().addNotification({
                type: 'success',
                title: 'Welcome Back!',
                message: `Logged in as ${response.data.user.firstName} ${response.data.user.lastName}`,
                read: false,
              });

              // Reset tracker on new login
              loadingTracker.reset();
              
              // Load initial data once
              get().loadInitialData();

              return true;
            }

            return false;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Login failed';
            console.error('Store: Login error:', errorMessage);
            set({ authError: errorMessage, isLoading: false });
            
            get().addNotification({
              type: 'error',
              title: 'Login Error',
              message: errorMessage,
              read: false,
            });
            
            return false;
          }
        },

        logout: () => {
          console.log('Store: Logging out...');
          
          // Stop polling
          get().stopPolling();
          get().stopActivityPolling();

          // Clear API client tokens
          apiClient.logout();

          // Reset all store state
          set({
            user: null,
            userPreferences: defaultPreferences,
            isAuthenticated: false,
            authError: null,
            clients: [],
            selectedClient: null,
            activeTimeline: null,
            analytics: null,
            notifications: [],
            lastActivityCheck: null,
            activityPollingInterval: null,
            selectedView: 'clients',
            activeModal: null,
            editingProperty: null,
            bulkMode: false,
            pollingInterval: null,
            retryCount: 0,
            lastDataLoadAttempt: 0,
            isRetrying: false,
            emailPreferences: null,
            emailPreferencesLoading: false,
            emailPreferencesError: null,
          });

          // Redirect to login
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        },

        // New centralized initial data loading method
        loadInitialData: async () => {
          // Only load if we haven't loaded recently
          if (!loadingTracker.canLoad('initial-data')) {
            console.log('Store: Initial data already loading/loaded');
            return;
          }
          
          console.log('Store: Loading initial data...');
          
          try {
            await Promise.allSettled([
              get().loadClients(),
              get().loadDashboardAnalytics(),
              get().loadUserPreferences()
            ]);
            
            // Start activity polling after data is loaded
            get().startActivityPolling();
            
            console.log('Store: Initial data loading complete');
          } catch (error) {
            console.warn('Store: Some initial data failed to load:', error);
          }
        },

        // Modified checkAuthStatus to prevent duplicate loads
        checkAuthStatus: () => {
          console.log('Store: Checking auth status...');
          const isAuth = apiClient.isAuthenticated();
          const storedUser = apiClient.getStoredUser();
          
          if (isAuth && storedUser) {
            console.log('Store: Auth status valid, user found');
            set({
              isAuthenticated: true,
              user: storedUser,
            });
            
            // Use deduplication for data loading
            if (loadingTracker.canLoad('auth-check-data')) {
              get().loadInitialData();
            }
          } else {
            console.log('Store: Auth status invalid');
            set({
              isAuthenticated: false,
              user: null,
            });
          }
        },

        setUser: (user: User) => {
          console.log('Store: Setting user:', user.email);
          set({ user, isAuthenticated: true });
        },

        // User Preferences Actions
        updateUserPreferences: async (preferences: Partial<UserPreferences>) => {
          try {
            console.log('Store: Updating user preferences...', preferences);
            
            // Optimistically update local state
            set((state) => ({
              userPreferences: {
                ...state.userPreferences,
                ...preferences,
              },
            }));

            // Attempt to save to backend
            const response = await apiClient.updateUserPreferences(preferences);
            
            if (response.error) {
              console.error('Store: Preferences update failed:', response.error);
              
              // Revert optimistic update on failure
              await get().loadUserPreferences();
              
              get().addNotification({
                type: 'error',
                title: 'Settings Save Failed',
                message: response.error,
                read: false,
              });
              
              throw new Error(response.error);
            }

            console.log('Store: Preferences updated successfully');
            
            get().addNotification({
              type: 'success',
              title: 'Settings Saved',
              message: 'Your preferences have been updated successfully',
              read: false,
            });

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to save preferences';
            console.error('Store: Preferences update error:', errorMessage);
            
            get().addNotification({
              type: 'error',
              title: 'Settings Error',
              message: errorMessage,
              read: false,
            });
            
            throw error; // Re-throw so UI can handle it
          }
        },

        loadUserPreferences: async () => {
          if (!loadingTracker.canLoad('preferences')) {
            console.log('Store: Preferences recently loaded, skipping');
            return;
          }
          
          try {
            console.log('Store: Loading user preferences...');
            const response = await apiClient.getUserPreferences();
            
            if (response.error) {
              console.warn('Store: Preferences loading failed, using defaults:', response.error);
              return;
            }

            if (response.data) {
              console.log('Store: Preferences loaded successfully');
              set({
                userPreferences: {
                  ...defaultPreferences,
                  ...response.data,
                },
              });
            }
          } catch (error) {
            console.warn('Store: Preferences loading error, using defaults:', error);
          }
        },

        resetPreferencesToDefaults: () => {
          console.log('Store: Resetting preferences to defaults');
          set({ userPreferences: { ...defaultPreferences } });
        },

        // Use getAuthProfile for authentication checks
        refreshAuth: async (): Promise<boolean> => {
          const state = get();
          
          if (state.isLoading) {
            console.log('Store: Auth refresh already in progress');
            return state.isAuthenticated;
          }

          try {
            console.log('Store: Refreshing authentication...');
            set({ isLoading: true });

            const response = await apiClient.getProfile();
            
            if (response.error) {
              console.log('Store: Auth profile fetch failed:', response.error);
              
              const isAuthError = response.error.includes('401') || 
                            response.error.includes('Unauthorized') ||
                            response.error.includes('Invalid token') ||
                            response.error.includes('Token expired');
              
              if (isAuthError) {
                console.log('Store: Auth error detected, clearing auth state');
                set({ 
                  isAuthenticated: false,
                  user: null,
                  isLoading: false 
                });
                return false;
              } else {
                console.log('Store: Network error, keeping auth state');
                set({ isLoading: false });
                return state.isAuthenticated;
              }
            }

            if (response.data) {
              console.log('Store: Auth refresh successful');
              const userFromAuth = {
                id: response.data.id,
                email: response.data.email,
                firstName: response.data.firstName || '',
                lastName: response.data.lastName || '',
                plan: response.data.plan || 'FREE',
                emailVerified: response.data.emailVerified || false,
              };

              set({
                user: userFromAuth,
                isAuthenticated: true,
                authError: null,
                isLoading: false,
                retryCount: 0,
              });
              return true;
            }

            console.log('Store: No data in auth profile response');
            set({ isLoading: false });
            return false;
          } catch (error) {
            console.error('Store: Auth refresh error:', error);
            set({ isLoading: false });
            
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
              console.log('Store: Network error indicates auth issue');
              set({ 
                isAuthenticated: false,
                user: null 
              });
              return false;
            } else {
              console.log('Store: Network error, keeping auth state');
              return get().isAuthenticated;
            }
          }
        },

        // Use getProfile for profile loading
        loadProfile: async () => {
          if (get().isLoading || get().user?.firstName) {
            console.log('Store: Profile already loading or loaded, skipping');
            return; // Already loaded or loading
          }
          
          try {
            console.log('Store: Loading profile...');
            const response = await apiClient.getProfile();
            
            if (response.error) {
              console.error('Store: Profile loading failed:', response.error);
              
              get().addNotification({
                type: 'warning',
                title: 'Profile Loading Issue',
                message: 'Unable to load profile information.',
                read: false,
              });
              return;
            }

            if (response.data) {
              console.log('Store: Profile loaded successfully');
              const userFromProfile = {
                id: response.data.id,
                email: response.data.email,
                firstName: response.data.firstName,
                lastName: response.data.lastName,
                plan: response.data.plan,
                emailVerified: response.data.emailVerified,
              };
              set({ user: userFromProfile });
            }
          } catch (error) {
            console.error('Store: Profile loading error:', error);
          }
        },

        // Email Preference Actions
        loadEmailPreferences: async () => {
          set({ emailPreferencesLoading: true, emailPreferencesError: null });

          try {
            const response = await apiClient.getEmailPreferences();
            
            if (response.error) {
              set({ emailPreferencesError: response.error, emailPreferencesLoading: false });
              
              get().addNotification({
                type: 'error',
                title: 'Failed to Load Email Preferences',
                message: response.error,
                read: false,
              });
              
              return;
            }

            if (response.data) {
              set({
                emailPreferences: response.data,
                emailPreferencesLoading: false,
                emailPreferencesError: null,
              });
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load email preferences';
            set({ emailPreferencesError: errorMessage, emailPreferencesLoading: false });
            
            get().addNotification({
              type: 'error',
              title: 'Network Error',
              message: errorMessage,
              read: false,
            });
          }
        },

        updateEmailPreferences: async (preferences: { 
          preferredTemplate?: 'modern' | 'classical'; 
          brandColor?: string; 
        }) => {
          set({ emailPreferencesLoading: true, emailPreferencesError: null });

          try {
            const response = await apiClient.updateEmailPreferences(preferences);
            
            if (response.error) {
              set({ emailPreferencesError: response.error, emailPreferencesLoading: false });
              
              get().addNotification({
                type: 'error',
                title: 'Failed to Update Preferences',
                message: response.error,
                read: false,
              });
              
              return;
            }

            if (response.data) {
              set({
                emailPreferences: response.data.preferences,
                emailPreferencesLoading: false,
                emailPreferencesError: null,
              });

              get().addNotification({
                type: 'success',
                title: 'Preferences Updated',
                message: 'Email template preferences saved successfully',
                read: false,
              });
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to update preferences';
            set({ emailPreferencesError: errorMessage, emailPreferencesLoading: false });
            
            get().addNotification({
              type: 'error',
              title: 'Update Failed',
              message: errorMessage,
              read: false,
            });
          }
        },

        sendPropertyNotification: async (timelineId: string, propertyId: string) => {
          try {
            const response = await apiClient.sendPropertyNotification(timelineId, propertyId);
            
            if (response.error) {
              get().addNotification({
                type: 'error',
                title: 'Notification Failed',
                message: response.error,
                read: false,
              });
              throw new Error(response.error);
            }

            if (response.data) {
              get().addNotification({
                type: 'success',
                title: 'Property Notification Sent!',
                message: `Notified client about ${response.data.propertyAddress}`,
                read: false,
              });
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to send property notification';
            
            get().addNotification({
              type: 'error',
              title: 'Notification Failed',
              message: errorMessage,
              read: false,
            });
            
            throw error;
          }
        },

        // Polling
        startPolling: () => {
          console.log('Store: Starting polling...');
          
          get().stopPolling();

          const interval = setInterval(() => {
            const state = get();
            if (state.isAuthenticated && !state.isRetrying) {
              console.log('Store: Polling refresh...');
              
              state.loadAnalytics().catch((error) => {
                console.warn('Store: Polling analytics refresh failed:', error);
              });
            } else if (!state.isAuthenticated) {
              console.log('Store: Not authenticated, stopping polling');
              state.stopPolling();
            }
          }, 120000); // 2 minutes

          set({ pollingInterval: interval });
        },

        stopPolling: () => {
          console.log('Store: Stopping polling...');
          const { pollingInterval } = get();
          if (pollingInterval) {
            clearInterval(pollingInterval);
            set({ pollingInterval: null });
          }
        },

        // Activity Polling Methods
        startActivityPolling: () => {
          console.log('Store: Starting activity polling...');
          
          get().stopActivityPolling();

          const interval = setInterval(async () => {
            const state = get();
            if (state.isAuthenticated && state.userPreferences) {
              try {
                const since = state.lastActivityCheck || new Date(Date.now() - 30000).toISOString(); // Last 30 seconds
                const response = await apiClient.getAgentRecentActivity(since);
                
                if (response.data && response.data.length > 0) {
                  console.log('Store: Processing', response.data.length, 'new activities');
                  state.processRecentActivity(response.data);
                  set({ lastActivityCheck: new Date().toISOString() });
                }
              } catch (error) {
                console.warn('Store: Activity polling failed:', error);
              }
            } else if (!state.isAuthenticated) {
              console.log('Store: Not authenticated, stopping activity polling');
              state.stopActivityPolling();
            }
          }, 30000); // Poll every 30 seconds

          set({ activityPollingInterval: interval });
        },

        stopActivityPolling: () => {
          console.log('Store: Stopping activity polling...');
          const { activityPollingInterval } = get();
          if (activityPollingInterval) {
            clearInterval(activityPollingInterval);
            set({ activityPollingInterval: null });
          }
        },

        processRecentActivity: (activities: any[]) => {
          const state = get();
          const preferences = state.userPreferences;
          
          if (!preferences) return;

          activities.forEach((activity) => {
            const clientName = activity.timeline?.client?.firstName && activity.timeline?.client?.lastName 
              ? `${activity.timeline.client.firstName} ${activity.timeline.client.lastName}` 
              : 'Client';
            
            let notification: Omit<Notification, 'id' | 'timestamp'> | null = null;

            switch (activity.eventType) {
              case 'timeline_view':
                if (preferences.notificationClientViews) {
                  notification = {
                    type: 'activity',
                    title: '👁️ Client Timeline View',
                    message: `${clientName} just viewed their timeline`,
                    read: false,
                    clientId: activity.timeline?.clientId,
                    metadata: {
                      eventType: 'timeline_view',
                      clientName,
                    }
                  };
                }
                break;

              case 'property_view':
                if (preferences.notificationClientViews) {
                  const propertyInfo = activity.metadata?.propertyAddress || 'a property';
                  notification = {
                    type: 'activity',
                    title: '🏠 Property View',
                    message: `${clientName} viewed ${propertyInfo}`,
                    read: false,
                    clientId: activity.timeline?.clientId,
                    propertyId: activity.propertyId,
                    metadata: {
                      eventType: 'property_view',
                      clientName,
                      propertyAddress: propertyInfo,
                    }
                  };
                }
                break;

              case 'feedback_submit':
                if (preferences.notificationFeedback) {
                  const feedbackType = activity.metadata?.feedbackType || 'feedback';
                  const feedbackEmoji = feedbackType === 'love' ? '❤️' : feedbackType === 'like' ? '👍' : '👎';
                  notification = {
                    type: 'info',
                    title: `${feedbackEmoji} Client Feedback`,
                    message: `${clientName} ${feedbackType === 'love' ? 'loves' : feedbackType === 'like' ? 'likes' : 'dislikes'} a property`,
                    read: false,
                    clientId: activity.timeline?.clientId,
                    propertyId: activity.propertyId,
                    metadata: {
                      eventType: 'feedback_submit',
                      clientName,
                      feedbackType,
                    }
                  };
                }
                break;

              case 'email_open':
                if (preferences.notificationEmailOpens) {
                  notification = {
                    type: 'activity',
                    title: '📧 Email Opened',
                    message: `${clientName} opened your timeline email`,
                    read: false,
                    clientId: activity.timeline?.clientId,
                    metadata: {
                      eventType: 'email_open',
                      clientName,
                    }
                  };
                }
                break;

              case 'client_login':
                if (preferences.notificationClientLogin) {
                  notification = {
                    type: 'activity',
                    title: '🔐 Client Login',
                    message: `${clientName} logged into their timeline`,
                    read: false,
                    clientId: activity.timeline?.clientId,
                    metadata: {
                      eventType: 'client_login',
                      clientName,
                    }
                  };
                }
                break;
            }

            if (notification) {
              get().addNotification(notification);
            }
          });
        },

        // Client Management
        loadClients: async () => {
          const state = get();
          
          // Check if already loading
          if (state.clientsLoading) {
            console.log('Store: Clients already loading');
            return;
          }
          
          // Check deduplication window
          if (!loadingTracker.canLoad('clients')) {
            console.log('Store: Clients recently loaded, skipping');
            return;
          }

          set({ clientsLoading: true, clientsError: null });
          console.log('Store: Loading clients...');

          try {
            const response = await apiClient.getClients();
            
            if (response.error) {
              console.error('Store: Clients loading failed:', response.error);
              set({ clientsError: response.error, clientsLoading: false });
              
              if (!response.error.toLowerCase().includes('network')) {
                get().addNotification({
                  type: 'warning',
                  title: 'Clients Loading Issue',
                  message: 'Unable to load clients. Click retry or refresh the page.',
                  read: false,
                });
              }
              return;
            }

            if (response.data) {
              console.log('Store: Clients loaded successfully, count:', response.data.length);
              
              const transformedClients: Client[] = response.data.map((client: ClientResponse) => ({
                id: client.id,
                name: client.name,
                email: client.email,
                phone: client.phone,
                spouseEmail: client.spouseEmail,
                avatar: client.avatar,
                propertiesViewed: client.propertiesViewed,
                lastActive: client.lastActive,
                engagementScore: client.engagementScore,
                status: client.status,
                createdAt: client.createdAt,
                timeline: client.timeline,
              }));

              set({
                clients: transformedClients,
                clientsLoading: false,
                clientsError: null,
              });

              if (!state.selectedClient && transformedClients.length > 0) {
                console.log('Store: Auto-selecting first client');
                get().selectClient(transformedClients[0]);
              }
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load clients';
            console.error('Store: Clients loading error:', errorMessage);
            set({ clientsError: errorMessage, clientsLoading: false });
          }
        },

        createClient: async (clientData: Partial<Client>): Promise<Client | null> => {
          set({ clientsLoading: true, clientsError: null });

          try {
            console.log('Store: Creating client...');
            const response = await apiClient.createClient(clientData);
            
            if (response.error) {
              set({ clientsError: response.error, clientsLoading: false });
              
              get().addNotification({
                type: 'error',
                title: 'Failed to Create Client',
                message: response.error,
                read: false,
              });
              
              return null;
            }

            if (response.data) {
              console.log('Store: Client created successfully');
              
              const newClient: Client = {
                id: response.data.id,
                name: response.data.name,
                email: response.data.email,
                phone: response.data.phone,
                avatar: response.data.avatar,
                propertiesViewed: response.data.propertiesViewed,
                lastActive: response.data.lastActive,
                engagementScore: response.data.engagementScore,
                status: response.data.status,
                createdAt: response.data.createdAt,
                timeline: response.data.timeline,
              };

              set((state) => ({
                clients: [...state.clients, newClient],
                clientsLoading: false,
                clientsError: null,
              }));

              get().addNotification({
                type: 'success',
                title: 'Client Created',
                message: `${newClient.name} has been added successfully`,
                read: false,
              });

              return newClient;
            }

            return null;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to create client';
            set({ clientsError: errorMessage, clientsLoading: false });
            
            get().addNotification({
              type: 'error',
              title: 'Creation Failed',
              message: errorMessage,
              read: false,
            });
            
            return null;
          }
        },

        updateClient: async (clientId: string, updates: Partial<Client>) => {
  try {
    console.log('Store: Updating client:', clientId);
    
    // Transform the updates to match backend expectations
    const backendUpdates: any = { ...updates };
    
    // If name is provided, split it into firstName/lastName
    if (updates.name) {
      const nameParts = updates.name.trim().split(' ');
      backendUpdates.firstName = nameParts[0] || '';
      backendUpdates.lastName = nameParts.slice(1).join(' ') || '';
      delete backendUpdates.name; // Remove the combined name field
    }
    
    const response = await apiClient.updateClient(clientId, backendUpdates);
    
    if (response.error) {
      set({ clientsError: response.error });
      
      get().addNotification({
        type: 'error',
        title: 'Update Failed',
        message: response.error,
        read: false,
      });
      
      return;
    }

    if (response.data) {
      console.log('Store: Client updated successfully');
      
      set((state) => ({
        clients: state.clients.map((client) =>
          client.id === clientId
            ? {
                ...client,
                name: response.data!.name,
                email: response.data!.email,
                phone: response.data!.phone,
                spouseEmail: response.data!.spouseEmail,
                ...updates,
              }
            : client
        ),
        clientsError: null,
      }));

      get().addNotification({
        type: 'success',
        title: 'Client Updated',
        message: 'Client information has been updated successfully',
        read: false,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to update client';
    set({ clientsError: errorMessage });
    
    get().addNotification({
      type: 'error',
      title: 'Update Error',
      message: errorMessage,
      read: false,
    });
  }
},

        deleteClient: async (clientId: string) => {
          try {
            const clientName = get().clients.find(c => c.id === clientId)?.name || 'Client';
            console.log('Store: Deleting client:', clientName);
            
            const response = await apiClient.deleteClient(clientId);
            
            if (response.error) {
              set({ clientsError: response.error });
              
              get().addNotification({
                type: 'error',
                title: 'Delete Failed',
                message: response.error,
                read: false,
              });
              
              return;
            }

            console.log('Store: Client deleted successfully');
            
            set((state) => ({
              clients: state.clients.filter((client) => client.id !== clientId),
              selectedClient: state.selectedClient?.id === clientId ? null : state.selectedClient,
              clientsError: null,
            }));

            get().addNotification({
              type: 'success',
              title: 'Client Deleted',
              message: `${clientName} has been removed successfully`,
              read: false,
            });

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete client';
            set({ clientsError: errorMessage });
            
            get().addNotification({
              type: 'error',
              title: 'Delete Error',
              message: errorMessage,
              read: false,
            });
          }
        },

        selectClient: (client: Client | null) => {
          console.log('Store: Selecting client:', client?.name || 'none');
          set({ selectedClient: client });
          
          if (client) {
            console.log('Store: Auto-loading timeline for client:', client.id);
            get().loadTimeline(client.id);
          } else {
            set({ activeTimeline: null });
          }
        },

        // Timeline Management
        loadTimeline: async (clientId: string) => {
          set({ timelineLoading: true, timelineError: null });
          console.log('Store: Loading timeline for client:', clientId);

          try {
            const response = await apiClient.getTimeline(clientId);
            
            if (response.error) {
              console.error('Store: Timeline loading failed:', response.error);
              set({ timelineError: response.error, timelineLoading: false });
              return;
            }

            if (response.data) {
              console.log('Store: Timeline loaded successfully');
              
              const transformedTimeline: Timeline = {
                id: response.data.id,
                clientId: response.data.clientId,
                properties: response.data.properties,
                createdAt: response.data.createdAt,
                updatedAt: response.data.updatedAt,
                shareToken: response.data.shareToken,
                isPublic: response.data.isPublic,
              };

              set({
                activeTimeline: transformedTimeline,
                timelineLoading: false,
                timelineError: null,
              });
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load timeline';
            console.error('Store: Timeline loading error:', errorMessage);
            set({ timelineError: errorMessage, timelineLoading: false });
          }
        },

        addProperty: async (propertyData: Omit<Property, 'id' | 'clientId' | 'addedAt'>) => {
          const { selectedClient } = get();
          if (!selectedClient) {
            get().addNotification({
              type: 'error',
              title: 'No Client Selected',
              message: 'Please select a client first',
              read: false,
            });
            return;
          }

          // Ensure timeline exists for this client
          let timeline = get().getClientTimeline(selectedClient.id);
          if (!timeline) {
            console.log('Store: No timeline found, loading for client:', selectedClient.id);
            await get().loadTimeline(selectedClient.id);
            timeline = get().getClientTimeline(selectedClient.id);
          }

          if (!timeline?.id) {
            get().addNotification({
              type: 'error',
              title: 'Timeline Error',
              message: 'Could not load timeline for this client',
              read: false,
            });
            return;
          }

          set({ timelineLoading: true, timelineError: null });
          console.log('Store: Adding property to timeline:', timeline.id);

          try {
            const response = await apiClient.addProperty(timeline.id, {
              address: propertyData.address,
              price: propertyData.price,
              description: propertyData.description,
              imageUrl: propertyData.imageUrl,
              mlsLink: propertyData.mlsLink,
            });
            
            if (response.error) {
              set({ timelineError: response.error, timelineLoading: false });
              
              get().addNotification({
                type: 'error',
                title: 'Property Add Failed',
                message: response.error,
                read: false,
              });
              
              return;
            }

            if (response.data) {
              console.log('Store: Property added successfully');
              
              set((state) => ({
                activeTimeline: state.activeTimeline ? {
                  ...state.activeTimeline,
                  properties: [...state.activeTimeline.properties, response.data!],
                } : null,
                timelineLoading: false,
                timelineError: null,
              }));

              get().addNotification({
                type: 'success',
                title: 'Property Added',
                message: `${propertyData.address} has been added to the timeline`,
                read: false,
              });
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to add property';
            set({ timelineError: errorMessage, timelineLoading: false });
            
            get().addNotification({
              type: 'error',
              title: 'Network Error',
              message: errorMessage,
              read: false,
            });
          }
        },

        updateProperty: async (propertyId: string, updates: Partial<Property>) => {
          try {
            console.log('Store: Updating property:', propertyId);
            const response = await apiClient.updateProperty(propertyId, updates);
            
            if (response.error) {
              set({ timelineError: response.error });
              
              get().addNotification({
                type: 'error',
                title: 'Property Update Failed',
                message: response.error,
                read: false,
              });
              
              return;
            }

            if (response.data) {
              console.log('Store: Property updated successfully');
              
              set((state) => ({
                activeTimeline: state.activeTimeline ? {
                  ...state.activeTimeline,
                  properties: state.activeTimeline.properties.map((property) =>
                    property.id === propertyId ? { ...property, ...response.data } : property
                  ),
                } : null,
                timelineError: null,
              }));

              get().addNotification({
                type: 'success',
                title: 'Property Updated',
                message: 'Property details have been updated successfully',
                read: false,
              });
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to update property';
            set({ timelineError: errorMessage });
            
            get().addNotification({
              type: 'error',
              title: 'Update Error',
              message: errorMessage,
              read: false,
            });
          }
        },

        deleteProperty: async (propertyId: string) => {
          try {
            const property = get().activeTimeline?.properties.find(p => p.id === propertyId);
            console.log('Store: Deleting property:', property?.address);
            
            const response = await apiClient.deleteProperty(propertyId);
            
            if (response.error) {
              set({ timelineError: response.error });
              
              get().addNotification({
                type: 'error',
                title: 'Delete Failed',
                message: response.error,
                read: false,
              });
              
              return;
            }

            console.log('Store: Property deleted successfully');
            
            set((state) => ({
              activeTimeline: state.activeTimeline ? {
                ...state.activeTimeline,
                properties: state.activeTimeline.properties.filter((property) => property.id !== propertyId),
              } : null,
              timelineError: null,
            }));

            get().addNotification({
              type: 'success',
              title: 'Property Deleted',
              message: `${property?.address || 'Property'} has been removed from the timeline`,
              read: false,
            });

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete property';
            set({ timelineError: errorMessage });
            
            get().addNotification({
              type: 'error',
              title: 'Delete Error',
              message: errorMessage,
              read: false,
            });
          }
        },

        sendTimelineEmail: async (timelineId: string, templateOverride?: 'modern' | 'classical', emailType?: 'initial' | 'reminder') => {
          try {
            const response = await apiClient.sendTimelineEmail(timelineId, templateOverride, emailType);
            
            if (response.error) {
              get().addNotification({
                type: 'error',
                title: 'Email Failed',
                message: response.error,
                read: false,
              });
              throw new Error(response.error);
            }

            if (response.data) {
              get().addNotification({
                type: 'success',
                title: 'Timeline Email Sent!',
                message: `Successfully sent ${response.data.propertyCount} properties to ${response.data.sentTo}${
                  response.data.spouseSentTo ? ` and ${response.data.spouseSentTo}` : ''
                }`,
                read: false,
              });
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to send timeline email';
            
            get().addNotification({
              type: 'error',
              title: 'Email Send Failed',
              message: errorMessage,
              read: false,
            });
            
            throw error; // Re-throw for component handling
          }
        },

        revokeTimelineAccess: async (timelineId: string) => {
          try {
            console.log('Store: Revoking timeline access for:', timelineId);
            const response = await apiClient.revokeTimelineAccess(timelineId);
            
            if (response.error) {
              set({ timelineError: response.error });
              
              get().addNotification({
                type: 'error',
                title: 'Revoke Failed',
                message: response.error,
                read: false,
              });
              
              return;
            }

            if (response.data?.newShareToken) {
              console.log('Store: Timeline access revoked, new token generated');
              set((state) => ({
                activeTimeline: state.activeTimeline ? {
                  ...state.activeTimeline,
                  shareToken: response.data!.newShareToken,
                } : null,
              }));

              get().addNotification({
                type: 'warning',
                title: 'Access Revoked',
                message: 'Timeline access has been revoked. A new share link has been generated.',
                read: false,
              });
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to revoke timeline access';
            set({ timelineError: errorMessage });
            
            get().addNotification({
              type: 'error',
              title: 'Revoke Error',
              message: errorMessage,
              read: false,
            });
          }
        },

        // Analytics Actions
        loadAnalytics: async () => {
          const state = get();
          
          if (state.analyticsLoading) {
            console.log('Store: Analytics already loading');
            return;
          }
          
          if (!loadingTracker.canLoad('analytics')) {
            console.log('Store: Analytics recently loaded, skipping');
            return;
          }

          set({ analyticsLoading: true, analyticsError: null });
          console.log('Store: Loading analytics...');

          try {
            const response = await apiClient.getDashboardAnalytics();
            
            if (response.error) {
              console.error('Store: Analytics loading failed:', response.error);
              set({ analyticsError: response.error, analyticsLoading: false });
              
              if (!response.error.includes('Network')) {
                get().addNotification({
                  type: 'warning',
                  title: 'Analytics Loading Issue',
                  message: 'Unable to load analytics data.',
                  read: false,
                });
              }
              return;
            }

            if (response.data) {
              console.log('Store: Analytics loaded successfully');
              set({
                analytics: response.data,
                analyticsLoading: false,
                analyticsError: null,
              });
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load analytics';
            console.error('Store: Analytics loading error:', errorMessage);
            set({ analyticsError: errorMessage, analyticsLoading: false });
            
            if (!errorMessage.includes('Network')) {
              get().addNotification({
                type: 'warning',
                title: 'Analytics Error',
                message: 'Unable to load analytics due to connection issues.',
                read: false,
              });
            }
          }
        },

        loadDashboardAnalytics: async () => {
          return get().loadAnalytics();
        },

        // Notification Actions
        addNotification: (notificationData: Omit<Notification, 'id' | 'timestamp'>) => {
          const notification: Notification = {
            ...notificationData,
            id: generateUUID(),
            timestamp: new Date().toISOString(),
          };

          set((state) => ({
            notifications: [notification, ...state.notifications].slice(0, 10),
          }));
        },

        removeNotification: (id: string) => {
          set((state) => ({
            notifications: state.notifications.filter((notification) => notification.id !== id),
          }));
        },

        markNotificationAsRead: (id: string) => {
          set((state) => ({
            notifications: state.notifications.map((notification) =>
              notification.id === id ? { ...notification, read: true } : notification
            ),
          }));
        },

        clearAllNotifications: () => {
          set({ notifications: [] });
        },

        // Retry and recovery actions
        retryFailedOperations: async () => {
          const state = get();
          
          if (state.isRetrying) {
            console.log('Store: Retry already in progress');
            return;
          }

          console.log('Store: Retrying failed operations...');
          set({ isRetrying: true, retryCount: state.retryCount + 1 });

          try {
            const retryPromises = [];

            if (state.clientsError) {
              console.log('Store: Retrying clients load...');
              retryPromises.push(get().loadClients());
            }

            if (state.analyticsError) {
              console.log('Store: Retrying analytics load...');
              retryPromises.push(get().loadAnalytics());
            }

            if (state.timelineError && state.selectedClient) {
              console.log('Store: Retrying timeline load...');
              retryPromises.push(get().loadTimeline(state.selectedClient.id));
            }

            await Promise.allSettled(retryPromises);
            
            get().addNotification({
              type: 'info',
              title: 'Retry Complete',
              message: 'Attempted to reload failed data.',
              read: false,
            });

          } catch (error) {
            console.error('Store: Retry failed:', error);
            
            get().addNotification({
              type: 'error',
              title: 'Retry Failed',
              message: 'Unable to reload data. Please refresh the page.',
              read: false,
            });
          } finally {
            set({ isRetrying: false, lastDataLoadAttempt: Date.now() });
          }
        },

        resetRetryState: () => {
          set({ retryCount: 0, lastDataLoadAttempt: 0, isRetrying: false });
        },

        // UI Actions
        setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
        setSelectedView: (view: 'clients' | 'timeline' | 'analytics') => set({ selectedView: view }),
        setActiveModal: (modal: string | null) => set({ activeModal: modal }),
        setEditingProperty: (property: Property | null) => set({ editingProperty: property }),

        // Helper Actions
        getClientTimeline: (clientId: string) => {
          return get().activeTimeline?.clientId === clientId ? get().activeTimeline : null;
        },

        getPropertyById: (propertyId: string) => {
          return get().activeTimeline?.properties.find(p => p.id === propertyId);
        },

        updatePropertyFeedback: (propertyId: string, feedback: 'love' | 'like' | 'dislike', notes?: string) => {
          set((state) => ({
            activeTimeline: state.activeTimeline ? {
              ...state.activeTimeline,
              properties: state.activeTimeline.properties.map((property) =>
                property.id === propertyId 
                  ? { ...property, clientFeedback: feedback, notes }
                  : property
              ),
            } : null,
          }));
        },

        sendBulkProperties: (clientId: string) => {
          const state = get();
          const client = state.clients.find(c => c.id === clientId);
          
          get().addNotification({
            type: 'success',
            title: 'Bulk Email Sent!',
            message: `Successfully sent properties to ${client?.name || 'client'}`
          });
        },

        setBulkMode: (enabled: boolean) => set({ bulkMode: enabled }),

        shareTimeline: (clientId: string): string => {
          const client = get().clients.find(c => c.id === clientId);
          if (!client?.timeline?.shareToken) {
            get().addNotification({
              type: 'error',
              title: 'Share Error',
              message: 'Timeline not found for this client',
              read: false,
            });
            return '';
          }
          return client.timeline.shareToken;
        },

      checkMLSDuplicate: async (clientId: string, mlsLink: string): Promise<boolean> => {
  if (!mlsLink?.trim()) return false;
  
  try {
    const response = await apiClient.checkMLSDuplicate(clientId, mlsLink.trim());
    
    if (response.error) {
      console.warn('Duplicate check failed:', response.error);
      // Fallback to local check if API fails
      const timeline = get().getClientTimeline(clientId);
      if (!timeline?.properties) return false;
      
      return timeline.properties.some(property => 
        property.mlsLink && property.mlsLink.trim() === mlsLink.trim()
      );
    }
    
    return response.data?.isDuplicate || false;
  } catch (error) {
    console.error('Duplicate check error:', error);
    // Fallback to local check
    const timeline = get().getClientTimeline(clientId);
    if (!timeline?.properties) return false;
    
    return timeline.properties.some(property => 
      property.mlsLink && property.mlsLink.trim() === mlsLink.trim()
    );
  }
},

        addClient: async (clientData: any) => {
          console.log('Store: addClient called with:', clientData);
          return get().createClient(clientData);
        },

        clearErrors: () => set({ 
          authError: null, 
          clientsError: null, 
          timelineError: null, 
          analyticsError: null 
        }),

        // Batch Property Actions
        createAndParseBatch: async (clientId: string, timelineId: string, mlsUrls: string[]) => {
          set({ batchLoading: true, batchError: null });

          try {
            console.log('Store: Creating batch with URLs:', mlsUrls.length);
            const response = await apiClient.createInstantBatch(clientId, timelineId, mlsUrls);
            
            if (response.error) {
              set({ batchError: response.error, batchLoading: false });
              
              get().addNotification({
                type: 'error',
                title: 'Batch Creation Failed',
                message: response.error,
                read: false,
              });
              
              return;
            }

            if (response.data) {
              console.log('Store: Batch created successfully:', response.data.batchId);
              
              // Get initial batch status
              const batchResponse = await apiClient.getBatchStatus(response.data.batchId);
              
              if (batchResponse.data) {
                set({
                  currentBatch: batchResponse.data,
                  batchLoading: false,
                  batchError: null,
                });
              }

              get().addNotification({
                type: 'success',
                title: 'Batch Processing Started',
                message: `Started parsing ${response.data.totalUrls} properties`,
                read: false,
              });
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to create batch';
            console.error('Store: Batch creation error:', errorMessage);
            set({ batchError: errorMessage, batchLoading: false });
            
            get().addNotification({
              type: 'error',
              title: 'Batch Error',
              message: errorMessage,
              read: false,
            });
          }
        },

        getBatchStatus: async (batchId: string) => {
          try {
            console.log('Store: Getting batch status:', batchId);
            const response = await apiClient.getBatchStatus(batchId);
            
            if (response.error) {
              set({ batchError: response.error });
              return;
            }

            if (response.data) {
              set({
                currentBatch: response.data,
                batchError: null,
              });
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to get batch status';
            console.error('Store: Batch status error:', errorMessage);
            set({ batchError: errorMessage });
          }
        },

        importBatchProperties: async (batchId: string, properties: any[]) => {
          set({ batchLoading: true, batchError: null });

          try {
            console.log('Store: Importing batch properties:', properties.length);
            const response = await apiClient.importBatchProperties(batchId, properties);
            
            if (response.error) {
              set({ batchError: response.error, batchLoading: false });
              
              get().addNotification({
                type: 'error',
                title: 'Import Failed',
                message: response.error,
                read: false,
              });
              
              return;
            }

            if (response.data) {
              console.log('Store: Properties imported successfully');
              
              set({ batchLoading: false, batchError: null });

              get().addNotification({
                type: 'success',
                title: 'Import Successful',
                message: `Imported ${response.data.summary.successful} properties`,
                read: false,
              });

              // Refresh the timeline to show new properties
              const state = get();
              if (state.selectedClient) {
                await get().loadTimeline(state.selectedClient.id);
              }

              return response.data;
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to import properties';
            console.error('Store: Import error:', errorMessage);
            set({ batchError: errorMessage, batchLoading: false });
            
            get().addNotification({
              type: 'error',
              title: 'Import Error',
              message: errorMessage,
              read: false,
            });
          }
        },

        clearCurrentBatch: () => {
          set({
            currentBatch: null,
            batchLoading: false,
            batchError: null,
          });
        },
      })),
      {
        name: 'mission-control-store',
        partialize: (state) => ({
          sidebarOpen: state.sidebarOpen,
          selectedView: state.selectedView,
          userPreferences: state.userPreferences,
        }),
      }
    ),
    { name: 'Mission Control Store' }
  )
);

// API Client Integration Setup
export const initializeApiClientIntegration = () => {
  apiClient.onAuthenticationExpired(() => {
    console.log('API Client: Authentication expired - logging out');
    useMissionControlStore.getState().logout();
  });

  apiClient.onAuthenticationRefreshed((user) => {
    console.log('API Client: Token refreshed - updating user');
    useMissionControlStore.getState().setUser(user);
  });

  useMissionControlStore.getState().checkAuthStatus();
};

// Hooks for Components
export const useAuth = () => {
  const { user, isAuthenticated, isLoading, authError, login, logout } = useMissionControlStore();
  return { user, isAuthenticated, isLoading, authError, login, logout };
};

export const useClients = () => {
  const { clients, selectedClient, clientsLoading, clientsError, loadClients, createClient, selectClient } = useMissionControlStore();
  return { clients, selectedClient, clientsLoading, clientsError, loadClients, createClient, selectClient };
};

export const useTimeline = () => {
  const { activeTimeline, timelineLoading, timelineError, loadTimeline, addProperty } = useMissionControlStore();
  return { activeTimeline, timelineLoading, timelineError, loadTimeline, addProperty };
};

export const useAnalytics = () => {
  const { analytics, analyticsLoading, analyticsError, loadAnalytics } = useMissionControlStore();
  return { analytics, analyticsLoading, analyticsError, loadAnalytics };
};

export const useNotifications = () => {
  const { notifications, addNotification, removeNotification, markNotificationAsRead, clearAllNotifications } = useMissionControlStore();
  return { notifications, addNotification, removeNotification, markNotificationAsRead, clearAllNotifications };
};

// User Preferences Hook
export const useUserPreferences = () => {
  const { userPreferences, updateUserPreferences, loadUserPreferences, resetPreferencesToDefaults } = useMissionControlStore();
  return { userPreferences, updateUserPreferences, loadUserPreferences, resetPreferencesToDefaults };
};
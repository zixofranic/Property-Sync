// apps/web/src/stores/missionControlStore.ts - FIXED: Updated to use correct API methods

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { apiClient, type ClientResponse, type TimelineResponse, type AnalyticsDashboard } from '@/lib/api-client';

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
  notifications: {
    email: boolean;
    desktop: boolean;
    feedback: boolean;
    newProperties: boolean;
  };
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
  mlsLink?: string;
  addedAt: string;
  clientFeedback?: 'love' | 'like' | 'dislike';
  notes?: string;
  isActive: boolean;
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
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

// Store State Interface
interface MissionControlState {
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
}

// Store Actions Interface
interface MissionControlActions {
  // Authentication Actions
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  setUser: (user: User) => void;
  checkAuthStatus: () => void;
  refreshAuth: () => Promise<boolean>;
  loadProfile: () => Promise<void>;

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
  sendTimelineEmail: (timelineId: string) => Promise<void>;
  revokeTimelineAccess: (timelineId: string) => Promise<void>;

  // Analytics Actions
  loadAnalytics: () => Promise<void>;
  loadDashboardAnalytics: () => Promise<void>;

  // Notification Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  markNotificationAsRead: (id: string) => void;
  clearAllNotifications: () => void;

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
  checkMLSDuplicate: (clientId: string, mlsLink: string) => boolean;
  addClient: (clientData: any) => Promise<Client | null>;
}

// Default preferences
const defaultPreferences: UserPreferences = {
  emailTemplateStyle: 'modern',
  notifications: {
    email: true,
    desktop: true,
    feedback: true,
    newProperties: true,
  },
  theme: 'dark',
  soundEnabled: true,
  timezone: 'America/New_York',
  brandColor: '#3b82f6',
  logo: '',
};

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

              // Load data immediately after successful login
              console.log('Store: Loading data after successful login...');
              setTimeout(async () => {
                try {
                  await Promise.allSettled([
                    get().loadClients(),
                    get().loadDashboardAnalytics(),
                    get().loadUserPreferences()
                  ]);
                  console.log('Store: Post-login data loading complete');
                } catch (error) {
                  console.warn('Store: Some data failed to load after login:', error);
                }
              }, 100);

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
            selectedView: 'clients',
            activeModal: null,
            editingProperty: null,
            bulkMode: false,
            pollingInterval: null,
            retryCount: 0,
            lastDataLoadAttempt: 0,
            isRetrying: false,
          });

          // Redirect to login
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        },

        setUser: (user: User) => {
          console.log('Store: Setting user:', user.email);
          set({ user, isAuthenticated: true });
        },

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
            
            // Load data after confirming auth on refresh
            setTimeout(async () => {
              console.log('Store: Loading data after auth check...');
              try {
                await Promise.allSettled([
                  get().loadClients(),
                  get().loadDashboardAnalytics(),
                  get().loadUserPreferences()
                ]);
                console.log('Store: Post-auth data loading complete');
              } catch (error) {
                console.warn('Store: Some data failed to load after auth check:', error);
              }
            }, 100);
          } else {
            console.log('Store: Auth status invalid');
            set({
              isAuthenticated: false,
              user: null,
            });
          }
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
          try {
            console.log('Store: Loading user preferences...');
            const response = await apiClient.getUserPreferences();
            
            if (response.error) {
              console.warn('Store: Preferences loading failed, using defaults:', response.error);
              // Don't throw - just use defaults silently
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
            // Don't throw - gracefully degrade to defaults
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

            const response = await apiClient.getUserProfile();
            
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
                firstName: response.data.profile?.firstName || '',
                lastName: response.data.profile?.lastName || '',
                plan: response.data.profile?.plan || 'FREE',
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

        // Use getUserProfile for profile loading
        loadProfile: async () => {
          try {
            console.log('Store: Loading profile...');
            const response = await apiClient.getUserProfile();
            
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

        // Client Management
        loadClients: async () => {
          const state = get();
          
          if (state.clientsLoading) {
            console.log('Store: Clients already loading');
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
            const response = await apiClient.updateClient(clientId, updates);
            
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

        addProperty: async (clientIdOrData: string | Omit<Property, 'id' | 'clientId' | 'addedAt'>, propertyData?: Omit<Property, 'id' | 'clientId' | 'addedAt'>) => {
          let clientId: string;
          let data: Omit<Property, 'id' | 'clientId' | 'addedAt'>;
          
          // Handle both signatures
          if (typeof clientIdOrData === 'string') {
            clientId = clientIdOrData;
            data = propertyData!;
          } else {
            const selectedClient = get().selectedClient;
            if (!selectedClient) {
              get().addNotification({
                type: 'error',
                title: 'No Client Selected',
                message: 'Please select a client first',
                read: false,
              });
              return;
            }
            clientId = selectedClient.id;
            data = clientIdOrData;
          }

          // Ensure timeline exists for this client
          let timeline = get().getClientTimeline(clientId);
          if (!timeline) {
            console.log('Store: No timeline found, loading for client:', clientId);
            await get().loadTimeline(clientId);
            timeline = get().getClientTimeline(clientId);
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
              address: data.address,
              price: data.price,
              description: data.description,
              imageUrl: data.imageUrl,
              mlsLink: data.mlsLink,
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
                message: `${data.address} has been added to the timeline`,
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

        sendTimelineEmail: async (timelineId: string) => {
          try {
            console.log('Store: Sending timeline email for:', timelineId);
            const response = await apiClient.sendTimelineEmail(timelineId);
            
            if (response.error) {
              set({ timelineError: response.error });
              
              get().addNotification({
                type: 'error',
                title: 'Email Send Failed',
                message: response.error,
                read: false,
              });
              
              return;
            }

            if (response.data) {
              console.log('Store: Timeline email sent successfully');
              get().addNotification({
                type: 'success',
                title: 'Timeline Sent!',
                message: `Timeline email sent to ${response.data.sentTo}`,
                read: false,
              });
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to send timeline email';
            set({ timelineError: errorMessage });
            
            get().addNotification({
              type: 'error',
              title: 'Email Error',
              message: errorMessage,
              read: false,
            });
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
            id: crypto.randomUUID(),
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

        checkMLSDuplicate: (clientId: string, mlsLink: string): boolean => {
          const timeline = get().getClientTimeline(clientId);
          if (!timeline?.properties) return false;
          
          return timeline.properties.some(property => 
            property.mlsLink && property.mlsLink === mlsLink
          );
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
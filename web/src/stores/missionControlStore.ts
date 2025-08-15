// apps/web/src/stores/missionControlStore.ts - COMPLETE WITH ALL MISSING FUNCTIONS

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { apiClient, type ClientResponse, type TimelineResponse, type AnalyticsDashboard } from '@/lib/api-client';

// 🔧 Store Types
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  plan: string;
  emailVerified: boolean;
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

// 🔔 Notification Interface
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

// 🔧 Store State Interface
interface MissionControlState {
  // 🔐 Authentication State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;

  // 👥 Client Management
  clients: Client[];
  selectedClient: Client | null;
  clientsLoading: boolean;
  clientsError: string | null;

  // 📈 Timeline Management
  activeTimeline: Timeline | null;
  timelineLoading: boolean;
  timelineError: string | null;

  // 📊 Analytics
  analytics: AnalyticsDashboard | null;
  analyticsLoading: boolean;
  analyticsError: string | null;

  // 🔔 Notifications
  notifications: Notification[];

  // 🔧 UI State
  sidebarOpen: boolean;
  selectedView: 'clients' | 'timeline' | 'analytics';
  activeModal: string | null;
  editingProperty: Property | null;
  bulkMode: boolean;
}

// 🔧 Store Actions Interface
interface MissionControlActions {
  // 🔐 Authentication Actions
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  setUser: (user: User) => void;
  checkAuthStatus: () => void;

  // 👥 Client Actions
  loadClients: () => Promise<void>;
  createClient: (clientData: Partial<Client>) => Promise<Client | null>;
  updateClient: (clientId: string, updates: Partial<Client>) => Promise<void>;
  deleteClient: (clientId: string) => Promise<void>;
  selectClient: (client: Client | null) => void;

  // 📈 Timeline Actions
  loadTimeline: (clientId: string) => Promise<void>;
  addProperty: (propertyData: Omit<Property, 'id' | 'clientId' | 'addedAt'>) => Promise<void>;
  updateProperty: (propertyId: string, updates: Partial<Property>) => Promise<void>;
  deleteProperty: (propertyId: string) => Promise<void>;
  sendTimelineEmail: (timelineId: string) => Promise<void>;
  revokeTimelineAccess: (timelineId: string) => Promise<void>;

  // 📊 Analytics Actions
  loadAnalytics: () => Promise<void>;

  // 🔔 Notification Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  markNotificationAsRead: (id: string) => void;
  clearAllNotifications: () => void;

  // 🔧 UI Actions
  setSidebarOpen: (open: boolean) => void;
  setSelectedView: (view: 'clients' | 'timeline' | 'analytics') => void;
  setActiveModal: (modal: string | null) => void;
  setEditingProperty: (property: Property | null) => void;
  clearErrors: () => void;

  // 🔧 Helper Actions
  getClientTimeline: (clientId: string) => Timeline | null;
  getPropertyById: (propertyId: string) => Property | undefined;
  updatePropertyFeedback: (propertyId: string, feedback: 'love' | 'like' | 'dislike', notes?: string) => void;
  sendBulkProperties: (clientId: string) => void;
}

// 🏪 Zustand Store Creation
export const useMissionControlStore = create<MissionControlState & MissionControlActions>()(
  devtools(
    persist(
      subscribeWithSelector((set, get) => ({
        // 🔐 Initial Authentication State
        user: null,
        isAuthenticated: false,
        isLoading: false,
        authError: null,

        // 👥 Initial Client State
        clients: [],
        selectedClient: null,
        clientsLoading: false,
        clientsError: null,

        // 📈 Initial Timeline State
        activeTimeline: null,
        timelineLoading: false,
        timelineError: null,

        // 📊 Initial Analytics State
        analytics: null,
        analyticsLoading: false,
        analyticsError: null,

        // 🔔 Initial Notifications State
        notifications: [],

        // 🔧 Initial UI State
        sidebarOpen: true,
        selectedView: 'clients',
        activeModal: null,
        editingProperty: null,
        bulkMode: false,

        // 🔐 Authentication Actions
        login: async (email: string, password: string): Promise<boolean> => {
          set({ isLoading: true, authError: null });

          try {
            const response = await apiClient.login(email, password);
            
            if (response.error) {
              set({ authError: response.error, isLoading: false });
              
              // Add error notification
              get().addNotification({
                type: 'error',
                title: 'Login Failed',
                message: response.error,
                read: false,
              });
              
              return false;
            }

            if (response.data) {
              set({
                user: response.data.user,
                isAuthenticated: true,
                isLoading: false,
                authError: null,
              });

              // Add success notification
              get().addNotification({
                type: 'success',
                title: 'Welcome Back!',
                message: `Logged in as ${response.data.user.firstName} ${response.data.user.lastName}`,
                read: false,
              });

              // Load initial data after successful login
              get().loadClients();
              get().loadAnalytics();

              return true;
            }

            return false;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Login failed';
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
          // Clear API client tokens
          apiClient.logout();

          // Reset all store state
          set({
            user: null,
            isAuthenticated: false,
            authError: null,
            clients: [],
            selectedClient: null,
            activeTimeline: null,
            analytics: null,
            notifications: [], // Clear notifications on logout
            selectedView: 'clients',
            activeModal: null,
            editingProperty: null,
            bulkMode: false,
          });
        },

        setUser: (user: User) => {
          set({ user, isAuthenticated: true });
        },

        checkAuthStatus: () => {
          const isAuth = apiClient.isAuthenticated();
          const storedUser = apiClient.getStoredUser();
          
          set({
            isAuthenticated: isAuth,
            user: storedUser,
          });

          // If not authenticated, redirect to login
          if (!isAuth && typeof window !== 'undefined') {
            window.location.href = '/login';
          }
        },

        // 👥 Client Actions
        loadClients: async () => {
          set({ clientsLoading: true, clientsError: null });

          try {
            const response = await apiClient.getClients();
            
            if (response.error) {
              set({ clientsError: response.error, clientsLoading: false });
              
              get().addNotification({
                type: 'error',
                title: 'Failed to Load Clients',
                message: response.error,
                read: false,
              });
              
              return;
            }

            if (response.data) {
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
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load clients';
            set({ clientsError: errorMessage, clientsLoading: false });
            
            get().addNotification({
              type: 'error',
              title: 'Network Error',
              message: errorMessage,
              read: false,
            });
          }
        },

        createClient: async (clientData: Partial<Client>): Promise<Client | null> => {
          set({ clientsLoading: true, clientsError: null });

          try {
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
          set({ selectedClient: client });
          
          // Auto-load timeline when client is selected
          if (client) {
            get().loadTimeline(client.id);
          } else {
            set({ activeTimeline: null });
          }
        },

        // 📈 Timeline Actions
        loadTimeline: async (clientId: string) => {
          set({ timelineLoading: true, timelineError: null });

          try {
            const response = await apiClient.getTimeline(clientId);
            
            if (response.error) {
              set({ timelineError: response.error, timelineLoading: false });
              return;
            }

            if (response.data) {
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
            set({ timelineError: errorMessage, timelineLoading: false });
          }
        },

        addProperty: async (propertyData: Omit<Property, 'id' | 'clientId' | 'addedAt'>) => {
          const { activeTimeline } = get();
          if (!activeTimeline?.id) return;

          set({ timelineLoading: true, timelineError: null });

          try {
            const response = await apiClient.addProperty(activeTimeline.id, {
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

            // Update timeline with new share token
            if (response.data?.newShareToken) {
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

        // 📊 Analytics Actions
        loadAnalytics: async () => {
          set({ analyticsLoading: true, analyticsError: null });

          try {
            const response = await apiClient.getDashboardAnalytics();
            
            if (response.error) {
              set({ analyticsError: response.error, analyticsLoading: false });
              return;
            }

            if (response.data) {
              set({
                analytics: response.data,
                analyticsLoading: false,
                analyticsError: null,
              });
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load analytics';
            set({ analyticsError: errorMessage, analyticsLoading: false });
          }
        },

        // 🔔 Notification Actions
        addNotification: (notificationData: Omit<Notification, 'id' | 'timestamp'>) => {
          const notification: Notification = {
            ...notificationData,
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          };

          set((state) => ({
            notifications: [notification, ...state.notifications].slice(0, 10), // Keep only last 10
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

        // 🔧 UI Actions
        setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
        setSelectedView: (view: 'clients' | 'timeline' | 'analytics') => set({ selectedView: view }),
        setActiveModal: (modal: string | null) => set({ activeModal: modal }),
        setEditingProperty: (property: Property | null) => set({ editingProperty: property }),

        // 🔧 Helper Actions
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
          // Only persist UI preferences, not sensitive data
          sidebarOpen: state.sidebarOpen,
          selectedView: state.selectedView,
        }),
      }
    ),
    { name: 'Mission Control Store' }
  )
);

// 🔗 API Client Integration Setup
// Call this in your app initialization (e.g., _app.tsx or layout.tsx)
export const initializeApiClientIntegration = () => {
  // Set up API client callbacks
  apiClient.onAuthenticationExpired(() => {
    console.log('🔐 Authentication expired - logging out');
    useMissionControlStore.getState().logout();
    
    // Redirect to login page
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  });

  apiClient.onAuthenticationRefreshed((user) => {
    console.log('🔄 Token refreshed - updating user');
    useMissionControlStore.getState().setUser(user);
  });

  // Check initial auth status
  useMissionControlStore.getState().checkAuthStatus();
};

// 🎣 Useful Hooks for Components
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
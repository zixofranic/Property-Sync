import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TimelineNotification {
  id: string;
  type: 'new-properties' | 'timeline-update' | 'feedback-request';
  timelineId: string;
  timelineTitle: string;
  agentName: string;
  count?: number; // For new properties
  message?: string; // For updates
  propertyAddress?: string; // For feedback requests
  propertyCount?: number; // Total properties in timeline
  createdAt: string;
  isRead: boolean;
  isVisible: boolean;
}

export interface NotificationSettings {
  browserNotifications: boolean;
  bannerNotifications: boolean;
  newProperties: boolean;
  timelineUpdates: boolean;
  feedbackRequests: boolean;
  soundEnabled: boolean;
}

interface NotificationStore {
  // State
  notifications: TimelineNotification[];
  settings: NotificationSettings;
  isInitialized: boolean;
  permissionStatus: NotificationPermission;
  notificationTimers: Map<string, NodeJS.Timeout>;
  
  // Actions
  addNotification: (notification: Omit<TimelineNotification, 'id' | 'createdAt' | 'isRead' | 'isVisible'>) => void;
  markAsRead: (notificationId: string) => void;
  dismissNotification: (notificationId: string) => void;
  hideNotification: (notificationId: string) => void;
  clearAllNotifications: () => void;
  clearTimelineNotifications: (timelineId: string) => void;
  
  // Settings
  updateSettings: (settings: Partial<NotificationSettings>) => void;
  setPermissionStatus: (status: NotificationPermission) => void;
  setInitialized: (initialized: boolean) => void;
  
  // Getters
  getUnreadCount: () => number;
  getVisibleNotifications: () => TimelineNotification[];
  getTimelineNotifications: (timelineId: string) => TimelineNotification[];
  hasNewPropertiesNotification: (timelineId: string) => boolean;
}

const defaultSettings: NotificationSettings = {
  browserNotifications: false, // Start disabled, user must opt-in
  bannerNotifications: true,   // Banner notifications enabled by default
  newProperties: true,
  timelineUpdates: true,
  feedbackRequests: true,
  soundEnabled: false
};

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      // Initial state
      notifications: [],
      settings: defaultSettings,
      isInitialized: false,
      permissionStatus: 'default',
      notificationTimers: new Map(),

      // Actions
      addNotification: (notificationData) => {
        const notification: TimelineNotification = {
          ...notificationData,
          id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
          isRead: false,
          isVisible: true
        };

        set((state) => ({
          notifications: [notification, ...state.notifications]
        }));

        // Auto-hide banner notifications after 10 seconds if not interacted with
        if (notification.type === 'new-properties') {
          const timers = get().notificationTimers;
          
          // Clear any existing timer for this notification ID (safety check)
          const existingTimer = timers.get(notification.id);
          if (existingTimer) {
            clearTimeout(existingTimer);
          }
          
          const timer = setTimeout(() => {
            const currentNotification = get().notifications.find(n => n.id === notification.id);
            if (currentNotification && currentNotification.isVisible && !currentNotification.isRead) {
              get().hideNotification(notification.id);
            }
            // Clean up timer reference
            get().notificationTimers.delete(notification.id);
          }, 10000);
          
          // Store timer reference
          timers.set(notification.id, timer);
        }
      },

      markAsRead: (notificationId) => {
        set((state) => ({
          notifications: state.notifications.map(n =>
            n.id === notificationId ? { ...n, isRead: true } : n
          )
        }));
      },

      dismissNotification: (notificationId) => {
        // Clear timer if exists
        const timers = get().notificationTimers;
        const timer = timers.get(notificationId);
        if (timer) {
          clearTimeout(timer);
          timers.delete(notificationId);
        }
        
        set((state) => ({
          notifications: state.notifications.filter(n => n.id !== notificationId)
        }));
      },

      hideNotification: (notificationId) => {
        // Clear timer if exists
        const timers = get().notificationTimers;
        const timer = timers.get(notificationId);
        if (timer) {
          clearTimeout(timer);
          timers.delete(notificationId);
        }
        
        set((state) => ({
          notifications: state.notifications.map(n =>
            n.id === notificationId ? { ...n, isVisible: false } : n
          )
        }));
      },

      clearAllNotifications: () => {
        // Clear all timers
        const timers = get().notificationTimers;
        for (const timer of timers.values()) {
          clearTimeout(timer);
        }
        timers.clear();
        
        set({ notifications: [] });
      },

      clearTimelineNotifications: (timelineId) => {
        // Clear timers for notifications being removed
        const timers = get().notificationTimers;
        const notificationsToRemove = get().notifications.filter(n => n.timelineId === timelineId);
        
        notificationsToRemove.forEach(notification => {
          const timer = timers.get(notification.id);
          if (timer) {
            clearTimeout(timer);
            timers.delete(notification.id);
          }
        });
        
        set((state) => ({
          notifications: state.notifications.filter(n => n.timelineId !== timelineId)
        }));
      },

      // Settings
      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings }
        }));
      },

      setPermissionStatus: (status) => {
        set({ permissionStatus: status });
        
        // If permission is denied or default, disable browser notifications
        if (status !== 'granted') {
          set((state) => ({
            settings: { ...state.settings, browserNotifications: false }
          }));
        }
      },

      setInitialized: (initialized) => {
        set({ isInitialized: initialized });
      },

      // Getters
      getUnreadCount: () => {
        return get().notifications.filter(n => !n.isRead).length;
      },

      getVisibleNotifications: () => {
        return get().notifications.filter(n => n.isVisible);
      },

      getTimelineNotifications: (timelineId) => {
        return get().notifications.filter(n => n.timelineId === timelineId);
      },

      hasNewPropertiesNotification: (timelineId) => {
        const notifications = get().getTimelineNotifications(timelineId);
        return notifications.some(n => 
          n.type === 'new-properties' && n.isVisible && !n.isRead
        );
      }
    }),
    {
      name: 'property-sync-notifications',
      // Only persist settings and read status, not the notifications themselves or timers
      partialize: (state) => ({
        settings: state.settings,
        notifications: state.notifications.map(n => ({
          ...n,
          isVisible: false // Don't persist visibility state
        }))
        // notificationTimers are excluded from persistence as they can't be serialized
      })
    }
  )
);

// Helper functions
export const createNewPropertiesNotification = (
  timelineId: string,
  timelineTitle: string,
  agentName: string,
  count: number,
  propertyCount?: number
): Omit<TimelineNotification, 'id' | 'createdAt' | 'isRead' | 'isVisible'> => ({
  type: 'new-properties',
  timelineId,
  timelineTitle,
  agentName,
  count,
  propertyCount
});

export const createTimelineUpdateNotification = (
  timelineId: string,
  timelineTitle: string,
  agentName: string,
  message: string
): Omit<TimelineNotification, 'id' | 'createdAt' | 'isRead' | 'isVisible'> => ({
  type: 'timeline-update',
  timelineId,
  timelineTitle,
  agentName,
  message
});

export const createFeedbackRequestNotification = (
  timelineId: string,
  timelineTitle: string,
  agentName: string,
  propertyAddress: string
): Omit<TimelineNotification, 'id' | 'createdAt' | 'isRead' | 'isVisible'> => ({
  type: 'feedback-request',
  timelineId,
  timelineTitle,
  agentName,
  propertyAddress
});
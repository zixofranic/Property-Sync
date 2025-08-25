// Browser Push Notifications Service for Property Sync
// Phase 3: Optional real-time notifications

interface PushNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  actions?: NotificationAction[];
  requireInteraction?: boolean;
  silent?: boolean;
}

export class PushNotificationManager {
  private static instance: PushNotificationManager;
  private registration: ServiceWorkerRegistration | null = null;
  private isSupported = false;
  private permission: NotificationPermission = 'default';

  private constructor() {
    this.checkSupport();
    this.updatePermission();
  }

  static getInstance(): PushNotificationManager {
    if (!PushNotificationManager.instance) {
      PushNotificationManager.instance = new PushNotificationManager();
    }
    return PushNotificationManager.instance;
  }

  private checkSupport(): void {
    this.isSupported = 
      'Notification' in window && 
      'serviceWorker' in navigator && 
      'PushManager' in window;
  }

  private updatePermission(): void {
    if (this.isSupported) {
      this.permission = Notification.permission;
    }
  }

  // Check if push notifications are supported
  isNotificationSupported(): boolean {
    return this.isSupported;
  }

  // Get current permission status
  getPermissionStatus(): NotificationPermission {
    this.updatePermission();
    return this.permission;
  }

  // Request permission for notifications
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      throw new Error('Push notifications are not supported in this browser');
    }

    if (this.permission === 'granted') {
      return this.permission;
    }

    try {
      this.permission = await Notification.requestPermission();
      return this.permission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      throw error;
    }
  }

  // Show immediate notification (not push)
  async showNotification(options: PushNotificationOptions): Promise<void> {
    if (!this.isSupported || this.permission !== 'granted') {
      throw new Error('Notifications not supported or permission not granted');
    }

    try {
      // If we have a service worker, use it for consistency
      if (this.registration) {
        await this.registration.showNotification(options.title, {
          body: options.body,
          icon: options.icon || '/icons/property-sync-icon-192.png',
          badge: options.badge || '/icons/property-sync-badge-72.png',
          tag: options.tag,
          data: options.data,
          actions: options.actions,
          requireInteraction: options.requireInteraction,
          silent: options.silent,
        });
      } else {
        // Fallback to direct notification
        const notification = new Notification(options.title, {
          body: options.body,
          icon: options.icon || '/icons/property-sync-icon-192.png',
          tag: options.tag,
          data: options.data,
          requireInteraction: options.requireInteraction,
          silent: options.silent,
        });

        // Handle notification click
        notification.onclick = () => {
          window.focus();
          notification.close();
          if (options.data?.url) {
            window.location.href = options.data.url;
          }
        };
      }
    } catch (error) {
      console.error('Error showing notification:', error);
      throw error;
    }
  }

  // Register service worker for push notifications
  async registerServiceWorker(): Promise<ServiceWorkerRegistration> {
    if (!this.isSupported) {
      throw new Error('Service workers are not supported');
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw-push.js', {
        scope: '/'
      });

      console.log('Service worker registered successfully:', this.registration);
      return this.registration;
    } catch (error) {
      console.error('Service worker registration failed:', error);
      throw error;
    }
  }

  // Property-specific notification methods
  async notifyNewProperties(count: number, timelineTitle: string, timelineUrl?: string): Promise<void> {
    await this.showNotification({
      title: `${count} New Propert${count === 1 ? 'y' : 'ies'} Added!`,
      body: `Your agent added ${count === 1 ? 'a new property' : `${count} new properties`} to ${timelineTitle}`,
      icon: '/icons/property-sync-icon-192.png',
      badge: '/icons/property-sync-badge-72.png',
      tag: 'new-properties',
      data: {
        type: 'new-properties',
        count,
        timelineTitle,
        url: timelineUrl
      },
      actions: [
        {
          action: 'view',
          title: 'View Properties'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ],
      requireInteraction: true
    });
  }

  async notifyTimelineUpdate(agentName: string, message: string, timelineUrl?: string): Promise<void> {
    await this.showNotification({
      title: `Update from ${agentName}`,
      body: message,
      icon: '/icons/property-sync-icon-192.png',
      tag: 'timeline-update',
      data: {
        type: 'timeline-update',
        agentName,
        url: timelineUrl
      },
      actions: [
        {
          action: 'view',
          title: 'View Timeline'
        }
      ]
    });
  }

  async notifyPropertyFeedbackRequest(propertyAddress: string, timelineUrl?: string): Promise<void> {
    await this.showNotification({
      title: 'Feedback Requested',
      body: `Your agent would like your feedback on ${propertyAddress}`,
      icon: '/icons/property-sync-icon-192.png',
      tag: 'feedback-request',
      data: {
        type: 'feedback-request',
        propertyAddress,
        url: timelineUrl
      },
      actions: [
        {
          action: 'feedback',
          title: 'Give Feedback'
        }
      ]
    });
  }

  // Initialize push notifications for Property Sync
  async initialize(): Promise<{
    supported: boolean;
    permission: NotificationPermission;
    registration?: ServiceWorkerRegistration;
  }> {
    const result = {
      supported: this.isSupported,
      permission: this.permission,
      registration: undefined as ServiceWorkerRegistration | undefined
    };

    if (!this.isSupported) {
      console.warn('Push notifications are not supported in this browser');
      return result;
    }

    try {
      // Register service worker
      result.registration = await this.registerServiceWorker();

      // Request permission if not already granted
      if (this.permission === 'default') {
        result.permission = await this.requestPermission();
      }

      console.log('Push notifications initialized:', result);
      return result;
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
      return result;
    }
  }
}

// Export singleton instance
export const pushManager = PushNotificationManager.getInstance();

// Utility functions for easy access
export const initializePushNotifications = () => pushManager.initialize();
export const requestNotificationPermission = () => pushManager.requestPermission();
export const notifyNewProperties = (count: number, timelineTitle: string, timelineUrl?: string) =>
  pushManager.notifyNewProperties(count, timelineTitle, timelineUrl);
export const notifyTimelineUpdate = (agentName: string, message: string, timelineUrl?: string) =>
  pushManager.notifyTimelineUpdate(agentName, message, timelineUrl);
export const notifyPropertyFeedbackRequest = (propertyAddress: string, timelineUrl?: string) =>
  pushManager.notifyPropertyFeedbackRequest(propertyAddress, timelineUrl);
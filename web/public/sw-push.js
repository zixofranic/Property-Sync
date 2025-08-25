// Property Sync Push Notification Service Worker
// Handles background push notifications and click events

const CACHE_NAME = 'property-sync-notifications-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('Push notification service worker installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Push notification service worker activating...');
  event.waitUntil(self.clients.claim());
});

// Handle push events (for server-sent pushes - future enhancement)
self.addEventListener('push', (event) => {
  console.log('Push received:', event);

  if (!event.data) {
    console.warn('Push event but no data');
    return;
  }

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: data.icon || '/icons/property-sync-icon-192.png',
    badge: '/icons/property-sync-badge-72.png',
    tag: data.tag,
    data: data.data,
    actions: data.actions,
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click events
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  event.notification.close();

  const action = event.action;
  const data = event.notification.data;

  event.waitUntil(
    (async () => {
      // Get all clients
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      });

      // Handle different actions
      switch (action) {
        case 'view':
        case 'feedback':
          if (data?.url) {
            // If we have a URL, navigate to it
            const urlToOpen = new URL(data.url, self.location.origin).href;
            
            // Check if we already have a window open to this URL
            for (const client of clientList) {
              if (client.url === urlToOpen) {
                return client.focus();
              }
            }
            
            // No window open to this URL, open a new one
            return self.clients.openWindow(urlToOpen);
          } else {
            // No specific URL, just focus the first available client
            if (clientList.length > 0) {
              return clientList[0].focus();
            }
            return self.clients.openWindow('/dashboard');
          }

        case 'dismiss':
          // Just close the notification (already done above)
          return Promise.resolve();

        default:
          // Default action - open the app
          if (data?.url) {
            const urlToOpen = new URL(data.url, self.location.origin).href;
            
            for (const client of clientList) {
              if (client.url === urlToOpen) {
                return client.focus();
              }
            }
            
            return self.clients.openWindow(urlToOpen);
          } else {
            if (clientList.length > 0) {
              return clientList[0].focus();
            }
            return self.clients.openWindow('/dashboard');
          }
      }
    })()
  );
});

// Handle notification close events
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
  
  const data = event.notification.data;
  
  // Track notification dismissal for analytics (future enhancement)
  if (data?.type) {
    console.log(`Notification dismissed: ${data.type}`);
  }
});

// Handle background sync (future enhancement for offline functionality)
self.addEventListener('sync', (event) => {
  console.log('Background sync:', event);
  
  if (event.tag === 'property-sync-feedback') {
    event.waitUntil(
      // Sync pending feedback when back online
      console.log('Syncing pending feedback...')
    );
  }
});

// Message handling for communication with the main app
self.addEventListener('message', (event) => {
  console.log('Service worker received message:', event.data);
  
  const { type, data } = event.data;
  
  switch (type) {
    case 'SHOW_NOTIFICATION':
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon || '/icons/property-sync-icon-192.png',
        badge: '/icons/property-sync-badge-72.png',
        tag: data.tag,
        data: data.data,
        actions: data.actions,
        requireInteraction: data.requireInteraction || false,
        silent: data.silent || false,
      });
      break;
      
    case 'CLEAR_NOTIFICATIONS':
      // Clear all notifications with specific tag
      self.registration.getNotifications({ tag: data.tag }).then(notifications => {
        notifications.forEach(notification => notification.close());
      });
      break;
      
    default:
      console.log('Unknown message type:', type);
  }
});

// Error handling
self.addEventListener('error', (event) => {
  console.error('Service worker error:', event);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Service worker unhandled rejection:', event);
});
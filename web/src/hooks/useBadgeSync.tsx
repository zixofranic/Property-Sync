// P2-7: Badge Synchronization Hook
// Syncs missionControlStore notifications to UnifiedBadgeContext

'use client';

import { useEffect, useRef } from 'react';
import { useMissionControlStore, Notification } from '@/stores/missionControlStore';
import { useUnifiedBadges } from '@/contexts/UnifiedBadgeContext';

/**
 * P2-7: Hook to sync missionControlStore notifications to unified badge system
 * This bridges the legacy notification system with the new unified badge system
 */
export function useBadgeSync() {
  const { notifications } = useMissionControlStore();
  const unifiedBadges = useUnifiedBadges();
  const syncedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    console.log('🔄 P2-7: Syncing notifications to unified badge system');

    // Track which notification IDs we've already synced
    const currentNotificationIds = new Set(notifications.map(n => n.id));
    const previousSyncedIds = new Set(syncedIdsRef.current);

    // Find new notifications that need to be added
    const newNotifications = notifications.filter(n => !previousSyncedIds.has(n.id));

    // Find removed notifications that need to be deleted
    const removedIds = Array.from(previousSyncedIds).filter(id => !currentNotificationIds.has(id));

    // Add new notifications as badges
    newNotifications.forEach((notification: Notification) => {
      const badgeType = notification.type === 'feedback' || notification.feedbackType
        ? 'feedback'
        : 'notification';

      const badgeColor = badgeType === 'feedback' ? 'purple' : 'red';

      unifiedBadges.addBadge({
        type: badgeType,
        count: 1,
        read: notification.read,
        clientId: notification.clientId,
        clientName: notification.clientName,
        propertyId: notification.propertyId,
        propertyAddress: notification.propertyAddress,
        title: notification.title,
        message: notification.message,
        color: badgeColor,
        metadata: {
          feedbackType: notification.feedbackType,
          eventType: notification.metadata?.eventType,
          ...notification.metadata,
        },
      });

      syncedIdsRef.current.add(notification.id);
      console.log(`✅ P2-7: Synced ${badgeType} notification ${notification.id} to unified badges`);
    });

    // Remove deleted notifications
    removedIds.forEach(id => {
      unifiedBadges.removeBadge(id);
      syncedIdsRef.current.delete(id);
      console.log(`🗑️ P2-7: Removed notification ${id} from unified badges`);
    });

    // Update existing notifications if their read status changed
    notifications.forEach((notification: Notification) => {
      if (previousSyncedIds.has(notification.id)) {
        unifiedBadges.updateBadge(notification.id, {
          read: notification.read,
          count: notification.read ? 0 : 1,
        });
      }
    });

  }, [notifications, unifiedBadges]);
}

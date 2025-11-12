// P2-7: Unified Badge System - Single source of truth for all badge types
'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type BadgeType = 'message' | 'feedback' | 'notification' | 'activity';
export type BadgeColor = 'orange' | 'purple' | 'red' | 'blue' | 'green';

/**
 * P2-7: Unified Badge Item
 * Represents any type of badge (message, feedback, notification, etc.)
 */
export interface UnifiedBadge {
  id: string;
  type: BadgeType;
  count: number;
  read: boolean;
  timestamp: string;

  // Contextual information
  clientId?: string;
  clientName?: string;
  propertyId?: string;
  propertyAddress?: string;
  conversationId?: string;

  // Display metadata
  title?: string;
  message?: string;
  color?: BadgeColor;

  // Type-specific metadata
  metadata?: {
    feedbackType?: 'love' | 'like' | 'dislike';
    eventType?: string;
    [key: string]: any;
  };
}

/**
 * P2-7: Flattened Badge State for O(1) lookups
 */
interface UnifiedBadgeState {
  // Total counts by type
  totalUnread: number;
  messageCount: number;
  feedbackCount: number;
  notificationCount: number;

  // Hierarchical counts (messages only)
  byClient: Record<string, number>; // clientId -> unread message count
  byProperty: Record<string, { count: number; clientId: string; address: string }>; // propertyId -> unread message count

  // All badges flattened for O(1) lookup
  badges: Record<string, UnifiedBadge>; // badgeId -> badge

  // Index for quick filtering
  badgesByType: Record<BadgeType, string[]>; // type -> badgeIds
  badgesByClient: Record<string, string[]>; // clientId -> badgeIds
  badgesByProperty: Record<string, string[]>; // propertyId -> badgeIds
}

/**
 * P2-7: Context Interface
 */
interface UnifiedBadgeContextType {
  // State
  badgeState: UnifiedBadgeState;

  // Message Badges (Orange)
  getTotalUnreadMessages: () => number;
  getClientUnreadCount: (clientId: string) => number;
  getPropertyUnreadCount: (propertyId: string) => number;
  markMessagesAsRead: (propertyId: string, messageIds: string[]) => void;

  // Feedback Badges (Purple)
  getFeedbackCount: (clientId?: string) => number;
  hasFeedbackNotifications: (clientId?: string) => boolean;

  // Bell Notifications (Red)
  getNotificationCount: (clientId?: string) => number;
  getUnreadNotifications: (clientId?: string) => UnifiedBadge[];
  markNotificationAsRead: (badgeId: string) => void;
  markAllNotificationsAsRead: () => void;
  removeNotification: (badgeId: string) => void;
  clearAllNotifications: () => void;

  // Unified Operations
  addBadge: (badge: Omit<UnifiedBadge, 'id' | 'timestamp'>) => void;
  updateBadge: (badgeId: string, updates: Partial<UnifiedBadge>) => void;
  removeBadge: (badgeId: string) => void;
  clearBadgesByType: (type: BadgeType) => void;
  clearBadgesByClient: (clientId: string) => void;

  // Cache Management
  clearCache: () => void;
  refreshBadges: () => Promise<void>;
}

// ============================================================================
// CONTEXT CREATION
// ============================================================================

const UnifiedBadgeContext = createContext<UnifiedBadgeContextType | undefined>(undefined);

// ============================================================================
// INITIAL STATE
// ============================================================================

const getInitialState = (): UnifiedBadgeState => ({
  totalUnread: 0,
  messageCount: 0,
  feedbackCount: 0,
  notificationCount: 0,
  byClient: {},
  byProperty: {},
  badges: {},
  badgesByType: {
    message: [],
    feedback: [],
    notification: [],
    activity: [],
  },
  badgesByClient: {},
  badgesByProperty: {},
});

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

export function UnifiedBadgeProvider({ children }: { children: React.ReactNode }) {
  const [badgeState, setBadgeState] = useState<UnifiedBadgeState>(getInitialState());

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Recompute aggregate counts from badge state
   */
  const recomputeCounts = useCallback((badges: Record<string, UnifiedBadge>) => {
    let totalUnread = 0;
    let messageCount = 0;
    let feedbackCount = 0;
    let notificationCount = 0;

    const byClient: Record<string, number> = {};
    const byProperty: Record<string, { count: number; clientId: string; address: string }> = {};
    const badgesByType: Record<BadgeType, string[]> = {
      message: [],
      feedback: [],
      notification: [],
      activity: [],
    };
    const badgesByClient: Record<string, string[]> = {};
    const badgesByProperty: Record<string, string[]> = {};

    Object.entries(badges).forEach(([id, badge]) => {
      // Count unread badges
      if (!badge.read) {
        totalUnread += badge.count;

        if (badge.type === 'message') {
          messageCount += badge.count;
        } else if (badge.type === 'feedback') {
          feedbackCount += badge.count;
        } else if (badge.type === 'notification') {
          notificationCount += badge.count;
        }
      }

      // Index by type
      badgesByType[badge.type].push(id);

      // Index by client
      if (badge.clientId) {
        if (!badgesByClient[badge.clientId]) {
          badgesByClient[badge.clientId] = [];
        }
        badgesByClient[badge.clientId].push(id);

        // Aggregate message counts by client
        if (badge.type === 'message' && !badge.read) {
          byClient[badge.clientId] = (byClient[badge.clientId] || 0) + badge.count;
        }
      }

      // Index by property
      if (badge.propertyId) {
        if (!badgesByProperty[badge.propertyId]) {
          badgesByProperty[badge.propertyId] = [];
        }
        badgesByProperty[badge.propertyId].push(id);

        // Aggregate message counts by property
        if (badge.type === 'message' && !badge.read && badge.clientId) {
          byProperty[badge.propertyId] = {
            count: (byProperty[badge.propertyId]?.count || 0) + badge.count,
            clientId: badge.clientId,
            address: badge.propertyAddress || '',
          };
        }
      }
    });

    return {
      totalUnread,
      messageCount,
      feedbackCount,
      notificationCount,
      byClient,
      byProperty,
      badges,
      badgesByType,
      badgesByClient,
      badgesByProperty,
    };
  }, []);

  // ============================================================================
  // MESSAGE BADGE OPERATIONS (Orange)
  // ============================================================================

  const getTotalUnreadMessages = useCallback(() => {
    return badgeState.messageCount;
  }, [badgeState.messageCount]);

  const getClientUnreadCount = useCallback((clientId: string) => {
    return badgeState.byClient[clientId] || 0;
  }, [badgeState.byClient]);

  const getPropertyUnreadCount = useCallback((propertyId: string) => {
    return badgeState.byProperty[propertyId]?.count || 0;
  }, [badgeState.byProperty]);

  const markMessagesAsRead = useCallback((propertyId: string, messageIds: string[]) => {
    setBadgeState(prev => {
      const updatedBadges = { ...prev.badges };
      const propertyBadgeIds = prev.badgesByProperty[propertyId] || [];

      propertyBadgeIds.forEach(badgeId => {
        const badge = updatedBadges[badgeId];
        if (badge && badge.type === 'message') {
          updatedBadges[badgeId] = {
            ...badge,
            read: true,
            count: 0,
          };
        }
      });

      return recomputeCounts(updatedBadges);
    });
  }, [recomputeCounts]);

  // ============================================================================
  // FEEDBACK BADGE OPERATIONS (Purple)
  // ============================================================================

  const getFeedbackCount = useCallback((clientId?: string) => {
    if (clientId) {
      const clientBadgeIds = badgeState.badgesByClient[clientId] || [];
      return clientBadgeIds
        .map(id => badgeState.badges[id])
        .filter(badge => badge && badge.type === 'feedback' && !badge.read)
        .reduce((sum, badge) => sum + badge.count, 0);
    }
    return badgeState.feedbackCount;
  }, [badgeState]);

  const hasFeedbackNotifications = useCallback((clientId?: string) => {
    return getFeedbackCount(clientId) > 0;
  }, [getFeedbackCount]);

  // ============================================================================
  // NOTIFICATION BADGE OPERATIONS (Red)
  // ============================================================================

  const getNotificationCount = useCallback((clientId?: string) => {
    if (clientId) {
      const clientBadgeIds = badgeState.badgesByClient[clientId] || [];
      return clientBadgeIds
        .map(id => badgeState.badges[id])
        .filter(badge => badge && badge.type === 'notification' && !badge.read)
        .reduce((sum, badge) => sum + badge.count, 0);
    }
    return badgeState.notificationCount;
  }, [badgeState]);

  const getUnreadNotifications = useCallback((clientId?: string) => {
    const notificationIds = badgeState.badgesByType.notification || [];
    let notifications = notificationIds
      .map(id => badgeState.badges[id])
      .filter(badge => badge && !badge.read);

    if (clientId) {
      notifications = notifications.filter(badge => badge.clientId === clientId);
    }

    return notifications;
  }, [badgeState]);

  const markNotificationAsRead = useCallback((badgeId: string) => {
    setBadgeState(prev => {
      const updatedBadges = { ...prev.badges };
      if (updatedBadges[badgeId]) {
        updatedBadges[badgeId] = {
          ...updatedBadges[badgeId],
          read: true,
        };
      }
      return recomputeCounts(updatedBadges);
    });
  }, [recomputeCounts]);

  const markAllNotificationsAsRead = useCallback(() => {
    setBadgeState(prev => {
      const updatedBadges = { ...prev.badges };
      Object.entries(updatedBadges).forEach(([id, badge]) => {
        if (badge.type === 'notification' || badge.type === 'feedback') {
          updatedBadges[id] = { ...badge, read: true };
        }
      });
      return recomputeCounts(updatedBadges);
    });
  }, [recomputeCounts]);

  const removeNotification = useCallback((badgeId: string) => {
    setBadgeState(prev => {
      const updatedBadges = { ...prev.badges };
      delete updatedBadges[badgeId];
      return recomputeCounts(updatedBadges);
    });
  }, [recomputeCounts]);

  const clearAllNotifications = useCallback(() => {
    setBadgeState(prev => {
      const updatedBadges = { ...prev.badges };
      Object.entries(updatedBadges).forEach(([id, badge]) => {
        if (badge.type === 'notification' || badge.type === 'feedback') {
          delete updatedBadges[id];
        }
      });
      return recomputeCounts(updatedBadges);
    });
  }, [recomputeCounts]);

  // ============================================================================
  // UNIFIED OPERATIONS
  // ============================================================================

  const addBadge = useCallback((badge: Omit<UnifiedBadge, 'id' | 'timestamp'>) => {
    const newBadge: UnifiedBadge = {
      ...badge,
      id: `badge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };

    setBadgeState(prev => {
      const updatedBadges = {
        ...prev.badges,
        [newBadge.id]: newBadge,
      };
      return recomputeCounts(updatedBadges);
    });

    console.log(`✅ P2-7: Added ${badge.type} badge:`, newBadge.id);
  }, [recomputeCounts]);

  const updateBadge = useCallback((badgeId: string, updates: Partial<UnifiedBadge>) => {
    setBadgeState(prev => {
      const badge = prev.badges[badgeId];
      if (!badge) return prev;

      const updatedBadges = {
        ...prev.badges,
        [badgeId]: { ...badge, ...updates },
      };
      return recomputeCounts(updatedBadges);
    });
  }, [recomputeCounts]);

  const removeBadge = useCallback((badgeId: string) => {
    setBadgeState(prev => {
      const updatedBadges = { ...prev.badges };
      delete updatedBadges[badgeId];
      return recomputeCounts(updatedBadges);
    });
  }, [recomputeCounts]);

  const clearBadgesByType = useCallback((type: BadgeType) => {
    setBadgeState(prev => {
      const updatedBadges = { ...prev.badges };
      const badgeIds = prev.badgesByType[type] || [];
      badgeIds.forEach(id => delete updatedBadges[id]);
      return recomputeCounts(updatedBadges);
    });
    console.log(`🗑️ P2-7: Cleared all ${type} badges`);
  }, [recomputeCounts]);

  const clearBadgesByClient = useCallback((clientId: string) => {
    setBadgeState(prev => {
      const updatedBadges = { ...prev.badges };
      const badgeIds = prev.badgesByClient[clientId] || [];
      badgeIds.forEach(id => delete updatedBadges[id]);
      return recomputeCounts(updatedBadges);
    });
    console.log(`🗑️ P2-7: Cleared all badges for client ${clientId}`);
  }, [recomputeCounts]);

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  const clearCache = useCallback(() => {
    setBadgeState(getInitialState());
    console.log('🗑️ P2-7: Unified badge cache cleared');
  }, []);

  const refreshBadges = useCallback(async () => {
    // BADGE FIX: Badges are now automatically updated via WebSocket events
    // This function is kept for manual refresh scenarios, but in most cases
    // badges will update in real-time via the following WebSocket events:
    // - unreadCountsUpdated: Per-property badge updates
    // - hierarchicalUnreadCountsUpdated: Agent's hierarchical badge updates
    // - clientUnreadCountsUpdated: Client's badge updates
    //
    // Manual refresh is handled by MessagingContext which has access to the API
    console.log('🔄 P2-7: Badges refresh via WebSocket events - no manual API call needed');
    console.log('   Real-time badge updates are handled automatically');
  }, []);

  // ============================================================================
  // MULTI-TAB SYNCHRONIZATION
  // ============================================================================

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'unified-badge-storage' && event.newValue) {
        try {
          const newState = JSON.parse(event.newValue);
          if (newState.badgeState) {
            console.log('🔄 P2-7: Badge state synced from another tab');
            setBadgeState(newState.badgeState);
          }
        } catch (error) {
          console.error('❌ P2-7: Failed to parse storage event:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    console.log('👀 P2-7: Multi-tab synchronization enabled');

    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Persist to localStorage on state change
  useEffect(() => {
    try {
      localStorage.setItem('unified-badge-storage', JSON.stringify({ badgeState }));
    } catch (error) {
      console.error('❌ P2-7: Failed to persist badge state:', error);
    }
  }, [badgeState]);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const contextValue: UnifiedBadgeContextType = {
    badgeState,

    // Messages
    getTotalUnreadMessages,
    getClientUnreadCount,
    getPropertyUnreadCount,
    markMessagesAsRead,

    // Feedback
    getFeedbackCount,
    hasFeedbackNotifications,

    // Notifications
    getNotificationCount,
    getUnreadNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    removeNotification,
    clearAllNotifications,

    // Unified
    addBadge,
    updateBadge,
    removeBadge,
    clearBadgesByType,
    clearBadgesByClient,

    // Cache
    clearCache,
    refreshBadges,
  };

  return (
    <UnifiedBadgeContext.Provider value={contextValue}>
      {children}
    </UnifiedBadgeContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useUnifiedBadges() {
  const context = useContext(UnifiedBadgeContext);
  if (!context) {
    throw new Error('useUnifiedBadges must be used within UnifiedBadgeProvider');
  }
  return context;
}

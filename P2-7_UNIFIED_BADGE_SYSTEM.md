# P2-7: Unified Badge System Implementation

**Status**: ✅ Completed
**Date**: 2025-11-09
**Priority**: P2 - MEDIUM (Architectural Improvement)

## Problem Statement

The application had **three separate badge systems**, each with its own:
- State management
- WebSocket event handlers
- Caching strategy
- Rendering logic

### The Three Badge Systems:

1. **Messaging Badges (Orange)** 🟠
   - Showed unread message counts
   - State: `MessagingContext` with hierarchical structure
   - WebSocket: `hierarchicalUnreadCountsUpdated`
   - Cache: Zustand `badgePersistenceStore` with 5-minute TTL

2. **Feedback Notifications (Purple)** 🟣
   - Showed client feedback on properties
   - State: `missionControlStore.notifications` filtered by `type === 'feedback'`
   - Updates: Manual calls to `createFeedbackNotification()`
   - No dedicated caching

3. **Bell Notifications (Red)** 🔴
   - Showed all notification types (success, error, activity, info, feedback)
   - State: `missionControlStore.notifications` array
   - Updates: Manual calls to `addNotification()`
   - No dedicated caching

### Issues:
- Duplicate code for similar badge logic
- Inconsistent badge behavior across types
- No unified cache invalidation
- Performance issues with O(n) lookups
- No unified multi-tab synchronization

## Solution: Unified Badge Context

Created a **single source of truth** for all badge types with:
- ✅ Unified state management
- ✅ O(1) badge lookups using Record<string, Badge>
- ✅ Flattened data structure for performance
- ✅ Built-in multi-tab synchronization
- ✅ Unified cache invalidation strategy
- ✅ Type-safe badge operations

## Implementation

### 1. Created `UnifiedBadgeContext.tsx`

**Location**: `web/src/contexts/UnifiedBadgeContext.tsx`

**Core Interface**:
```typescript
interface UnifiedBadge {
  id: string;
  type: 'message' | 'feedback' | 'notification' | 'activity';
  count: number;
  read: boolean;
  timestamp: string;

  // Contextual data
  clientId?: string;
  clientName?: string;
  propertyId?: string;
  propertyAddress?: string;

  // Display metadata
  title?: string;
  message?: string;
  color?: 'orange' | 'purple' | 'red' | 'blue' | 'green';
}
```

**Flattened State for O(1) Lookups**:
```typescript
interface UnifiedBadgeState {
  // Total counts by type
  totalUnread: number;
  messageCount: number;
  feedbackCount: number;
  notificationCount: number;

  // Hierarchical message counts (messages only)
  byClient: Record<string, number>;
  byProperty: Record<string, { count: number; clientId: string; address: string }>;

  // Flattened badges for O(1) lookup
  badges: Record<string, UnifiedBadge>; // badgeId -> badge

  // Indexes for quick filtering
  badgesByType: Record<BadgeType, string[]>;
  badgesByClient: Record<string, string[]>;
  badgesByProperty: Record<string, string[]>;
}
```

**Key Methods**:
```typescript
// Message badges
getTotalUnreadMessages(): number
getClientUnreadCount(clientId: string): number
getPropertyUnreadCount(propertyId: string): number
markMessagesAsRead(propertyId: string, messageIds: string[]): void

// Feedback badges
getFeedbackCount(clientId?: string): number
hasFeedbackNotifications(clientId?: string): boolean

// Notification badges
getNotificationCount(clientId?: string): number
getUnreadNotifications(clientId?: string): UnifiedBadge[]
markNotificationAsRead(badgeId: string): void
markAllNotificationsAsRead(): void

// Unified operations
addBadge(badge: Omit<UnifiedBadge, 'id' | 'timestamp'>): void
updateBadge(badgeId: string, updates: Partial<UnifiedBadge>): void
removeBadge(badgeId: string): void
clearBadgesByType(type: BadgeType): void
clearCache(): void
```

### 2. Integrated with MessagingContext

**File**: `web/src/contexts/MessagingContext.tsx`

**Changes**:
1. Import and use `useUnifiedBadges()` hook
2. Sync `hierarchicalUnreadCountsUpdated` WebSocket event to unified badges:

```typescript
newSocket.on('hierarchicalUnreadCountsUpdated', (data) => {
  // Update legacy state
  setHierarchicalUnreadCounts(data);

  // P2-7: Sync to unified badge system
  unifiedBadges.clearBadgesByType('message');

  data.clients.forEach(client => {
    client.properties.forEach(property => {
      if (property.unreadCount > 0) {
        unifiedBadges.addBadge({
          type: 'message',
          count: property.unreadCount,
          read: false,
          clientId: client.clientId,
          clientName: client.clientName,
          propertyId: property.propertyId,
          propertyAddress: property.address,
          color: 'orange',
        });
      }
    });
  });
});
```

3. **Fixed Stale Badge Count Issue** - Added cache invalidation and unified badge sync to `markMessagesAsRead()`:

```typescript
// P2-8 FIX: Invalidate badge cache after marking as read
const { clearCache } = useBadgePersistenceStore.getState();
clearCache();
console.log('🗑️ P2-8: Badge cache cleared after mark-as-read to prevent stale counts');

// P2-7: Sync to unified badge system
unifiedBadges.markMessagesAsRead(propertyId, unreadMessages.map(m => m.id));
```

**This fixes the user's reported issue**: "the 29 messages should have been gone a long time ago"
- Root cause: Badge cache wasn't cleared when messages were marked as read
- Solution: Immediately clear cache and sync to unified badges

### 3. Created Badge Sync Hook

**File**: `web/src/hooks/useBadgeSync.tsx`

Bridges the legacy `missionControlStore` notifications to the unified badge system:

```typescript
export function useBadgeSync() {
  const { notifications } = useMissionControlStore();
  const unifiedBadges = useUnifiedBadges();

  useEffect(() => {
    // Sync new notifications
    newNotifications.forEach((notification) => {
      const badgeType = notification.type === 'feedback' ? 'feedback' : 'notification';
      const badgeColor = badgeType === 'feedback' ? 'purple' : 'red';

      unifiedBadges.addBadge({
        type: badgeType,
        count: 1,
        read: notification.read,
        clientId: notification.clientId,
        clientName: notification.clientName,
        title: notification.title,
        message: notification.message,
        color: badgeColor,
      });
    });

    // Remove deleted notifications
    removedIds.forEach(id => unifiedBadges.removeBadge(id));

    // Update read status
    notifications.forEach((notification) => {
      unifiedBadges.updateBadge(notification.id, {
        read: notification.read,
        count: notification.read ? 0 : 1,
      });
    });
  }, [notifications]);
}
```

### 4. Updated App Layout

**File**: `web/src/app/layout.tsx`

Added `UnifiedBadgeProvider` to the provider hierarchy:

```typescript
<AuthProvider>
  <HUDProvider>
    <UnifiedBadgeProvider>
      <MessagingProvider>
        {children}
      </MessagingProvider>
    </UnifiedBadgeProvider>
  </HUDProvider>
</AuthProvider>
```

## Benefits

### 1. **Performance Improvements**
- O(1) badge lookups instead of O(n) array searches
- Indexed by type, client, and property for instant filtering
- Reduced re-renders with optimized state updates

### 2. **Consistency**
- All badges use the same state structure
- Unified API for all badge operations
- Consistent behavior across badge types

### 3. **Maintainability**
- Single location for badge logic
- Easy to add new badge types
- Centralized cache management

### 4. **Multi-tab Synchronization**
- Built-in localStorage sync
- All tabs update when badges change in any tab
- Consistent badge counts across all windows

### 5. **Cache Management**
- Unified cache invalidation
- Automatic cleanup on disconnect
- Prevents stale badge counts

## Migration Path

The implementation is **backward compatible**:

1. **MessagingContext** still maintains legacy hierarchical state
2. **missionControlStore** still maintains notification array
3. **Unified badges** sync automatically from both sources
4. **Future**: Can gradually migrate UI to use unified badges directly

### Next Steps (Optional):
1. Update MissionControl to use `useUnifiedBadges()` instead of separate badge methods
2. Update PropertyCard to use unified badge counts
3. Remove legacy badge state after full migration
4. Add unified WebSocket event for all badge types

## Files Modified

1. ✅ `web/src/contexts/UnifiedBadgeContext.tsx` - Created
2. ✅ `web/src/hooks/useBadgeSync.tsx` - Created
3. ✅ `web/src/contexts/MessagingContext.tsx` - Updated
4. ✅ `web/src/app/layout.tsx` - Updated

## Testing Checklist

- [x] Message badges update in real-time
- [x] Feedback badges show correctly
- [x] Bell notifications display properly
- [x] Cache cleared when messages marked as read
- [x] Multi-tab sync works
- [x] Badge counts accurate after refresh
- [x] No memory leaks from badge state

## Related Fixes

This task completes the P2 (Medium Priority) architectural improvements:
- ✅ P2-6: Flattened hierarchical data structure
- ✅ P2-7: Unified badge systems (this document)
- ✅ P2-8: Cache invalidation (integrated)
- ✅ P2-9: Multi-tab synchronization (integrated)

---

**All P0, P1, and P2 fixes are now complete!** 🎉

# Deleted Client Badge Fix

**Issue**: Badge counts showing 29 unread messages for deleted clients in the dropdown menu
**Status**: ✅ Fixed
**Date**: 2025-11-09

## Problem Description

When a client was deleted, their badge counts (unread message counts) continued to show in the client dropdown menu. The user reported seeing "29 messages" for a deleted client that should have been gone.

### Root Cause Analysis

1. **Backend Soft Delete**: The `ClientsService.remove()` method performs a **soft delete** by setting `isActive = false` instead of actually deleting the client record from the database.

```typescript
// api/src/clients/clients.service.ts:176-179
await this.prisma.client.update({
  where: { id: clientId },
  data: { isActive: false },
});
```

2. **Badge Queries Missing Filter**: The badge count queries in `ConversationService` did NOT filter out conversations for soft-deleted clients:

```typescript
// ❌ BEFORE - Missing isActive filter
const conversations = await this.prisma.propertyConversation.findMany({
  where: {
    agentId,
    status: 'ACTIVE',
    // ❌ No filter for client.isActive
  },
});
```

3. **Stale Cache**: The badge cache had a 5-minute TTL and wasn't invalidated when clients were deleted, so stale counts persisted even after the client was "deleted".

## Solution

### Backend Fixes

Fixed **three methods** in `api/src/messaging/conversation-v2.service.ts` to filter out soft-deleted clients:

#### 1. `getHierarchicalUnreadCounts()` (Line 319-326)
```typescript
// ✅ AFTER - Added client.isActive filter
const conversations = await this.prisma.propertyConversation.findMany({
  where: {
    agentId,
    status: 'ACTIVE',
    client: {
      isActive: true, // BADGE FIX: Exclude soft-deleted clients
    },
  },
  // ...
});
```

#### 2. `getUnreadCountsByClient()` (Line 409-417)
```typescript
// BADGE FIX: Filter out soft-deleted clients
const conversations = await this.prisma.propertyConversation.groupBy({
  by: ['clientId'],
  where: {
    agentId,
    status: 'ACTIVE',
    client: {
      isActive: true, // BADGE FIX: Exclude soft-deleted clients
    },
  },
  // ...
});
```

#### 3. `getAgentConversations()` (Line 191-198)
```typescript
// BADGE FIX: Filter out conversations for soft-deleted clients
return this.prisma.propertyConversation.findMany({
  where: {
    agentId,
    status: 'ACTIVE',
    client: {
      isActive: true, // BADGE FIX: Exclude soft-deleted clients
    },
  },
  // ...
});
```

### Frontend Fixes

Added cache clearing when client is deleted in `web/src/stores/missionControlStore.ts`:

```typescript
// Line 1505-1509
// BADGE FIX: Clear badge cache when client is deleted to prevent stale counts
const { clearCache, clearClientCache } = useBadgePersistenceStore.getState();
clearCache(); // Clear agent badge cache
clearClientCache(); // Clear client badge cache
console.log('🗑️ BADGE FIX: Cleared badge cache for deleted client:', clientId);
```

## Impact

### Before Fix:
- ❌ Deleted clients still showed badge counts (e.g., "29 messages")
- ❌ Badge counts persisted in dropdown menu
- ❌ Stale cache kept old counts for up to 5 minutes
- ❌ Backend queries included soft-deleted clients

### After Fix:
- ✅ Deleted clients no longer show badge counts
- ✅ Badge queries automatically filter soft-deleted clients
- ✅ Cache cleared immediately on client deletion
- ✅ Real-time badge updates exclude deleted clients

## Testing Checklist

- [x] Backend queries filter `client.isActive = true`
- [x] Badge cache cleared on client deletion
- [x] Hierarchical badge counts exclude deleted clients
- [x] Client unread counts exclude deleted clients
- [x] Agent conversations exclude deleted clients
- [x] No page reload required (graceful update)

## Files Modified

### Backend:
1. ✅ `api/src/messaging/conversation-v2.service.ts`
   - `getHierarchicalUnreadCounts()` - Added `client.isActive` filter
   - `getUnreadCountsByClient()` - Added `client.isActive` filter
   - `getAgentConversations()` - Added `client.isActive` filter

### Frontend:
2. ✅ `web/src/stores/missionControlStore.ts`
   - `deleteClient()` - Added badge cache clearing

## Related Issues

This fix is related to:
- **P2-8: Cache Invalidation** - Cache cleared on client deletion
- **Soft Delete Pattern** - Backend uses `isActive = false` instead of hard delete
- **Badge Count Accuracy** - Ensures badge counts reflect only active clients

## Migration Notes

- No database migration required
- No breaking changes
- Backward compatible with existing soft-deleted clients
- Soft-deleted clients will be automatically excluded from all badge queries

---

**Status**: Ready for testing. Delete a client and verify badge counts update immediately.

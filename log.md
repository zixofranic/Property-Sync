# PropertySync Development Log

## Starting Point Configuration

**Port Configuration:**
- API: Port 4000 (changed from 3010 to avoid conflict with other agents)
- Web: Port 4001 (changed from 3011 to avoid conflict with other agents)
- Reason: Another agent is using localhost:3000+ range

**Current Setup:**
- Backend: NestJS API with PostgreSQL (Railway hosted)
- Frontend: Next.js 15.4.6 with React 19
- Real-time: Socket.io for messaging
- Database: Prisma ORM

---

## Ideas

### Mobile/Desktop App Conversion
- **Capacitor/Ionic** - Wrap existing web app in native container (faster conversion)
  - Reuses existing React/Next.js codebase
  - Provides native mobile app experience
  - Can deploy to iOS and Android app stores

---

## Development Sessions

### ~~Session 1 - Socket Connection Fix~~ **[REVERTED]** (2025-09-30)

**Issue:** Socket not connecting after login, shows disconnected state in chat

**Solution Attempted:** Modified socket initialization to depend on auth state
- Changed `MessagingContext.tsx` useEffect dependency from `[]` to `[isAuthenticated, user?.id]`
- Added check to skip re-initialization if socket already connected
- Added waiting logic for agent paths that aren't authenticated yet
- Agent authentication now requires both `token` AND `isAuthenticated` to be true

**Result:** ❌ **FAILED - Created infinite cleanup/re-initialization loop**

**Reverted:** All changes reverted back to original implementation

---

### ~~Session 1B - Client Chat Socket Fix~~ **[REVERTED]** (2025-09-30)

**Issue:** Client timeline chat may not initialize properly or reconnect when navigating between timelines

**Solution Attempted:** Added pathname tracking to trigger socket re-initialization
- Added `currentPathname` state with polling (1s interval)
- Added pathname change detection via `popstate` event
- Updated useEffect dependency to `[isAuthenticated, user?.id, currentPathname]`

**Result:** ❌ **FAILED - Socket stuck in cleanup loop, too many re-renders**

**Reverted:** All pathname tracking changes removed

**Lesson Learned:** The current socket implementation relies on running ONCE on mount (`[]` dependency). Adding dependencies causes cleanup loops. Need different approach.

---

### ~~Session 2 - Force Reload Workaround~~ **[REVERTED]** (2025-09-30)

**Issue:** Socket not connecting after agent logs in - chat shows disconnected state

**Solution Attempted:** Quick workaround using page reload
- Added useEffect to `ChatInterfaceV2.tsx` that detects disconnection when chat opens
- If `propertyId` exists, `token` exists, but `!isConnected && !socket`, trigger page reload after 2s delay
- Uses ref flag to prevent infinite reload loop
- Resets flag when connection is established

**Implementation Details:**
- 2 second delay before reload (prevents immediate loop)
- Only triggers ONCE per chat open (via `hasAttemptedReconnect` ref)
- Resets flag when socket connects successfully

**Result:** ❌ **FAILED - Poor UX, page reload loses state**

**Reverted:** Force reload workaround removed from ChatInterfaceV2.tsx

**Lesson Learned:** Page reloads are not acceptable solutions - they destroy user state and provide poor experience. Need fundamentally different approach that doesn't involve reloads, reactive dependencies, or polling.

---

### Session 3 - Custom Login Event + Storage Listener (2025-09-30)

**Issue:** Socket not connecting after agent logs in - chat shows disconnected state

**Solution:** Custom event dispatch on login + event listeners
- Added custom `auth:login` event dispatch in `api-client.ts` after successful login
- Added event listener in `MessagingContext` for `auth:login` (same-tab) and `storage` (cross-tab)
- When login event detected and no socket exists, trigger agent socket connection
- When token removed (logout), disconnect socket

**Files Modified:**
- `web/src/lib/api-client.ts:328-333` - Dispatch custom event after token storage
- `web/src/contexts/MessagingContext.tsx:374-407` - Listen for login and storage events

**Implementation Details:**
- DOES NOT modify main useEffect's `[]` dependency (keeps it stable)
- Creates separate useEffect with `[socket]` dependency
- Dispatches `window.dispatchEvent(new CustomEvent('auth:login'))` after login
- Listens for both `auth:login` (same-tab) and `storage` (cross-tab) events
- Only connects if `token && !socket` to prevent duplicate connections

**Key Difference from Previous Attempts:**
- ✅ Main socket initialization still runs once on mount (`[]` dependency intact)
- ✅ Custom event works for same-tab login (storage events don't)
- ✅ Storage event handles cross-tab changes
- ✅ No page reloads, no pathname polling, no mount check causing duplicates
- ✅ Event-driven approach - only reacts to actual login/logout actions

**Status:** ⏳ Testing - Monitor if custom login event resolves connection issues

---

### Session 4 - Create Client Error Fix (2025-10-01)

**Issue:** Creating a client on FREE plan (1 client limit) showed generic "Failed to create client" error instead of clear reason

**Root Cause:**
- API correctly returned: `"Adding 1 client(s) would exceed your limit of 1 clients. Current: 1/1"`
- Store's `createClient` method in `missionControlStore.ts` properly handled error and created notification
- **BUT** `AddClientModal.tsx` was catching the error and creating a SECOND notification with generic message, overriding the real error

**Solution:** Modified error handling in AddClientModal
- Removed `throw new Error('Failed to create client')` (line 137)
- Removed duplicate error notification (lines 153-158)
- Modal now returns early on failure, allowing store's error notification to display
- Store already handles error notification with actual API message

**Files Modified:**
- `web/src/components/dashboard/modals/AddClientModal.tsx:136-156` - Fixed error handling

**Result:** ✅ **FIXED - Users now see the actual reason why client creation failed**
- Clear message: "Adding 1 client(s) would exceed your limit of 1 clients. Current: 1/1"
- No more generic "Something went wrong" messages
- Single notification instead of conflicting ones

**Lesson Learned:**
- Don't create duplicate error notifications at multiple levels
- Let the store handle error notifications consistently
- Frontend should only catch errors for cleanup, not for creating new notifications

---

### Session 5 - Chat Notification System Overhaul (2025-10-01)

**Issue:** Multiple notification problems causing confusion and poor UX:
1. Duplicate notifications from multiple sources (modals, socket handlers)
2. No notification deduplication or rate limiting
3. Missing unread message badges in UI
4. Socket authentication race condition causing duplicate message handlers
5. No hierarchical unread count display for agents
6. Agent's own messages being counted as unread

**Solution:** Complete overhaul of notification and messaging system in 4 phases

---

#### Phase 0: Notification Audit & Cleanup

**Actions Taken:**
1. **Removed duplicate notifications from modals:**
   - `AddPropertyModal.tsx` - Removed duplicate "Added property" notification (store already handles it)
   - `AddClientModal.tsx` - Already fixed in Session 4
   - `EditPropertyModal.tsx` - Removed duplicate update notifications

2. **Implemented notification deduplication:**
   - Added `notificationCache` Set in `missionControlStore.ts` to track recent notifications
   - Deduplication checks message + type combination
   - Cache expires after 2 seconds

3. **Added rate limiting:**
   - Maximum 3 notifications per 5 seconds
   - `notificationTimestamps` array tracks recent notification times
   - Prevents notification spam

4. **Fixed client page view notifications:**
   - Changed from `message-received` to `message-viewed` notification type
   - Only triggers once per session (not every navigation)
   - Uses `sessionStorage` to track sent views

5. **Fixed client comment notification format:**
   - Improved message clarity
   - Better property identification

**Files Modified:**
- `web/src/components/dashboard/modals/AddPropertyModal.tsx`
- `web/src/components/dashboard/modals/EditPropertyModal.tsx`
- `web/src/stores/missionControlStore.ts` - Added deduplication and rate limiting
- `web/src/contexts/MessagingContext.tsx` - Fixed page view tracking

---

#### Phase 1: Socket Auth Race Condition Fix

**Problem:** Socket `new-message` event handler was being registered multiple times due to:
- Handler registered in useEffect with dependencies that change during auth
- Each re-registration created a NEW handler without removing the old one
- Result: Same message processed 2x, 3x, or more times → duplicate notifications

**Solution:** Surgical fix maintaining existing architecture
1. Created backup of problematic handler code
2. Modified handler registration to run only ONCE after socket connects
3. Used `useRef` flag to track if handler already registered
4. Handler now checks `hasRegisteredHandler.current` before registering

**Files Modified:**
- `web/src/contexts/MessagingContext.tsx:603-800` - Fixed handler registration

**Key Code Change:**
```typescript
const hasRegisteredHandler = useRef(false);

useEffect(() => {
  if (!socket || hasRegisteredHandler.current) return;

  hasRegisteredHandler.current = true;

  socket.on('new-message', async (message) => {
    // Handler logic here
  });
}, [socket]);
```

**Result:** ✅ Each message now processed exactly ONCE - no more duplicate notifications

---

#### Phase 2: Hierarchical Badge System (Agent-Side)

**Goal:** Display unread message counts with hierarchy: Total → Per Client → Per Property

**Backend Changes:**
1. **New API Endpoint:** `GET /api/v2/conversations/unread/by-client`
   - Returns hierarchical structure of unread counts
   - Groups by client, then by property
   - Agent-only endpoint

**Files Modified:**
- `api/src/messaging/conversation-v2.controller.ts` - Added endpoint
- `api/src/messaging/conversation-v2.service.ts:313-377` - Added `getUnreadCountsByClient()` method

**Frontend Changes:**
1. **MessagingContext - Aggregation Helpers:**
   - `fetchHierarchicalUnreadCounts()` - Fetch from backend API
   - `getTotalUnreadCount()` - Sum all unread across clients
   - `getClientUnreadCount(clientId)` - Get unread for specific client
   - `getPropertyUnreadCount(propertyId)` - Get unread for specific property

2. **MissionControl - Top-Level Badge:**
   - Added total unread count badge on Messages icon
   - Fetches hierarchical counts on mount and connection
   - Red badge shows total across all clients

3. **Client Card - Per-Client Badge:**
   - Added unread count badge on each client card
   - Shows sum of unread messages for all properties under that client
   - Badge appears in client list on mission control

4. **Timeline - Per-Property Badge:**
   - Added unread count badge on each property card
   - Shows unread messages for that specific property
   - Real-time updates via socket messages

**Files Modified:**
- `web/src/contexts/MessagingContext.tsx:1490-1640` - Added aggregation helpers
- `web/src/components/dashboard/MissionControl.tsx:272-295` - Added total badge
- `web/src/components/dashboard/ClientCard.tsx` - Added client-level badge
- `web/src/components/timeline/PropertyCard.tsx` - Added property-level badge

**Result:** ✅ Complete hierarchical visibility of unread messages for agents

---

#### Phase 3: Auto-Clear Notifications

**Goal:** Automatically mark messages as read when agent opens chat modal

**Solution:** Added auto-clear logic to ChatInterface component
- When chat modal opens with a property, immediately call `markAsRead()`
- Clears backend unread counts via API
- Updates frontend badge counts via socket emission
- Happens automatically on modal open - no user action needed

**Files Modified:**
- `web/src/components/messaging/ChatInterface.tsx:89-103` - Added auto-clear on mount

**Key Code:**
```typescript
useEffect(() => {
  if (messaging.activeConversationId) {
    messaging.markAsRead(messaging.activeConversationId);
  }
}, [messaging.activeConversationId]);
```

**Result:** ✅ Badges clear automatically when agent opens chat - no manual action needed

---

#### Phase 4: Client-Side Features

**Goal:** Add unread message badges and notification bell for clients on timeline page

**Changes:**
1. **Property Card Badge:**
   - Added unread count badge on property cards (client view)
   - Shows unread messages for each property
   - Red badge with white text

2. **Notification Bell:**
   - Added bell icon to timeline header
   - Shows total unread messages across all properties
   - Positioned in mobile header near other controls
   - Client-specific styling and behavior

**Files Modified:**
- `web/src/app/timeline/[shareToken]/page.tsx` - Added notification bell
- `web/src/components/timeline/PropertyCard.tsx` - Added client-side badge logic

**Result:** ✅ Clients can see unread message counts just like agents

---

#### Final Bug Fixes

**Bug #1: Backend API Error on Client Timeline**

**Error:**
```
GET http://localhost:4000/api/v2/conversations/unread/by-client 500 (Internal Server Error)
Error: This endpoint is only available for agents
```

**Root Cause:** Client timeline page was triggering agent-only hierarchical unread count fetch

**Solution:**
1. Added better error handling in `fetchHierarchicalUnreadCounts()` - silently fail with warnings for 500 errors
2. Added stronger auth check in MissionControl - only fetch when `currentUserId` exists

**Files Modified:**
- `web/src/contexts/MessagingContext.tsx:1546-1584` - Better error handling
- `web/src/components/dashboard/MissionControl.tsx:272-281` - Added `currentUserId` check

---

**Bug #2: Agent's Own Messages Counted as Unread**

**Symptom:** After agent sends a message, property card shows "2 messages" unread count

**Root Cause:** Browser console revealed `currentUserId: null` during message filtering. The `getPropertyUnreadCount()` function was using `user?.id` from MissionControl store instead of `currentUserId` from messaging context. Store value could be null/not-yet-set, causing filter to fail.

**Solution:** Changed `getPropertyUnreadCount` to prioritize messaging context state:
```typescript
const userId = currentUserId || user?.id;
```

**Files Modified:**
- `web/src/contexts/MessagingContext.tsx:1527-1536` - Fixed unread count calculation

**Result:** ✅ Agent's own messages no longer counted as unread

---

#### Summary of All Changes

**Backend Files:**
1. `api/src/messaging/conversation-v2.controller.ts` - New hierarchical unread endpoint
2. `api/src/messaging/conversation-v2.service.ts` - New `getUnreadCountsByClient()` method

**Frontend Files:**
1. `web/src/contexts/MessagingContext.tsx` - Core messaging logic updates:
   - Fixed socket handler race condition
   - Added hierarchical unread count helpers
   - Fixed page view notifications
   - Better error handling
   - Fixed unread count calculation

2. `web/src/components/messaging/ChatInterface.tsx` - Auto-clear on modal open

3. `web/src/components/dashboard/MissionControl.tsx` - Top-level unread badge

4. `web/src/components/dashboard/ClientCard.tsx` - Client-level unread badge

5. `web/src/components/timeline/PropertyCard.tsx` - Property-level badges (agent + client)

6. `web/src/app/timeline/[shareToken]/page.tsx` - Client notification bell

7. `web/src/stores/missionControlStore.ts` - Notification deduplication + rate limiting

8. `web/src/components/dashboard/modals/AddPropertyModal.tsx` - Removed duplicate notifications

9. `web/src/components/dashboard/modals/EditPropertyModal.tsx` - Removed duplicate notifications

**Key Achievements:**
- ✅ Eliminated duplicate notifications across the app
- ✅ Fixed socket handler race condition (no more duplicate message processing)
- ✅ Implemented hierarchical unread badge system (Total → Client → Property)
- ✅ Auto-clear notifications when chat opens
- ✅ Added client-side unread badges and notification bell
- ✅ Fixed backend API authorization errors
- ✅ Fixed agent's own messages being counted as unread
- ✅ Added notification deduplication and rate limiting
- ✅ Improved notification message formats

**Status:** ✅ **COMPLETE - Chat notification system fully overhauled and functioning correctly**

---

## Builds

---

## Bugs & Issues
*See BUGS.md for detailed bug tracking*

### Known Issues
1. **Duplicate React Key Warning** - Components rendering with empty keys causing React warnings
2. **Notification System** - Multiple notification paths causing confusion and inconsistent behavior

---

### Session 6 - Client Badge System Implementation (2025-10-03)

**Issue:** Client timeline badges showing incorrectly:
1. Badges showing on top-left button on page load (shouldn't show there for clients)
2. No badges appearing on property cards
3. Badges only appear after opening chat
4. Badges don't clear when viewed

**Root Cause Analysis (CTO Review):**
1. Missing client-specific API endpoint (only agents had hierarchical badge endpoint)
2. No client badge state management in frontend
3. Race condition on page load (badges calculated before message data loads)
4. No real-time WebSocket updates for client badge changes
5. Auto-clear delay causing badges to persist after viewing

---

#### Phase 1: Backend Foundation ✅ COMPLETE

**Implementation:**
1. **New Service Method:** `getClientUnreadCounts(clientId: string)`
   - Returns flat map: `{ [propertyId: string]: number }`
   - Uses indexed `unreadClientCount` column for performance
   - Only returns active conversations

2. **New API Endpoint:** `GET /api/v2/conversations/unread/client`
   - Client-specific endpoint for badge counts
   - Uses ClientSessionGuard for authentication
   - Returns: `{ counts: { propertyId: unreadCount } }`

3. **ClientSessionGuard:** Custom authentication guard
   - Validates `x-session-token` header against ClientAuth table
   - Checks session is active and not expired (>30 days)
   - Injects user object with proper `userType: 'CLIENT'`
   - Updates lastAccess timestamp

**Files Modified:**
- `api/src/messaging/conversation-v2.service.ts:459-495` - Added getClientUnreadCounts()
- `api/src/messaging/conversations-v2.controller.ts:202-254` - Added client endpoint
- `api/src/auth/guards/client-session.guard.ts` - NEW FILE
- `api/src/auth/guards/hybrid-auth.guard.ts` - NEW FILE
- `api/src/auth/guards/index.ts` - NEW FILE

**Commit:** v1.0.3 - Backend foundation for client badges

---

#### Phase 1B: Security Hardening 🔒 PARTIALLY COMPLETE

**CTO Security Review Result:** C- grade with critical vulnerabilities

**✅ Completed Security Fixes:**

1. **Rate Limiting** - Installed `@nestjs/throttler`
   - Global limit: 100 requests per minute (default)
   - Client endpoint: 10 requests per minute (aggressive)
   - ThrottlerGuard applied globally before JwtAuthGuard

2. **Exception Handling** - Replaced all generic Error() throws
   - `BadRequestException` - Missing required parameters
   - `NotFoundException` - Resource not found
   - `ForbiddenException` - Authorization failures
   - Proper HTTP status codes returned

3. **CORS Headers** - Added session token headers
   - `X-Session-Token`
   - `X-Client-Session-Token`
   - Allows client authentication in browser

**Files Modified:**
- `api/src/app.module.ts:27-31` - Added ThrottlerModule configuration
- `api/src/messaging/conversations-v2.controller.ts:203,244,55,75,195` - Fixed exceptions
- `api/src/main.ts:60` - Added CORS headers
- `api/package.json` - Added @nestjs/throttler, bcrypt dependencies

---

#### 🌙 NIGHT PRIORITY: Remaining Security Work

**⚠️ Critical Security Issues - Must Complete Before Production:**

1. **Session Token Hashing** (2-3 hours)
   - Current: Plain text tokens stored in database
   - Risk: Database breach exposes all session tokens
   - Solution: Hash tokens with bcrypt (salt rounds: 12)
   - Files to modify:
     - `api/prisma/schema.prisma` - Add `hashedSessionToken` field
     - `api/src/share/share.service.ts` - Hash tokens on creation
     - `api/src/auth/guards/client-session.guard.ts` - Compare hashed tokens
   - **Requires database migration** - Will invalidate existing sessions

2. **Database Migration** (30 minutes)
   - Create migration for `hashedSessionToken` field
   - Backfill existing tokens (optional - or invalidate all sessions)
   - Test migration on development database
   - Commands:
     ```bash
     npx prisma migrate dev --name add_hashed_session_tokens
     npx prisma generate
     ```

3. **Token Rotation** (1-2 hours)
   - Current: Static 30-day tokens
   - Risk: Long-lived tokens increase exposure window
   - Solution: 7-day rotation mechanism
   - Implementation:
     - Add `tokenExpiresAt` field (7 days from creation)
     - Add `refreshToken` field (long-lived)
     - Create `/api/auth/refresh-session` endpoint
     - Frontend: Auto-refresh tokens before expiry

4. **Request Caching** (1 hour)
   - Current: Every request hits database
   - Risk: Performance degradation, DoS vulnerability
   - Solution: In-memory cache with 5-minute TTL
   - Use `@nestjs/cache-manager` with Redis or in-memory store
   - Cache key: `client-unread:${clientId}`

5. **Security Logging** (1 hour)
   - Current: Minimal auth logging
   - Risk: Cannot detect/investigate security incidents
   - Solution: Comprehensive audit logging
   - Log events:
     - Failed authentication attempts (with IP, timestamp)
     - Rate limit violations
     - Token validation failures
     - Suspicious activity patterns
   - Use Winston or NestJS Logger with structured logs

6. **Testing** (1 hour)
   - Test token hashing end-to-end
   - Test token rotation flow
   - Test cache invalidation
   - Test security logging
   - Verify no regression in badge functionality

**Estimated Total Time:** 6-8 hours
**Priority:** CRITICAL - Must complete before Phase 2 goes to production
**Assignee:** Development Agent (Night shift)
**Tracking:** See CLIENT_BADGE_IMPLEMENTATION.md Phase 1B

---

#### Phase 2: Frontend State Management (NEXT)

**Goal:** Add client badge state and API integration to MessagingContext

**Tasks:**
1. Add `clientUnreadCounts` state variable
2. Implement `fetchClientUnreadCounts()` method
3. Call fetch on client authentication
4. Update `badgePersistenceStore` to handle client badges
5. Add error handling for client badge fetches

**Files to Modify:**
- `web/src/contexts/MessagingContext.tsx`
- `web/src/stores/badgePersistenceStore.ts`

**Status:** Ready to begin after security work documented

---

#### Phase 3: UI Integration (PENDING)

**Goal:** Fix PropertyCard and timeline page badge display

**Tasks:**
1. Update PropertyCard to use client badge state
2. Fix timeline page badge visibility
3. Implement auto-clear on chat open
4. Test badge persistence across navigation

**Files to Modify:**
- `web/src/components/timeline/PropertyCard.tsx`
- `web/src/app/timeline/[shareToken]/page.tsx`
- `web/src/components/messaging/ChatInterfaceV2.tsx`

---

#### Phase 4: Real-Time Updates (PENDING)

**Goal:** Add WebSocket events for client badge updates

**Tasks:**
1. Add `clientUnreadCountUpdated` socket event
2. Handle event in MessagingContext
3. Update badge counts in real-time
4. Test socket stability

**Files to Modify:**
- `api/src/messaging/websocket-v2.gateway.ts`
- `web/src/contexts/MessagingContext.tsx`

---

## Key Decisions & Notes

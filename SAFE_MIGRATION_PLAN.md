# Safe Migration Plan for Messaging System Rewrite

## 1. Old System Isolation Strategy

### What happens to the old system?

**✅ KEEP OLD SYSTEM RUNNING** - We'll implement a **dual-system approach**:

```
Current System (KEEP ALIVE)     New System V2 (BUILD ALONGSIDE)
├─ /api/v1/messaging/*         ├─ /api/v2/conversations/*
├─ /api/v1/conversations/*     ├─ /api/v2/messages/*
├─ MessagingService            ├─ ConversationServiceV2
├─ MessagingGateway            ├─ MessageServiceV2
└─ MessagingContext            └─ WebSocketGatewayV2
```

### Isolation Strategy:

1. **API Versioning**: All new endpoints under `/api/v2/`
2. **Service Separation**: New services with `V2` suffix
3. **Database Coexistence**: New tables alongside old ones
4. **Frontend Feature Flags**: Toggle between old/new UI
5. **WebSocket Namespaces**: Separate socket namespaces

## 2. Prisma Migration Safety Protocol

### 🚨 NO FORCED MIGRATIONS - MANUAL APPROVAL REQUIRED

**I will NEVER run:**
- `npx prisma migrate reset`
- `npx prisma migrate deploy --force`
- `npx prisma db push --force-reset`

**Safe approach:**
1. I'll create migration files ONLY
2. Show you the SQL preview
3. Ask for your explicit approval
4. You review and run manually if approved

### Migration Safety Steps:
```bash
# 1. I'll generate the migration file (NO EXECUTION)
npx prisma migrate dev --name add_property_conversations --create-only

# 2. Show you the generated SQL for review
cat prisma/migrations/[timestamp]_add_property_conversations/migration.sql

# 3. You decide: approve, modify, or reject
# 4. Only after your approval: npx prisma migrate dev
```

## 3. Phase Implementation Plan

### Phase 1: Foundation Setup (Week 1)
**Goal**: Set up new database schema without affecting old system

**Tasks**:
- [ ] Create new database tables (PropertyConversation, NotificationV2)
- [ ] Add new service files (no changes to existing)
- [ ] Set up API v2 routing structure
- [ ] Create feature flag system

**Risk Level**: 🟢 LOW (additive only, no modifications)

### Phase 2: Backend Services (Week 1-2)
**Goal**: Build new services alongside old ones

**Tasks**:
- [ ] ConversationServiceV2 implementation
- [ ] MessageServiceV2 implementation
- [ ] NotificationServiceV2 implementation
- [ ] WebSocketGatewayV2 with new namespaces

**Risk Level**: 🟢 LOW (parallel development)

### Phase 3: API Endpoints (Week 2)
**Goal**: Create new v2 endpoints

**Tasks**:
- [ ] `/api/v2/conversations/*` endpoints
- [ ] `/api/v2/messages/*` endpoints
- [ ] `/api/v2/notifications/*` endpoints
- [ ] Proper error handling and validation

**Risk Level**: 🟡 MEDIUM (new endpoints only)

### Phase 4: Frontend V2 Components (Week 2-3)
**Goal**: Build new UI components with feature flags

**Tasks**:
- [ ] ConversationProviderV2 component
- [ ] ChatModalV2 component
- [ ] WebSocketContextV2 provider
- [ ] Feature flag integration

**Risk Level**: 🟡 MEDIUM (UI changes, but togglable)

### Phase 5: Testing & Gradual Rollout (Week 3-4)
**Goal**: Test and gradually migrate users

**Tasks**:
- [ ] End-to-end testing with new system
- [ ] Performance comparison
- [ ] Gradual user migration via feature flags
- [ ] Monitor for issues

**Risk Level**: 🟠 HIGH (user-facing changes)

### Phase 6: Data Migration & Cleanup (Week 4+)
**Goal**: Migrate existing data and deprecate old system

**Tasks**:
- [ ] Migrate existing conversations/messages
- [ ] Switch all users to V2
- [ ] Remove old system (after confirmation)
- [ ] Database cleanup

**Risk Level**: 🔴 CRITICAL (data migration)

## Implementation Safety Measures

### 1. Feature Flags
```typescript
// Environment variable control
const USE_MESSAGING_V2 = process.env.ENABLE_MESSAGING_V2 === 'true'

// Per-user rollout
const userInV2Beta = await checkUserBetaStatus(userId)

// Component-level switching
{USE_MESSAGING_V2 && userInV2Beta ?
  <ChatModalV2 /> :
  <ChatModal />
}
```

### 2. Database Backup Strategy
```bash
# Before each phase, I'll recommend:
# 1. Full database backup
pg_dump property_sync > backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Test migration on backup copy
createdb property_sync_test
psql property_sync_test < backup_20241201_120000.sql
```

### 3. Rollback Plan
- Keep old system functional at all times
- Feature flags allow instant rollback
- Database migrations are reversible
- WebSocket fallback to old gateway

### 4. Monitoring & Alerts
- Error rate monitoring for V2 endpoints
- WebSocket connection success rates
- Message delivery confirmation
- User feedback collection

## Phase 1 Detailed Implementation

Let's start with Phase 1 - would you like me to proceed?

### Phase 1 Tasks:

1. **Create new Prisma schema additions** (SHOW YOU FIRST)
2. **Set up V2 service structure** (no functionality yet)
3. **Create feature flag system**
4. **Set up API v2 routing**

### Next Steps:
1. I'll create the Prisma migration file (NO EXECUTION)
2. Show you the exact SQL changes
3. Get your approval before proceeding
4. Set up the basic V2 structure

This approach ensures:
✅ Zero risk to existing system
✅ Full rollback capability
✅ Your control over all database changes
✅ Gradual, testable implementation

**Ready to start Phase 1?**
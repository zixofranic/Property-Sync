# Property Sync Messaging System - Comprehensive UML Structure

## 1. System Overview & Requirements

### Core Messaging Requirements
1. **Property-Specific Conversations**: Each property should have isolated conversations between agent and client
2. **Real-time Notifications**: Instant notifications for new messages
3. **Visual Indicators**: Unread message counts on property cards and global notifications
4. **Dual Interface**: Both agent dashboard and client timeline should support messaging
5. **Message Persistence**: Messages stored in database with read/unread status

---

## 2. Database Schema (Prisma Models)

```prisma
model Conversation {
  id               String   @id @default(cuid())
  agentId          String
  clientId         String
  timelineId       String
  propertyId       String?  // CRITICAL: Makes conversations property-specific

  isActive         Boolean  @default(true)
  lastMessageAt    DateTime @default(now())
  agentUnreadCount Int      @default(0)
  clientUnreadCount Int     @default(0)

  // Relations
  agent     User      @relation("AgentConversations")
  client    Client    @relation("ClientConversations")
  timeline  Timeline  @relation("TimelineConversations")
  property  Property? @relation("PropertyConversations")
  messages  Message[]

  // UNIQUE CONSTRAINT: Ensures property isolation
  @@unique([agentId, clientId, timelineId, propertyId])
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  senderId       String   // agentId OR clientId
  senderType     String   // 'agent' | 'client'
  content        String
  isRead         Boolean  @default(false)
  readAt         DateTime?

  conversation   Conversation @relation(fields: [conversationId])
}
```

---

## 3. Architecture Components

### Backend Services

```typescript
// MessagingService - Core conversation management
class MessagingService {
  // CRITICAL: Property-specific conversation lookup
  async createOrGetConversation(data: {
    agentId: string,
    clientId: string,
    timelineId: string,
    propertyId?: string  // Optional for property-specific chats
  }): Promise<ConversationResponse>

  async sendMessage(data: CreateMessageDto): Promise<MessageResponse>
  async getConversations(userId: string, userType: 'agent'|'client'): Promise<ConversationResponse[]>
  async markMessagesAsRead(conversationId: string, userId: string): Promise<void>
}

// MessagingGateway - WebSocket real-time communication
class MessagingGateway {
  @SubscribeMessage('join-conversation')
  async handleJoinConversation(data: {
    conversationId: string,
    propertyId?: string  // CRITICAL: Property context
  })

  @SubscribeMessage('send-message')
  async handleSendMessage(data: {
    conversationId?: string,
    content: string,
    timelineId?: string,
    propertyId?: string  // CRITICAL: Property context
  })

  // Real-time event emissions
  emit('new-message', messageData)
  emit('message-notification', notificationData)
  emit('conversation_joined', { conversationId, messages, propertyId })
}
```

### Frontend Components

```typescript
// MessagingContext - Global state management
interface MessagingContextType {
  messages: Record<string, MessageResponse[]>  // Key: conversationId-propertyId
  conversations: ConversationResponse[]
  unreadCounts: Record<string, number>

  sendMessage(conversationId: string, content: string, propertyId?: string): Promise<void>
  joinConversation(conversationId: string, propertyId?: string): Promise<void>
  markMessagesAsRead(conversationId: string): Promise<void>
}

// ChatInterface - Property-specific chat UI
interface ChatInterfaceProps {
  timelineId: string
  propertyId?: string  // CRITICAL: Determines conversation scope
  conversationId?: string
}

// PropertyCard - Shows chat button with notification badge
interface PropertyCardProps {
  property: PropertyWithMessages
  timelineId: string
  showUnreadIndicator: boolean  // Visual notification
}
```

---

## 4. Message Flow Diagrams

### 4.1 Agent Sends Message to Client

```
Agent Dashboard (PropertyCard)
    ↓ [opens chat with propertyId]
ChatInterface
    ↓ [sendMessage(content, propertyId)]
MessagingContext
    ↓ [WebSocket: send-message]
MessagingGateway.handleSendMessage()
    ↓ [finds/creates conversation with propertyId]
MessagingService.sendMessageWithAutoCreate()
    ↓ [saves to database]
Database (Conversation + Message)
    ↓ [emits real-time events]
WebSocket Events:
    ├─ new-message → ChatInterface (updates UI)
    └─ message-notification → Client Timeline
```

### 4.2 Client Receives Notification

```
MessagingGateway.handleSendMessage()
    ↓ [after saving message]
WebSocket Events Emitted:
    ├─ new-message: {
    │    conversationId, senderId, content,
    │    propertyId  // CRITICAL for routing
    │  }
    └─ message-notification: {
         conversationId, senderId, content,
         propertyId,  // CRITICAL for property-specific notifications
         timestamp
       }

Client Timeline Receives:
    ↓ [message-notification event]
MessagingContext.handleMessageNotification()
    ↓ [updates unread counts per property]
UI Updates:
    ├─ PropertyCard shows notification badge
    ├─ Global notification dropdown shows new message
    └─ Conversation list updates unread count
```

### 4.3 Property-Specific Conversation Creation

```
User opens PropertyCard chat
    ↓ [ChatInterface with propertyId]
MessagingContext.joinConversation(conversationId, propertyId)
    ↓ [WebSocket: join-conversation]
MessagingGateway.handleJoinConversation()
    ↓ [verifies access and gets conversation]
MessagingService.getConversation()
    ↓ [if not found, auto-create with propertyId]
MessagingService.createOrGetConversation({
  agentId, clientId, timelineId, propertyId
})
    ↓ [database lookup with compound unique key]
findFirst({ agentId, clientId, timelineId, propertyId })
    ↓ [creates new if not found]
Database stores conversation with propertyId
```

---

## 5. Notification System Requirements

### 5.1 Agent Dashboard Notifications

**Location**: Property Cards in Mission Control
**Requirements**:
- Show red badge/dot when property has unread messages
- Badge count shows number of unread messages for that property
- Badge disappears when messages are read
- Clicking chat opens property-specific conversation

**Implementation**:
```typescript
// PropertyCard component
<PropertyCard property={property} timelineId={timeline.id}>
  <ChatButton>
    {unreadCount > 0 && (
      <NotificationBadge count={unreadCount} />
    )}
  </ChatButton>
</PropertyCard>
```

### 5.2 Client Timeline Notifications

**Location 1**: Property Cards
- Same as agent dashboard
- Show notification badge per property
- Property-specific unread counts

**Location 2**: Global Notification Dropdown (Top Left)
- Shows list of recent messages across all properties
- Groups by property or conversation
- Click navigates to specific property chat
- Shows sender name and message preview

**Implementation**:
```typescript
// Global notification dropdown
<NotificationDropdown>
  {recentMessages.map(msg => (
    <NotificationItem
      key={msg.id}
      propertyId={msg.propertyId}
      senderName={msg.senderName}
      content={msg.content}
      timestamp={msg.timestamp}
      onClick={() => openPropertyChat(msg.propertyId)}
    />
  ))}
</NotificationDropdown>
```

---

## 6. Message Storage & Routing

### 6.1 Message Storage Keys

**Critical**: Messages must be stored with property-specific keys to prevent cross-property contamination.

```typescript
// MessagingContext message storage
const messages: Record<string, MessageResponse[]> = {
  // Property-specific conversations
  "conv123-prop456": [...messages],  // Property A messages
  "conv789-prop101": [...messages],  // Property B messages

  // General timeline conversations (no propertyId)
  "conv999": [...messages]           // General timeline chat
}

// Key generation logic
const generateMessageKey = (conversationId: string, propertyId?: string) => {
  return propertyId ? `${conversationId}-${propertyId}` : conversationId;
}
```

### 6.2 Event Routing

**All WebSocket events MUST include propertyId for proper routing**:

```typescript
// Correct event structure
interface MessageEvent {
  id: string
  conversationId: string
  senderId: string
  senderType: 'agent' | 'client'
  content: string
  propertyId?: string  // CRITICAL: Must be included
  timestamp: Date
}

interface NotificationEvent {
  conversationId: string
  senderId: string
  senderName: string
  content: string
  propertyId?: string  // CRITICAL: For property-specific notifications
  timestamp: Date
}
```

---

## 7. Expected User Flows

### 7.1 Agent Messaging Flow

1. **Agent opens Mission Control dashboard**
2. **Sees property cards with timeline data**
3. **Clicks chat button on Property A**
   - Opens ChatInterface with `propertyId=A`
   - Creates/joins conversation for Property A only
4. **Sends message "Hello about Property A"**
   - Message stored with conversation linked to Property A
   - Client receives notification for Property A
5. **Clicks chat button on Property B**
   - Opens different ChatInterface with `propertyId=B`
   - Creates/joins separate conversation for Property B
   - Should NOT see messages from Property A
6. **Sends message "Hello about Property B"**
   - Separate message thread for Property B
   - Client receives separate notification for Property B

### 7.2 Client Notification Flow

1. **Client viewing timeline at /timeline/[shareToken]**
2. **Agent sends message about Property A**
3. **Client receives real-time notification**:
   - Global notification dropdown shows new message
   - Property A card shows notification badge
   - Property B card remains unchanged (no badge)
4. **Client clicks Property A chat**:
   - Opens conversation for Property A only
   - Sees only messages related to Property A
   - Notification badge disappears for Property A
5. **Client clicks Property B chat**:
   - Opens separate conversation for Property B
   - Should be empty or show only Property B messages
   - No messages from Property A visible

### 7.3 Cross-Property Isolation Test

**Test Scenario**: Ensure messages don't leak between properties

1. Agent sends message to Property A: "This is about house on Main St"
2. Agent sends message to Property B: "This is about condo on Oak Ave"
3. Client opens Property A chat → Should ONLY see Main St message
4. Client opens Property B chat → Should ONLY see Oak Ave message
5. Property A notifications should not affect Property B UI state
6. Each property should maintain independent unread counts

---

## 8. Critical Issues to Investigate

### 8.1 Conversation Creation Logic
**Problem**: Multiple properties sharing same conversation
**Root Cause**: Insufficient propertyId handling in database queries
**Fix Required**: Ensure all conversation lookups include propertyId

### 8.2 Message Routing
**Problem**: WebSocket events not including propertyId
**Root Cause**: Event emission missing property context
**Fix Required**: Include propertyId in all message and notification events

### 8.3 Frontend State Management
**Problem**: Messages stored without property isolation
**Root Cause**: Storage keys not including propertyId
**Fix Required**: Update MessagingContext to use property-specific keys

### 8.4 Notification Targeting
**Problem**: Notifications appearing on wrong properties
**Root Cause**: Event handlers not filtering by propertyId
**Fix Required**: Add propertyId filtering to notification logic

---

## 9. Testing Checklist

### 9.1 Database Level
- [ ] Conversations created with correct propertyId
- [ ] Unique constraint prevents property sharing
- [ ] Messages linked to correct conversations
- [ ] Unread counts tracked per conversation

### 9.2 Backend Level
- [ ] WebSocket events include propertyId
- [ ] Message routing uses property context
- [ ] Conversation lookup filters by propertyId
- [ ] Auto-creation includes propertyId

### 9.3 Frontend Level
- [ ] Messages stored with property-specific keys
- [ ] ChatInterface uses correct propertyId
- [ ] Notifications filtered by property
- [ ] UI state isolated per property

### 9.4 Integration Level
- [ ] Agent→Client messaging works per property
- [ ] Client→Agent messaging works per property
- [ ] Property A messages don't appear in Property B
- [ ] Notification badges show correct counts per property
- [ ] Global notifications show property context

---

## 10. Current Implementation Gaps

Based on the error messages and behavior described:

1. **Missing propertyId in WebSocket events** - Events may not include property context
2. **Incorrect message storage keys** - Frontend may not be using property-specific storage
3. **Conversation lookup issues** - Backend may not be filtering by propertyId correctly
4. **Notification routing problems** - Events may be broadcast to all properties instead of specific ones
5. **State management conflicts** - Frontend state may be shared between properties

Each of these gaps needs to be systematically addressed to achieve proper property-specific messaging isolation.
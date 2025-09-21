# Property Sync Messaging System - Complete Rewrite UML

## Executive Summary
After 3 days of debugging, the current messaging system has fundamental architectural flaws that require a complete rewrite. This document provides a comprehensive UML design for a robust, scalable messaging system.

## Current Problems Identified
1. **Shared Conversations**: All properties use the same conversation ID
2. **Inconsistent Data Flow**: Messages leak between property cards
3. **Poor Database Schema**: Missing proper foreign key relationships
4. **Frontend State Issues**: MessagingContext not properly isolated per property
5. **Authentication Confusion**: Agent vs Client token handling mixed up

## New Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     MESSAGING SYSTEM V2                        │
├─────────────────────────────────────────────────────────────────┤
│  Agent Frontend  │  Client Frontend  │  WebSocket Gateway       │
│  ├─PropertyCard  │  ├─PropertyCard   │  ├─Room Management       │
│  │ └─ChatModal   │  │ └─ChatModal    │  ├─Message Broadcasting  │
│  └─Notifications │  └─Notifications  │  └─Authentication        │
├─────────────────────────────────────────────────────────────────┤
│                    REST API LAYER                               │
│  ├─ConversationController  ├─MessageController                  │
│  ├─NotificationController  └─PropertyController                 │
├─────────────────────────────────────────────────────────────────┤
│                   SERVICE LAYER                                 │
│  ├─ConversationService  ├─MessageService  ├─NotificationService │
│  ├─PropertyService      └─WebSocketService                      │
├─────────────────────────────────────────────────────────────────┤
│                   DATABASE LAYER                                │
│  ├─PropertyConversation (NEW)  ├─Message  ├─Notification        │
│  ├─Property                    ├─User     └─Timeline             │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema V2

### Core Entities

```sql
-- Property Conversations (NEW - One per property)
CREATE TABLE PropertyConversation {
  id                String    @id @default(cuid())
  propertyId        String    @unique
  timelineId        String
  agentId          String
  clientId         String
  status           ConversationStatus @default(ACTIVE)
  unreadAgentCount Int       @default(0)
  unreadClientCount Int      @default(0)
  lastMessageAt    DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  // Relations
  property         Property   @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  timeline         Timeline   @relation(fields: [timelineId], references: [id], onDelete: Cascade)
  agent           User       @relation("AgentConversations", fields: [agentId], references: [id])
  client          User       @relation("ClientConversations", fields: [clientId], references: [id])
  messages        Message[]
  notifications   Notification[]

  @@unique([propertyId]) // ONE conversation per property
  @@index([agentId, status])
  @@index([clientId, status])
  @@index([timelineId])
}

-- Messages (Updated)
CREATE TABLE Message {
  id                    String    @id @default(cuid())
  conversationId        String
  senderId              String
  senderType            UserType  // AGENT | CLIENT
  content               String
  type                  MessageType @default(TEXT) // TEXT | IMAGE | FILE
  isRead                Boolean   @default(false)
  readAt                DateTime?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  // Relations
  conversation          PropertyConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender               User      @relation(fields: [senderId], references: [id])

  @@index([conversationId, createdAt])
  @@index([senderId])
}

-- Notifications (NEW - For property-specific notifications)
CREATE TABLE Notification {
  id                String    @id @default(cuid())
  conversationId    String
  recipientId       String
  type              NotificationType // NEW_MESSAGE | PROPERTY_VIEWED | etc.
  title             String
  message           String
  isRead            Boolean   @default(false)
  readAt            DateTime?
  createdAt         DateTime  @default(now())

  // Relations
  conversation      PropertyConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  recipient         User      @relation(fields: [recipientId], references: [id])

  @@index([recipientId, isRead])
  @@index([conversationId])
}

-- Enums
enum ConversationStatus {
  ACTIVE
  ARCHIVED
  CLOSED
}

enum MessageType {
  TEXT
  IMAGE
  FILE
  SYSTEM
}

enum NotificationType {
  NEW_MESSAGE
  PROPERTY_VIEWED
  PROPERTY_FEEDBACK
  TIMELINE_SHARED
}

enum UserType {
  AGENT
  CLIENT
}
```

## API Endpoints V2

### 1. Property Conversation Management

```typescript
// GET /api/v1/conversations/property/:propertyId
// Get or create conversation for a specific property
ConversationController.getPropertyConversation(propertyId: string)

// Response:
{
  id: string
  propertyId: string
  timelineId: string
  agentId: string
  clientId: string
  status: 'ACTIVE' | 'ARCHIVED'
  unreadAgentCount: number
  unreadClientCount: number
  lastMessageAt: string
  messages: Message[]
  property: {
    id: string
    address: string
    price: number
    imageUrl: string
  }
}
```

### 2. Message Management

```typescript
// POST /api/v1/conversations/:conversationId/messages
MessageController.sendMessage(conversationId: string, body: {
  content: string
  type?: 'TEXT' | 'IMAGE' | 'FILE'
})

// GET /api/v1/conversations/:conversationId/messages
MessageController.getMessages(conversationId: string, params: {
  page?: number
  limit?: number
  before?: string // cursor-based pagination
})

// PUT /api/v1/conversations/:conversationId/messages/:messageId/read
MessageController.markAsRead(conversationId: string, messageId: string)

// PUT /api/v1/conversations/:conversationId/read-all
MessageController.markAllAsRead(conversationId: string)
```

### 3. Notification Management

```typescript
// GET /api/v1/notifications
NotificationController.getNotifications(query: {
  type?: NotificationType
  isRead?: boolean
  page?: number
  limit?: number
})

// PUT /api/v1/notifications/:notificationId/read
NotificationController.markAsRead(notificationId: string)

// PUT /api/v1/notifications/read-all
NotificationController.markAllAsRead()
```

## WebSocket Events V2

### Connection Management
```typescript
// Agent connects to their workspace
io.to(`agent:${agentId}`).join(`agent:${agentId}`)

// Client connects to specific timeline
io.to(`client:${clientId}:${timelineId}`).join(`timeline:${timelineId}`)
```

### Property-Specific Rooms
```typescript
// Join property conversation room
socket.join(`conversation:${conversationId}`)

// Leave when switching properties
socket.leave(`conversation:${previousConversationId}`)
```

### Message Events
```typescript
// Send message
socket.emit('send-message', {
  conversationId: string
  content: string
  type?: MessageType
})

// Receive message
socket.on('new-message', {
  id: string
  conversationId: string
  senderId: string
  senderType: 'AGENT' | 'CLIENT'
  content: string
  type: MessageType
  createdAt: string
  sender: {
    id: string
    name: string
    avatar?: string
  }
})

// Typing indicators
socket.emit('typing-start', { conversationId: string })
socket.emit('typing-stop', { conversationId: string })
socket.on('user-typing', { conversationId: string, userId: string, userName: string })

// Read receipts
socket.emit('mark-read', { conversationId: string, messageId: string })
socket.on('message-read', { conversationId: string, messageId: string, readBy: string })
```

### Notification Events
```typescript
// Property-specific notifications
socket.on('property-notification', {
  id: string
  conversationId: string
  type: NotificationType
  title: string
  message: string
  propertyAddress: string
  createdAt: string
})

// Global notifications (timeline level)
socket.on('timeline-notification', {
  id: string
  timelineId: string
  type: NotificationType
  title: string
  message: string
  createdAt: string
})
```

## Frontend Architecture V2

### React Context Structure

```typescript
// 1. Conversation Context (Property-Specific)
interface ConversationContextType {
  conversation: PropertyConversation | null
  messages: Message[]
  isLoading: boolean
  unreadCount: number

  // Actions
  sendMessage: (content: string, type?: MessageType) => Promise<void>
  loadMessages: (before?: string) => Promise<void>
  markAsRead: (messageId?: string) => Promise<void>
  markAllAsRead: () => Promise<void>

  // Real-time
  isTyping: boolean
  startTyping: () => void
  stopTyping: () => void
}

// 2. Notification Context (Global)
interface NotificationContextType {
  notifications: Notification[]
  unreadCount: number

  // Actions
  loadNotifications: () => Promise<void>
  markAsRead: (notificationId: string) => Promise<void>
  markAllAsRead: () => Promise<void>
}

// 3. WebSocket Context (Global)
interface WebSocketContextType {
  socket: Socket | null
  isConnected: boolean

  // Connection management
  connect: (token: string, userType: 'AGENT' | 'CLIENT') => void
  disconnect: () => void

  // Room management
  joinConversation: (conversationId: string) => void
  leaveConversation: (conversationId: string) => void
}
```

### Component Structure

```typescript
// Agent Side
<AgentDashboard>
  <WebSocketProvider>
    <NotificationProvider>
      <TimelineList>
        {timelines.map(timeline => (
          <TimelineCard key={timeline.id}>
            <PropertyList>
              {timeline.properties.map(property => (
                <PropertyCard key={property.id}>
                  <ConversationProvider propertyId={property.id}>
                    <ChatModal>
                      <MessageList />
                      <MessageInput />
                      <TypingIndicator />
                    </ChatModal>
                    <NotificationBadge />
                  </ConversationProvider>
                </PropertyCard>
              ))}
            </PropertyList>
          </TimelineCard>
        ))}
      </TimelineList>
      <GlobalNotifications />
    </NotificationProvider>
  </WebSocketProvider>
</AgentDashboard>

// Client Side
<ClientTimeline>
  <WebSocketProvider>
    <NotificationProvider>
      <PropertyList>
        {properties.map(property => (
          <PropertyCard key={property.id}>
            <ConversationProvider propertyId={property.id}>
              <ChatModal>
                <MessageList />
                <MessageInput />
                <TypingIndicator />
              </ChatModal>
              <NotificationBadge />
            </ConversationProvider>
          </PropertyCard>
        ))}
      </PropertyList>
      <GlobalNotifications />
    </NotificationProvider>
  </WebSocketProvider>
</ClientTimeline>
```

## Key Design Principles

### 1. **One Conversation Per Property**
- Each property has exactly ONE conversation
- PropertyConversation table ensures 1:1 relationship
- Conversations are auto-created when property is added to timeline

### 2. **Proper Data Isolation**
- ConversationProvider wraps each PropertyCard
- Messages are scoped to conversationId
- No shared state between property chats

### 3. **Room-Based WebSocket Management**
- Each conversation has its own WebSocket room
- Users join/leave rooms when opening/closing chats
- Prevents message leakage between properties

### 4. **Hierarchical Notifications**
- Property-level notifications (new messages, feedback)
- Timeline-level notifications (new properties, shares)
- Global agent notifications (across all timelines)

### 5. **Robust Authentication**
- Clear separation of Agent vs Client authentication
- Proper JWT token validation for WebSocket connections
- Session management for guest client access

## Implementation Plan

### Phase 1: Database Migration
1. Create new PropertyConversation table
2. Migrate existing data (if any)
3. Update Property model to include conversation relation
4. Add proper indexes for performance

### Phase 2: Backend Services
1. Implement ConversationService with property-specific logic
2. Rewrite MessageService for proper conversation scoping
3. Create NotificationService for hierarchical notifications
4. Update WebSocket gateway with room management

### Phase 3: API Endpoints
1. Create new conversation endpoints
2. Update message endpoints with conversation scoping
3. Implement notification endpoints
4. Add proper error handling and validation

### Phase 4: Frontend Rewrite
1. Create new ConversationProvider per property
2. Implement room-based WebSocket management
3. Update UI components for proper data isolation
4. Add notification system

### Phase 5: Testing & Deployment
1. End-to-end testing of message isolation
2. Performance testing with multiple properties
3. WebSocket connection stability testing
4. Gradual rollout with feature flags

## Success Criteria

✅ **Message Isolation**: Each property chat shows only its own messages
✅ **Real-time Updates**: Messages appear instantly in correct property chat
✅ **Notification Accuracy**: Notifications show for the correct property
✅ **Scalability**: System handles multiple properties/conversations efficiently
✅ **User Experience**: Intuitive chat interface with proper feedback
✅ **Data Integrity**: No message leakage between properties

This rewrite addresses all the fundamental issues with a clean, scalable architecture that ensures proper message isolation and real-time functionality.

## Complete System Flow

### 1. Property Creation Flow
```
Agent adds property via batch import
       ↓
BatchManagementService.importParsedProperties()
       ↓
Property created in database
       ↓
ConversationService.createPropertyConversation()
       ↓
PropertyConversation created with:
- propertyId (unique)
- agentId, clientId, timelineId
- status: ACTIVE
- unreadCounts: 0
       ↓
Property response includes conversationId
```

### 2. Agent Opens Property Chat Flow
```
Agent clicks chat icon on PropertyCard
       ↓
ConversationProvider loads conversation:
GET /api/v1/conversations/property/{propertyId}
       ↓
If conversation exists: return conversation + recent messages
If not exists: create new conversation automatically
       ↓
WebSocket: socket.join(`conversation:${conversationId}`)
       ↓
UI renders ChatModal with:
- Conversation metadata
- Message history
- Input field
- Typing indicators
- Unread count badge
```

### 3. Client Opens Property Chat Flow
```
Client clicks chat icon on PropertyCard
       ↓
ConversationProvider loads conversation:
GET /api/v1/conversations/property/{propertyId}
(using client session token)
       ↓
Same conversation as agent (shared by propertyId)
       ↓
WebSocket: socket.join(`conversation:${conversationId}`)
       ↓
UI renders ChatModal with same conversation
```

### 4. Message Sending Flow
```
User types message and hits send
       ↓
ConversationContext.sendMessage(content)
       ↓
POST /api/v1/conversations/{conversationId}/messages
{
  content: "Hello!",
  type: "TEXT"
}
       ↓
MessageService.createMessage():
- Create message in database
- Update conversation.lastMessageAt
- Increment unread count for recipient
- Create notification for recipient
       ↓
WebSocket broadcast to conversation room:
io.to(`conversation:${conversationId}`).emit('new-message', messageData)
       ↓
Both agent and client receive message in real-time
       ↓
UI updates message list
- Sender sees message immediately
- Recipient sees message + notification badge
- Conversation moves to top of list
```

### 5. Real-time Message Reception Flow
```
WebSocket receives 'new-message' event
       ↓
ConversationContext updates messages array
       ↓
If chat is open:
- Message appears in chat
- Auto-scroll to bottom
- Mark as read automatically
       ↓
If chat is closed:
- Increment unread badge on PropertyCard
- Show browser notification (if enabled)
- Add to notification dropdown
       ↓
NotificationContext updates global unread count
```

### 6. Notification System Flow
```
New message created
       ↓
NotificationService.createNotification():
- type: NEW_MESSAGE
- conversationId: links to property
- recipientId: agent or client
- title: "New message for {propertyAddress}"
- message: preview of content
       ↓
WebSocket broadcast to recipient:
io.to(`user:${recipientId}`).emit('property-notification', notificationData)
       ↓
Frontend updates:
- Property card badge (+1 unread)
- Global notification dropdown
- Browser notification (if enabled)
       ↓
When user opens chat:
- Mark all messages as read
- Clear property badge
- Mark notifications as read
```

### 7. Multi-Property Isolation Flow
```
Agent has 3 properties in timeline:
- Property A: conversation-id-A
- Property B: conversation-id-B
- Property C: conversation-id-C
       ↓
Each PropertyCard has its own ConversationProvider:
<PropertyCard property={propertyA}>
  <ConversationProvider conversationId="conversation-id-A">
    <ChatModal /> // Only shows messages for Property A
  </ConversationProvider>
</PropertyCard>
       ↓
WebSocket room isolation:
- Property A chat: joined to "conversation:conversation-id-A"
- Property B chat: joined to "conversation:conversation-id-B"
- Property C chat: joined to "conversation:conversation-id-C"
       ↓
Messages are broadcasted only to correct room:
io.to(`conversation:conversation-id-A`).emit('new-message', msg)
       ↓
Only Property A chat receives the message
```

### 8. Authentication Flow
```
Agent Authentication:
Login → JWT token → WebSocket auth → join `agent:${agentId}` room

Client Authentication (Timeline Access):
shareToken + clientCode → session validation → WebSocket auth → join `timeline:${timelineId}` room

WebSocket Connection:
socket.auth = { token, userType: 'AGENT' | 'CLIENT' }
       ↓
Server validates token and userType
       ↓
socket.join(userType === 'AGENT' ? `agent:${userId}` : `timeline:${timelineId}`)
```

### 9. Error Handling Flow
```
Any API call fails
       ↓
Service layer catches error
       ↓
Returns structured error response:
{
  success: false,
  error: "Conversation not found",
  code: "CONVERSATION_NOT_FOUND"
}
       ↓
Frontend ConversationContext handles error:
- Shows error toast
- Retries if appropriate
- Fallbacks to previous state
       ↓
WebSocket connection failures:
- Auto-reconnect with exponential backoff
- Show "Connecting..." status
- Queue messages until reconnected
```

### 10. Data Consistency Flow
```
Database Transaction for Message Creation:
BEGIN TRANSACTION
  1. Insert message
  2. Update conversation.lastMessageAt
  3. Increment conversation.unreadCount
  4. Insert notification
COMMIT
       ↓
If any step fails, entire transaction rolls back
       ↓
WebSocket broadcast only after successful DB commit
       ↓
Frontend optimistic updates with rollback on error
```

This complete flow ensures:
✅ Perfect message isolation per property
✅ Real-time updates without cross-contamination
✅ Proper error handling and recovery
✅ Scalable architecture for multiple properties
✅ Consistent data across all clients
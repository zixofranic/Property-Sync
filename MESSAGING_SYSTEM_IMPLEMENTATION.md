# Messaging System Implementation Guide

## Database Schema Changes (Prisma)

### New Enums
```prisma
enum MessageSenderType {
  USER
  CLIENT
  SYSTEM
}

enum MessageType {
  TEXT
  FILE
  IMAGE
  SYSTEM_MESSAGE
  PROPERTY_REFERENCE
  FEEDBACK_ALERT
}

enum ParticipantType {
  AGENT
  CLIENT
  SYSTEM
}
```

### New Models

#### Conversation Model
```prisma
model Conversation {
  id          String @id @default(cuid())
  timelineId  String?
  propertyId  String?
  title       String?
  description String?
  lastMessageAt DateTime?
  isActive    Boolean @default(true)

  timeline    Timeline? @relation(fields: [timelineId], references: [id], onDelete: Cascade)
  property    Property? @relation(fields: [propertyId], references: [id], onDelete: Cascade)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  messages    Message[]
  participants ConversationParticipant[]

  @@map("conversations")
}
```

#### ConversationParticipant Model
```prisma
model ConversationParticipant {
  id             String @id @default(cuid())
  conversationId String
  userId         String?
  clientId       String?
  participantType ParticipantType
  userType       String?
  isActive       Boolean @default(true)
  lastReadAt     DateTime?

  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  user           User?        @relation(fields: [userId], references: [id], onDelete: Cascade)
  client         Client?      @relation(fields: [clientId], references: [id], onDelete: Cascade)

  joinedAt       DateTime @default(now())
  leftAt         DateTime?

  @@unique([conversationId, userId])
  @@unique([conversationId, clientId])
  @@map("conversation_participants")
}
```

#### Message Model
```prisma
model Message {
  id             String @id @default(cuid())
  conversationId String
  senderId       String
  senderType     MessageSenderType
  messageType    MessageType @default(TEXT)

  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender         User         @relation(fields: [senderId], references: [id], onDelete: Cascade)

  content        String
  fileUrl        String?
  fileName       String?
  metadata       String? // JSON metadata for message

  isEdited       Boolean @default(false)
  editedAt       DateTime?
  isDeleted      Boolean @default(false)
  deletedAt      DateTime?

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  reads          MessageRead[]

  @@map("messages")
}
```

#### MessageRead Model
```prisma
model MessageRead {
  id        String @id @default(cuid())
  messageId String
  userId    String

  message   Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  readAt    DateTime @default(now())

  @@unique([messageId, userId])
  @@map("message_reads")
}
```

### Model Relationship Updates

#### User Model - Add messaging relationships
```prisma
// Add to User model relationships section:
  // Messages (from CHATTING_SYSTEM_STUDY.md design)
  sentMessages     Message[]
  messageReads     MessageRead[]
  participantIn    ConversationParticipant[]
```

#### Client Model - Add messaging relationships
```prisma
// Add to Client model relationships section:
  participantIn ConversationParticipant[]
```

#### Timeline Model - Add conversations
```prisma
// Add to Timeline model relationships section:
  conversations   Conversation[]
```

#### Property Model - Add conversations
```prisma
// Add to Property model relationships section:
  conversations Conversation[]
```

## Backend Implementation Files

### 1. Messaging Controller (`src/messaging/messaging.controller.ts`)
```typescript
// Complete controller implementation for messaging endpoints
// - GET /conversations
// - POST /conversations
// - GET /conversations/:id/messages
// - POST /conversations/:id/messages
// - PUT /conversations/:id/messages/:messageId
// - DELETE /conversations/:id/messages/:messageId
// - POST /conversations/:id/participants
// - DELETE /conversations/:id/participants/:participantId
```

### 2. Messaging Service (`src/messaging/messaging.service.ts`)
```typescript
// Complete service implementation with methods:
// - getConversations()
// - createConversation()
// - getMessages()
// - sendMessage()
// - editMessage()
// - deleteMessage()
// - addParticipant()
// - removeParticipant()
// - markMessageAsRead()
```

### 3. Messaging Gateway (`src/messaging/messaging.gateway.ts`)
```typescript
// WebSocket gateway for real-time messaging:
// - handleConnection()
// - handleDisconnect()
// - handleJoinConversation()
// - handleLeaveConversation()
// - handleSendMessage()
// - handleTypingStart()
// - handleTypingStop()
```

### 4. Messaging Module (`src/messaging/messaging.module.ts`)
```typescript
// Module setup with imports, controllers, providers
```

## Frontend Implementation Files

### 1. Message Components (`web/src/components/messaging/`)
- `MessageList.tsx` - Display list of messages
- `MessageInput.tsx` - Input for new messages
- `ConversationList.tsx` - List of conversations
- `ChatWindow.tsx` - Main chat interface
- `ParticipantsList.tsx` - Show conversation participants

### 2. Contexts (`web/src/contexts/`)
- `MessagingContext.tsx` - Global messaging state
- `WebSocketContext.tsx` - WebSocket connection management

### 3. Hooks (`web/src/hooks/`)
- `useMessaging.ts` - Messaging operations
- `useWebSocket.ts` - WebSocket management
- `useTyping.ts` - Typing indicators

## WebSocket Integration

### Client-side WebSocket Setup
```typescript
// Socket.IO client configuration
// Real-time message delivery
// Typing indicators
// Online status
```

### Server-side WebSocket Events
```typescript
// Message events
// Conversation events
// Participant events
// Typing events
```

## Key Implementation Notes

1. **Progressive Implementation Order:**
   - Database schema first
   - Backend API endpoints
   - WebSocket integration
   - Frontend components
   - Real-time features

2. **SQLite Compatibility:**
   - Arrays stored as JSON strings
   - Proper field types for SQLite

3. **Security Considerations:**
   - Message authorization
   - Participant validation
   - Content filtering

4. **Performance:**
   - Message pagination
   - Conversation loading
   - Real-time optimizations

## Files Created/Modified

### Backend Files:
- `api/src/messaging/messaging.controller.ts` (NEW)
- `api/src/messaging/messaging.service.ts` (NEW)
- `api/src/messaging/messaging.gateway.ts` (NEW)
- `api/src/messaging/messaging.module.ts` (NEW)
- `api/prisma/schema.prisma` (MODIFIED - add messaging models)

### Frontend Files:
- `web/src/components/messaging/` (NEW DIRECTORY)
- `web/src/contexts/MessagingContext.tsx` (NEW)
- `web/src/contexts/WebSocketContext.tsx` (NEW)

This document serves as a complete reference for implementing the messaging system progressively on the working codebase.
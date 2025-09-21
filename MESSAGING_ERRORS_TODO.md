# Messaging System Errors - TODO for Tomorrow

## 1. Notification Permission Error
**Error**: "The Notification permission may only be requested from inside a short running user-generated event handler."

**Context**: This error occurs when sending the first message in the client timeline.

**Technical Details**:
- The error appears to be related to browser notification permissions being requested at the wrong time
- Browser security requires notification permission requests to be inside user-generated event handlers (like click events)
- This suggests the messaging system is trying to request notification permissions during message handling rather than during a user interaction

**Investigation Needed**:
- Check where notification permissions are being requested in the messaging system
- Ensure notification permission requests only happen during user-initiated actions (button clicks, etc.)
- Review the notification handling code in the messaging context or components

## 2. Message Without PropertyId Error
**Error**: "Received message without propertyId"

**Message Object**:
```javascript
{
  id: "cmfn7zrzy002d2yeoa5qrdz2p",
  conversationId: "cmflz2rfb000q2yzo3716nqos",
  content: "i know",
  type: "TEXT",
  isRead: false,
  readAt: null,
  createdAt: "2025-09-17T00:04:53.758Z",
  sender: {…}
}
```

**Context**: The messaging system is receiving messages that don't have a propertyId field.

**Technical Details**:
- The message has a conversationId but no propertyId
- This suggests the backend is sending messages without properly including the propertyId
- The frontend messaging context expects all messages to have a propertyId for routing

**Investigation Needed**:
- Check the backend message emission logic to ensure propertyId is always included
- Review the message transformation logic in the websocket gateway
- Verify that the conversation-to-property mapping is working correctly
- Check if this happens with both agent and client messages or just one type

## Files to Review Tomorrow
1. `api/src/messaging/websocket-v2.gateway.ts` - Message emission logic
2. `web/src/contexts/MessagingContext.tsx` - Notification handling and message processing
3. `api/src/messaging/message-v2.service.ts` - Message creation and transformation
4. Any notification-related code in the messaging components

## Priority
- **High**: Notification permission error (affects UX)
- **Medium**: PropertyId missing error (affects message routing but system still works)
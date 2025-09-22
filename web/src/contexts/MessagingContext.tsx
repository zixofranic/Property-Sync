'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useMissionControlStore } from '@/stores/missionControlStore';

interface MessageV2 {
  id: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'PROPERTY_REFERENCE' | 'FEEDBACK_ALERT';
  senderId: string;
  senderType: 'AGENT' | 'CLIENT';
  createdAt: Date;
  isEdited: boolean;
  sender: {
    id: string;
    email: string;
    profile?: {
      firstName: string;
      lastName: string;
    };
  };
  reads: Array<{
    userId: string;
    readAt: Date;
  }>;
}

interface PropertyConversation {
  id: string;
  propertyId: string;
  timelineId: string;
  agentId: string;
  clientId: string;
  status: 'ACTIVE' | 'ARCHIVED' | 'CLOSED';
  unreadAgentCount: number;
  unreadClientCount: number;
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date | null;
  property: {
    id: string;
    address: string;
  };
  timeline: {
    id: string;
    title: string;
  };
  agent: {
    id: string;
    email: string;
    profile?: {
      firstName: string;
      lastName: string;
    };
  };
  client: {
    id: string;
    email: string;
    profile?: {
      firstName: string;
      lastName: string;
    };
  };
}

interface MessagingContextV2Type {
  // Connection state
  socket: Socket | null;
  isConnected: boolean;
  isConnecting: boolean;
  onlineUsers: string[];

  // Current user info
  currentUserId: string | null;
  currentUserType: 'AGENT' | 'CLIENT' | null;

  // Property conversations
  propertyConversations: Record<string, PropertyConversation>; // propertyId -> conversation
  activePropertyId: string | null;
  setActivePropertyId: (propertyId: string | null) => void;

  // Messages
  messages: Record<string, MessageV2[]>; // propertyId -> messages
  loadingMessages: boolean;

  // Actions
  sendMessage: (propertyId: string, content: string, messageType?: MessageV2['type']) => Promise<void>;
  markMessagesAsRead: (propertyId: string) => Promise<void>;
  getOrCreatePropertyConversation: (propertyId: string, timelineId: string) => Promise<PropertyConversation>;
  joinPropertyConversation: (propertyId: string) => void;

  // Utilities
  getPropertyUnreadCount: (propertyId: string) => number;
  getPropertyNotificationCount: (propertyId: string) => number;
  clearPropertyNotifications: (propertyId: string) => void;

  // Real-time events
  typingUsers: Record<string, string[]>; // propertyId -> userIds
  startTyping: (propertyId: string) => void;
  stopTyping: (propertyId: string) => void;
}

const MessagingContext = createContext<MessagingContextV2Type | null>(null);

export function MessagingProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useMissionControlStore();
  const { addNotification } = useMissionControlStore();

  // Connection state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  // Current user state
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserType, setCurrentUserType] = useState<'AGENT' | 'CLIENT' | null>(null);

  // Data state
  const [propertyConversations, setPropertyConversations] = useState<Record<string, PropertyConversation>>({});
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, MessageV2[]>>({});
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const [propertyNotificationCounts, setPropertyNotificationCounts] = useState<Record<string, number>>({});

  // Initialize socket connection to V2 namespace
  useEffect(() => {
    if (socket) return; // Prevent duplicate connections

    // Agent authentication
    if (user && isAuthenticated) {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!token) return;

      // Agent connection will be handled by the 'connected' event handler

      connectWithAgentAuth(token);
      return;
    }

    // Client authentication
    const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('clientSessionToken') : null;
    const shareToken = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('shareToken') || window.location.pathname.split('/').pop() : null;

    if (shareToken) {
      // Connect with session token if available, otherwise just with shareToken
      const effectiveToken = sessionToken || 'anonymous-client';
      console.log('🔵 Client connecting:', {
        shareToken,
        hasSessionToken: !!sessionToken,
        effectiveToken,
        isIncognito: !sessionToken && typeof window !== 'undefined'
      });
      connectWithClientAuth(effectiveToken, shareToken);
      return;
    }
  }, [user, isAuthenticated]);

  // Agent WebSocket connection to V2 namespace
  const connectWithAgentAuth = (token: string) => {
    setIsConnecting(true);

    const newSocket = io(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/messaging-v2`, {
      auth: {
        token: token,
        userType: 'AGENT',
        timelineId: null, // Agent connections don't need specific timeline
      },
      transports: ['websocket', 'polling'],
      upgrade: true,
    });

    setupSocketEventListeners(newSocket);
    setSocket(newSocket);
  };

  // Client WebSocket connection to V2 namespace
  const connectWithClientAuth = (sessionToken: string, shareToken: string) => {
    setIsConnecting(true);

    const newSocket = io(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/messaging-v2`, {
      auth: {
        token: sessionToken, // Use sessionToken as token for clients
        userType: 'CLIENT',
        timelineId: shareToken, // Use shareToken as timelineId for clients
      },
      transports: ['websocket', 'polling'],
      upgrade: true,
    });

    setupSocketEventListeners(newSocket);
    setSocket(newSocket);
  };

  // Socket event listeners for V2 system
  const setupSocketEventListeners = (newSocket: Socket) => {
    newSocket.on('connect', () => {
      console.log('✅ Connected to V2 messaging server');
      console.log('🔗 Socket ID:', newSocket.id);
      setIsConnected(true);
      setIsConnecting(false);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected from V2 messaging server:', reason);
      setIsConnected(false);

      // Clear current user info on disconnect
      setCurrentUserId(null);
      setCurrentUserType(null);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ V2 connection error:', error);
      console.error('🔍 Error details:', {
        message: error.message,
        type: error.type,
        transport: error.transport,
      });
      setIsConnecting(false);
      setIsConnected(false);
    });

    newSocket.on('connected', (data) => {
      console.log('V2 messaging initialized:', data);
      console.log('🔍 Server user detection:', {
        serverUserId: data.userId,
        serverUserType: data.userType,
        localIsAuthenticated: isAuthenticated,
        localUser: user?.id,
        expectedType: isAuthenticated && user ? 'AGENT' : 'CLIENT'
      });
      setOnlineUsers(data.onlineUsers || []);

      // Set current user info - but determine type based on context, not server
      if (data.userId) {
        setCurrentUserId(data.userId);

        // Use server-provided user type as source of truth
        setCurrentUserType(data.userType);

        console.log('🔵 Current user set:', {
          userId: data.userId,
          serverType: data.userType,
          using: data.userType,
          pathname: typeof window !== 'undefined' ? window.location.pathname : 'SSR'
        });
        console.log('🔍 User ID comparison:', {
          serverUserId: data.userId,
          localAgentId: user?.id,
          isAuthenticated,
          match: data.userId === user?.id
        });
      }
    });

    // Handle successful authentication
    newSocket.on('authenticated', (data) => {
      console.log('V2 messaging authenticated:', data);
      setIsConnected(true);
      setIsConnecting(false);
    });

    newSocket.on('user_online', (data) => {
      setOnlineUsers(prev => [...prev.filter(id => id !== data.userId), data.userId]);
    });

    newSocket.on('user_offline', (data) => {
      setOnlineUsers(prev => prev.filter(id => id !== data.userId));
    });

    // Handle new messages from V2 system
    newSocket.on('new-message', (message: any) => {
      console.log('📨 V2 new message received:', {
        messageId: message.id,
        senderType: message.senderType || message.sender?.type,
        senderId: message.senderId || message.sender?.id,
        content: message.content?.substring(0, 20),
        currentUserId: currentUserId,
        currentUserType: currentUserType,
        fullMessage: message
      });

      // Extract property ID from the message's conversation
      const propertyId = message.conversation?.propertyId || message.propertyId;

      if (!propertyId) {
        console.warn('Received message without propertyId:', message);
        return;
      }

      // Transform message to match frontend format
      const transformedMessage: MessageV2 = {
        id: message.id,
        content: message.content,
        type: message.type || 'TEXT',
        senderId: message.sender?.id || message.senderId,
        senderType: message.sender?.type || message.senderType,
        createdAt: message.createdAt,
        isEdited: false,
        sender: {
          id: message.sender?.id || message.senderId,
          email: message.sender?.email || 'unknown@email.com',
          profile: {
            firstName: message.sender?.name?.split(' ')[0] || 'Unknown',
            lastName: message.sender?.name?.split(' ').slice(1).join(' ') || 'User',
          },
        },
        reads: message.isRead ? [{ userId: user?.id || '', readAt: new Date(message.readAt || message.createdAt) }] : [],
      };

      // Check if this is a duplicate message (avoid duplicating optimistic messages)
      setMessages(prev => {
        const existingMessages = prev[propertyId] || [];

        // Check if we already have this message (either by real ID or temp ID being replaced)
        const isDuplicate = existingMessages.some(existingMsg =>
          // Exact ID match (real message duplicate)
          existingMsg.id === transformedMessage.id ||
          // Temp message replacement (optimistic message being replaced by real one)
          (existingMsg.id.startsWith('temp-') &&
           existingMsg.content === transformedMessage.content &&
           Math.abs(new Date(existingMsg.createdAt).getTime() - new Date(transformedMessage.createdAt).getTime()) < 10000)
        );

        // Debug duplicate detection
        if (transformedMessage.content.includes('test') || transformedMessage.content.includes('hello')) {
          console.log('🔍 Duplicate check:', {
            newMessageId: transformedMessage.id,
            newSenderType: transformedMessage.senderType,
            newContent: transformedMessage.content.substring(0, 20),
            isDuplicate,
            existingMessages: existingMessages.map(m => ({
              id: m.id,
              senderType: m.senderType,
              content: m.content.substring(0, 20),
              isTemp: m.id.startsWith('temp-')
            }))
          });
        }

        if (isDuplicate) {
          console.log('🔄 Skipping duplicate message:', transformedMessage.id);
          return prev;
        }

        // If this is a real message, also remove any temp messages with same content
        let filteredMessages = existingMessages;
        if (!transformedMessage.id.startsWith('temp-')) {
          filteredMessages = existingMessages.filter(existingMsg =>
            !(existingMsg.id.startsWith('temp-') &&
              existingMsg.content === transformedMessage.content &&
              Math.abs(new Date(existingMsg.createdAt).getTime() - new Date(transformedMessage.createdAt).getTime()) < 10000)
          );
        }

        return {
          ...prev,
          [propertyId]: [...filteredMessages, transformedMessage],
        };
      });

      // Update property notification count if message is not from current user
      // Use the WebSocket currentUserId instead of mission control user ID for accurate comparison
      // Also check that the message is not a temporary optimistic message to avoid duplicate notifications
      const isFromCurrentUser = transformedMessage.senderId === currentUserId;
      const isOptimisticMessage = message.id.startsWith('temp-');

      // Debug notification logic
      console.log('🔔 Notification check:', {
        messageId: message.id,
        senderId: transformedMessage.senderId,
        currentUserId,
        currentUserType,
        isFromCurrentUser,
        isOptimisticMessage,
        willShowNotification: !isFromCurrentUser && !isOptimisticMessage && currentUserId
      });

      // Additional safety check: if currentUserId is null/undefined, don't show notifications
      // This prevents showing notifications when user authentication is lost (e.g., expired JWT)
      if (!isFromCurrentUser && !isOptimisticMessage && currentUserId) {
        setPropertyNotificationCounts(prev => ({
          ...prev,
          [propertyId]: (prev[propertyId] || 0) + 1,
        }));

        // Show notification popup only for genuine incoming messages from other users
        addNotification({
          type: 'info',
          title: `New message about property`,
          message: message.content.substring(0, 100),
          read: false,
        });
      }

      // Update conversation's last message time
      setPropertyConversations(prev => {
        const conversation = prev[propertyId];
        if (conversation) {
          return {
            ...prev,
            [propertyId]: {
              ...conversation,
              lastMessageAt: new Date(message.createdAt),
            },
          };
        }
        return prev;
      });
    });

    // Handle message read receipts
    newSocket.on('messages-read', (data: { propertyId: string; userId: string; readAt: string }) => {
      const { propertyId, userId, readAt } = data;

      setMessages(prev => ({
        ...prev,
        [propertyId]: (prev[propertyId] || []).map(msg => ({
          ...msg,
          reads: msg.senderId === userId
            ? msg.reads
            : [...(msg.reads || []), { userId, readAt: new Date(readAt) }],
        })),
      }));
    });

    // Handle typing indicators
    newSocket.on('user-typing', (data: { userId: string; propertyId: string; isTyping: boolean }) => {
      const { userId, propertyId, isTyping } = data;

      setTypingUsers(prev => {
        const current = prev[propertyId] || [];

        if (isTyping) {
          return {
            ...prev,
            [propertyId]: current.includes(userId) ? current : [...current, userId],
          };
        } else {
          return {
            ...prev,
            [propertyId]: current.filter(id => id !== userId),
          };
        }
      });
    });

    // Handle property conversation joined (load messages)
    newSocket.on('property-conversation-joined', (data: {
      propertyId: string;
      conversationId: string | null;
      messages: MessageV2[];
      status: string;
    }) => {
      console.log('🔵 Property conversation joined:', data);

      // Handle different status responses
      if (data.status === 'success' && data.conversationId) {
        // Store conversation data
        setPropertyConversations(prev => ({
          ...prev,
          [data.propertyId]: {
            id: data.conversationId,
            propertyId: data.propertyId,
            lastMessageAt: new Date(),
          } as PropertyConversation
        }));

        // Store messages
        setMessages(prev => ({
          ...prev,
          [data.propertyId]: data.messages || []
        }));
      } else {
        // Handle error cases without creating infinite loops
        console.warn(`⚠️ Property conversation issue for ${data.propertyId}: ${data.status}`);

        // Set empty state for this property to prevent retry loops
        setMessages(prev => ({
          ...prev,
          [data.propertyId]: []
        }));

        // Don't store conversation data if it failed
        setPropertyConversations(prev => {
          const updated = { ...prev };
          delete updated[data.propertyId];
          return updated;
        });
      }
    });

    newSocket.on('error', (error: any) => {
      // Rate limit error logging to prevent spam
      const now = Date.now();
      const lastErrorTime = newSocket.lastErrorTime || 0;

      if (now - lastErrorTime > 1000) { // Only log errors once per second
        console.error('❌ V2 messaging error:', error);
        newSocket.lastErrorTime = now;
      }

      // Only show critical connection errors to user
      if (error.message &&
          !error.message.includes('Failed to mark messages as read') &&
          !error.message.includes('Property conversation not found') &&
          !error.message.includes('Authentication required')) {
        addNotification({
          type: 'error',
          title: 'Messaging Error',
          message: error.message || 'Connection error',
          read: false,
        });
      }
    });

    return () => {
      newSocket.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  };

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
    };
  }, [socket]);

  // Get or create property conversation
  const getOrCreatePropertyConversation = useCallback(async (propertyId: string, timelineId: string): Promise<PropertyConversation> => {
    try {
      // Check if conversation already exists locally
      if (propertyConversations[propertyId]) {
        return propertyConversations[propertyId];
      }

      // First, try to join the property conversation via WebSocket
      if (socket && isConnected) {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Timeout waiting for property conversation'));
          }, 10000);

          // Listen for successful join response
          socket.once('property-conversation-joined', (data: { propertyId: string; conversationId: string; messages: any[] }) => {
            clearTimeout(timeout);

            if (data.propertyId === propertyId) {
              // Create conversation object
              const conversation: PropertyConversation = {
                id: data.conversationId,
                propertyId: data.propertyId,
                timelineId: timelineId,
                agentId: user?.id || '',
                clientId: '', // Will be filled by backend
                status: 'ACTIVE',
                unreadAgentCount: 0,
                unreadClientCount: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
                lastMessageAt: null,
                property: {
                  id: propertyId,
                  address: 'Property Address', // Will be filled by backend
                },
                timeline: {
                  id: timelineId,
                  title: 'Timeline Title', // Will be filled by backend
                },
                agent: {
                  id: user?.id || '',
                  email: user?.email || '',
                  profile: {
                    firstName: user?.firstName || '',
                    lastName: user?.lastName || '',
                  },
                },
                client: {
                  id: '',
                  email: '',
                  profile: {
                    firstName: '',
                    lastName: '',
                  },
                },
              };

              // Store conversation locally
              setPropertyConversations(prev => ({
                ...prev,
                [propertyId]: conversation,
              }));

              // Transform and store messages
              if (data.messages && data.messages.length > 0) {
                const transformedMessages = data.messages.map((msg: any) => ({
                  id: msg.id,
                  content: msg.content,
                  type: msg.type || 'TEXT',
                  senderId: msg.sender?.id || msg.senderId,
                  senderType: msg.sender?.type || msg.senderType,
                  createdAt: msg.createdAt,
                  isEdited: false,
                  sender: {
                    id: msg.sender?.id || msg.senderId,
                    email: msg.sender?.email || 'unknown@email.com',
                    profile: {
                      firstName: msg.sender?.name?.split(' ')[0] || 'Unknown',
                      lastName: msg.sender?.name?.split(' ').slice(1).join(' ') || 'User',
                    },
                  },
                  reads: msg.isRead ? [{ userId: user?.id || '', readAt: new Date(msg.readAt || msg.createdAt) }] : [],
                }));

                setMessages(prev => ({
                  ...prev,
                  [propertyId]: transformedMessages,
                }));
              }

              resolve(conversation);
            }
          });

          // Listen for errors
          socket.once('error', (error: any) => {
            clearTimeout(timeout);

            // Only log if not already rate limited
            const now = Date.now();
            const lastErrorTime = socket.lastErrorTime || 0;
            if (now - lastErrorTime > 1000) {
              console.error('❌ Property conversation error:', error.message);
              socket.lastErrorTime = now;
            }

            reject(new Error(error.message || 'Failed to join property conversation'));
          });

          // Emit the join request
          socket.emit('join-property-conversation', { propertyId });
        });
      } else {
        throw new Error('WebSocket not connected');
      }
    } catch (error) {
      console.error('Failed to get/create property conversation:', error);
      throw error;
    }
  }, [propertyConversations, socket, isConnected, user]);

  // Send message
  const sendMessage = useCallback(async (
    propertyId: string,
    content: string,
    messageType: MessageV2['type'] = 'TEXT'
  ) => {
    if (!socket || !isConnected) {
      throw new Error('Not connected to V2 messaging server');
    }

    // Ensure conversation exists
    const conversation = propertyConversations[propertyId];
    if (!conversation) {
      throw new Error('No conversation found for this property');
    }

    console.log(`📤 Sending message to property ${propertyId}: "${content}"`);

    // Use the user type and ID from the WebSocket server connection
    const userType = currentUserType || 'CLIENT';
    const clientId = currentUserId || 'fallback-user';

    // Debug logging for send message
    console.log('🔍 Send message debug:', {
      currentUserType,
      userType,
      currentUserId,
      clientId,
      isAuthenticated,
      hasUser: !!user,
      userId: user?.id
    });

    // Create optimistic message for immediate UI update
    const optimisticMessage: MessageV2 = {
      id: `temp-${Date.now()}`, // Temporary ID
      content,
      type: messageType,
      senderId: clientId,
      senderType: userType,
      createdAt: new Date(),
      isEdited: false,
      sender: {
        id: clientId,
        email: user?.email || 'you@example.com',
        profile: {
          firstName: userType === 'AGENT' ? (user?.firstName || 'Agent') : 'You',
          lastName: userType === 'AGENT' ? (user?.lastName || '') : '',
        },
      },
      reads: [],
    };

    // Debug the optimistic message
    console.log('🔍 Optimistic message created:', {
      id: optimisticMessage.id,
      senderType: optimisticMessage.senderType,
      senderId: optimisticMessage.senderId,
      content: optimisticMessage.content.substring(0, 20)
    });

    // Add optimistic message immediately to UI
    setMessages(prev => ({
      ...prev,
      [propertyId]: [...(prev[propertyId] || []), optimisticMessage],
    }));

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.warn('⏰ Message send timeout');
        // Remove optimistic message on timeout
        setMessages(prev => ({
          ...prev,
          [propertyId]: (prev[propertyId] || []).filter(msg => msg.id !== optimisticMessage.id),
        }));
        reject(new Error('Message send timeout'));
      }, 5000);

      const handleSuccess = (response: any) => {
        clearTimeout(timeout);
        console.log('✅ Message sent successfully', response);

        // Update the temporary message with real data from server
        if (response.messageId) {
          setMessages(prev => ({
            ...prev,
            [propertyId]: (prev[propertyId] || []).map(msg =>
              msg.id === optimisticMessage.id
                ? { ...msg, id: response.messageId } // Update with real ID
                : msg
            ),
          }));
        }

        resolve();
      };

      const handleError = (error: any) => {
        clearTimeout(timeout);
        console.error('❌ Message send error:', error);

        // Remove optimistic message on error
        setMessages(prev => ({
          ...prev,
          [propertyId]: (prev[propertyId] || []).filter(msg => msg.id !== optimisticMessage.id),
        }));

        reject(new Error(error.message || 'Failed to send message'));
      };

      // Listen for response only once
      socket.once('message-sent', handleSuccess);
      socket.once('message-error', handleError);

      // Use different message events based on user type
      if (userType === 'AGENT') {
        // Agents use conversation-based messaging
        socket.emit('send-message', {
          conversationId: conversation.id,
          content,
          type: messageType,
        });
      } else {
        // Clients use property-based messaging to avoid access issues
        socket.emit('send-property-message', {
          propertyId,
          content,
          type: messageType,
        });
      }
    });
  }, [socket, isConnected, propertyConversations, isAuthenticated, user]);

  // Mark messages as read
  const markMessagesAsRead = useCallback(async (propertyId: string) => {
    if (!socket || !isConnected) {
      console.log('🔇 Cannot mark messages as read - not connected');
      return;
    }

    const conversation = propertyConversations[propertyId];
    if (!conversation) {
      console.log('🔇 Cannot mark messages as read - no conversation found for property:', propertyId);
      return;
    }

    // Check if there are actually unread messages to mark
    const propertyMessages = messages[propertyId] || [];
    const unreadMessages = propertyMessages.filter(msg =>
      msg.senderId !== currentUserId && // Not from current user
      (!msg.reads || !msg.reads.some(read => read.userId === currentUserId)) // Not already read
    );

    if (unreadMessages.length === 0) {
      console.log('🔇 No unread messages to mark for property:', propertyId);
      return;
    }

    try {
      console.log(`📖 Marking ${unreadMessages.length} messages as read for property ${propertyId}`);

      // Use the reliable user type from the WebSocket connection context
      const userType = currentUserType || 'CLIENT';

      if (userType === 'AGENT') {
        // Agents use conversation-based read marking
        socket.emit('mark-messages-read', {
          conversationId: conversation.id,
        });
      } else {
        // Clients use property-based read marking
        socket.emit('mark-read', {
          propertyId,
        });
      }

      // Update local state optimistically
      setMessages(prev => ({
        ...prev,
        [propertyId]: (prev[propertyId] || []).map(msg => ({
          ...msg,
          reads: msg.senderId === user?.id
            ? msg.reads
            : [...(msg.reads || []), { userId: user!.id, readAt: new Date() }],
        })),
      }));

      // Clear notification count for this property
      setPropertyNotificationCounts(prev => ({
        ...prev,
        [propertyId]: 0,
      }));
    } catch (error) {
      console.error('❌ Failed to mark messages as read:', error);
    }
  }, [socket, isConnected, propertyConversations, messages, currentUserId, currentUserType]);

  // Join property conversation (load messages)
  const joinPropertyConversation = useCallback((propertyId: string) => {
    if (!socket || !isConnected) return;

    socket.emit('join-property-conversation', { propertyId });
    setActivePropertyId(propertyId);
  }, [socket, isConnected]);

  // Typing indicators
  const startTyping = useCallback((propertyId: string) => {
    if (!socket || !isConnected) return;
    const conversation = propertyConversations[propertyId];
    if (!conversation) return;

    socket.emit('typing-start', { conversationId: conversation.id });
  }, [socket, isConnected, propertyConversations]);

  const stopTyping = useCallback((propertyId: string) => {
    if (!socket || !isConnected) return;
    const conversation = propertyConversations[propertyId];
    if (!conversation) return;

    socket.emit('typing-stop', { conversationId: conversation.id });
  }, [socket, isConnected, propertyConversations]);

  // Utility functions
  const getPropertyUnreadCount = useCallback((propertyId: string) => {
    const propertyMessages = messages[propertyId] || [];
    return propertyMessages.filter(msg =>
      msg.senderId !== user?.id &&
      !msg.reads?.some(read => read.userId === user?.id)
    ).length;
  }, [messages, user]);

  const getPropertyNotificationCount = useCallback((propertyId: string) => {
    return propertyNotificationCounts[propertyId] || 0;
  }, [propertyNotificationCounts]);

  const clearPropertyNotifications = useCallback((propertyId: string) => {
    setPropertyNotificationCounts(prev => ({
      ...prev,
      [propertyId]: 0,
    }));
  }, []);

  // Auto-join active property conversation
  useEffect(() => {
    if (activePropertyId && socket && isConnected) {
      joinPropertyConversation(activePropertyId);
    }
  }, [activePropertyId, socket, isConnected, joinPropertyConversation]);

  const value: MessagingContextV2Type = {
    // Connection state
    socket,
    isConnected,
    isConnecting,
    onlineUsers,

    // Current user info
    currentUserId,
    currentUserType,

    // Property conversations
    propertyConversations,
    activePropertyId,
    setActivePropertyId,

    // Messages
    messages,
    loadingMessages,

    // Actions
    sendMessage,
    markMessagesAsRead,
    getOrCreatePropertyConversation,
    joinPropertyConversation,

    // Utilities
    getPropertyUnreadCount,
    getPropertyNotificationCount,
    clearPropertyNotifications,

    // Real-time events
    typingUsers,
    startTyping,
    stopTyping,
  };

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  );
}

export function useMessaging() {
  const context = useContext(MessagingContext);
  if (!context) {
    throw new Error('useMessaging must be used within a MessagingProvider');
  }
  return context;
}
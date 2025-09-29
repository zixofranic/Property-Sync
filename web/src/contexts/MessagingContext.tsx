'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useMissionControlStore } from '@/stores/missionControlStore';

// Extend Socket interface to include our cleanup function
declare module 'socket.io-client' {
  interface Socket {
    cleanup?: () => void;
  }
}

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
  leavePropertyConversation: (propertyId: string) => void;
  resetPropertyInitialization: (propertyId: string) => void;
  forceResetPropertyConversation: (propertyId: string) => void;

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
  const { user, isAuthenticated, isLoading } = useMissionControlStore();
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

  // EMERGENCY DUPLICATE PREVENTION: Track recently processed messages
  const [recentlyProcessedMessages, setRecentlyProcessedMessages] = useState<Set<string>>(new Set());

  // Simple tracking: prevent duplicate joins in progress
  const [joiningProperties, setJoiningProperties] = useState<Set<string>>(new Set());

  // Track joined properties to prevent duplicates - use ref to persist across re-renders
  const joinedPropertiesRef = useRef<Set<string>>(new Set());

  // Track authentication state with refs to prevent stale closures
  const currentUserIdRef = useRef<string | null>(null);
  const currentUserTypeRef = useRef<'AGENT' | 'CLIENT' | null>(null);

  // Track socket cleanup function with ref to prevent scope issues
  const socketCleanupRef = useRef<(() => void) | null>(null);

  // Transform server message format to frontend MessageV2 format
  const transformMessage = useCallback((message: any): MessageV2 => {
    return {
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
  }, [user]);

  // Initialize socket connection to V2 namespace
  useEffect(() => {
    // CRITICAL FIX: Wait for authentication state to be properly loaded before connecting
    // This prevents the connection issue after login when auth state hasn't updated yet
    const initializeConnection = async () => {
      // Check if authentication is in progress (loading state)
      if (isLoading || (!isAuthenticated && typeof window !== 'undefined' && localStorage.getItem('accessToken'))) {
        console.log('⏳ Waiting for authentication state to stabilize...', {
          isLoading,
          isAuthenticated,
          hasToken: typeof window !== 'undefined' && !!localStorage.getItem('accessToken')
        });

        // Wait a bit for auth state to update after login
        await new Promise(resolve => setTimeout(resolve, 100));

        // Re-check auth state after waiting
        if (!isAuthenticated && typeof window !== 'undefined' && localStorage.getItem('accessToken')) {
          console.log('🔄 Auth state still not updated, checking auth status...');
          // Trigger a re-check of auth status by calling the store method
          const { checkAuthStatus } = useMissionControlStore.getState();
          checkAuthStatus();
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      // CRITICAL FIX: Only clean up if we have a valid socket AND we're not just refreshing
      if (socket && !socket.connected) {
        console.log('🧹 Cleaning up disconnected socket before creating new connection');

        // CRITICAL: Remove ALL listeners before disconnecting
        console.log('📊 Existing listeners before cleanup:', {
          newMessage: socket.listeners('new-message').length,
          connected: socket.listeners('connected').length,
          propertyJoined: socket.listeners('property-conversation-joined').length
        });

        socket.removeAllListeners();
        socket.off(); // Extra safety - removes all listeners

        if (socket.cleanup) {
          socket.cleanup();
        }

        socket.disconnect();
        setSocket(null);
        setIsConnected(false);

        // IMPORTANT: Clear message event tracking to prevent stale handlers
        setRecentlyProcessedMessages(new Set());
        joinedPropertiesRef.current.clear();

        console.log('✅ Disconnected socket completely cleaned up');
      } else if (socket && socket.connected) {
        console.log('🔄 Socket already connected, skipping initialization');
        return;
      }

      console.log('🎯 Initializing new socket connection...');

      // Get current path for debugging
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;

    // CRITICAL FIX: Check for client mode FIRST before agent authentication
    const clientMode = urlParams?.get('clientMode') === 'true';

    if (clientMode) {
      console.log('🔵 CLIENT MODE DETECTED: Using client authentication path');
      // Force client authentication even if agent token exists
      const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('clientSessionToken') : null;
      const propertyId = urlParams?.get('propertyId');

      if (propertyId) {
        const effectiveToken = sessionToken || 'anonymous-client';
        console.log('✅ Taking CLIENT authentication path with propertyId:', propertyId);
        connectWithClientAuth(effectiveToken, propertyId);
        return;
      } else {
        console.log('⚠️ Client mode enabled but no propertyId found in URL params');
      }
    }

    // Check for agent authentication via localStorage (more reliable than props)
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (token) {
      console.log('🟢 Agent auth path: Found token in localStorage');
      console.log('✅ Taking AGENT authentication path');
      connectWithAgentAuth(token);
      return;
    }

    // Check if user is on agent path but has no token - redirect to login
    const isAgentPath = currentPath.includes('dashboard') ||
                        currentPath.includes('admin') ||
                        currentPath.includes('agent') ||
                        currentPath.includes('settings');

    if (isAgentPath && !clientMode) {
      console.log('🚨 Agent on dashboard with no token - redirecting to login');
      if (typeof window !== 'undefined') {
        window.location.href = '/agent/login';
      }
      return;
    }

    console.log('❌ No agent token found, checking for client auth');

    // Client authentication - check for shareTokens in URL params or client timeline paths
    const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('clientSessionToken') : null;

    // Get shareToken from URL params OR from client timeline paths
    let shareToken = urlParams?.get('shareToken') || null;

    // Extract shareToken from timeline paths OR allow client mode from agent dashboard
    if (!shareToken && currentPath) {
      // Block certain agent/admin paths that should NEVER generate shareTokens
      const isBlockedAgentPath = currentPath.includes('login') ||
                          currentPath.includes('register') ||
                          currentPath.includes('auth');

      // Allow timeline paths OR client mode from dashboard
      const allowClientConnection = (!isBlockedAgentPath && currentPath.includes('/timeline/')) ||
                                   (clientMode && currentPath.includes('dashboard'));

      if (allowClientConnection) {
        if (currentPath.includes('/timeline/') && currentPath !== '/timeline') {
          // Extract from timeline path
          const pathSegments = currentPath.split('/').filter(Boolean);
          const timelineIndex = pathSegments.indexOf('timeline');
          if (timelineIndex !== -1 && timelineIndex + 1 < pathSegments.length) {
            const potentialToken = pathSegments[timelineIndex + 1];
            // Additional validation: shareToken should look like an ID (not a common word)
            if (potentialToken.length > 10 && !['properties', 'messages', 'chat'].includes(potentialToken)) {
              shareToken = potentialToken;
              console.log('✅ Extracted shareToken from timeline path:', shareToken);
            } else {
              console.log('⚠️ Skipped invalid shareToken:', potentialToken);
            }
          }
        } else if (clientMode) {
          // Use clientMode from dashboard - get propertyId from URL params
          const propertyId = urlParams?.get('propertyId');
          if (propertyId) {
            shareToken = propertyId; // Use propertyId as shareToken for client connections
            console.log('✅ Using client mode with propertyId as shareToken:', shareToken);
          } else {
            console.log('⚠️ Client mode enabled but no propertyId found in URL params');
          }
        }
      } else {
        console.log('🚫 Blocked client connection from path:', currentPath);
      }
    }

    console.log('🔴 Client auth fallback:', { sessionToken: !!sessionToken, shareToken, currentPath, isTimelinePath: currentPath?.includes('/timeline/'), isDashboardPath: currentPath?.includes('/dashboard') });

    if (shareToken) {
      // Connect with session token if available, otherwise just with shareToken
      const effectiveToken = sessionToken || 'anonymous-client';
      console.log('🔵 Client connecting with shareToken:', {
        shareToken,
        hasSessionToken: !!sessionToken,
        effectiveToken,
        isIncognito: !sessionToken && typeof window !== 'undefined'
      });
      connectWithClientAuth(effectiveToken, shareToken);
      return;
    }

      console.log('⚪ No authentication path taken - no agent auth and no shareToken');
    };

    // Call the async initialization function
    initializeConnection();

    // Return cleanup function
    return () => {
      console.log('🧹 Cleaning up socket connection useEffect');
      if (socketCleanupRef.current) {
        socketCleanupRef.current();
      }
    };
  }, [isLoading, isAuthenticated]); // Depend on auth state to re-run when it changes

  // Agent WebSocket connection to V2 namespace
  const connectWithAgentAuth = (token: string) => {
    setIsConnecting(true);

    // Let the server authenticate and provide currentUserId/currentUserType via 'authenticated' event
    console.log('🔗 Connecting as AGENT - waiting for server authentication...');

    const newSocket = io(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3010'}/messaging-v2`, {
      auth: {
        token: token,
        userType: 'AGENT',
        timelineId: null, // Agent connections don't need specific timeline
      },
      transports: ['websocket', 'polling'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: 10, // Increased attempts
      reconnectionDelay: 500, // Faster initial reconnection
      reconnectionDelayMax: 5000,
      timeout: 20000, // Increased timeout
      forceNew: false, // Allow reusing connections when possible
      autoConnect: true,
    });

    const cleanup = setupSocketEventListeners(newSocket);
    setSocket(newSocket);

    // Store cleanup function for later use
    newSocket.cleanup = cleanup;
    socketCleanupRef.current = cleanup;
  };

  // Client WebSocket connection to V2 namespace
  const connectWithClientAuth = (sessionToken: string, shareToken: string) => {
    setIsConnecting(true);

    const newSocket = io(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3010'}/messaging-v2`, {
      auth: {
        token: sessionToken, // Use sessionToken as token for clients
        userType: 'CLIENT',
        timelineId: shareToken, // Use shareToken as timelineId for clients
      },
      transports: ['websocket', 'polling'],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: 10, // Increased attempts
      reconnectionDelay: 500, // Faster initial reconnection
      reconnectionDelayMax: 5000,
      timeout: 20000, // Increased timeout
      forceNew: false, // Allow reusing connections when possible
      autoConnect: true,
    });

    const cleanup = setupSocketEventListeners(newSocket);
    setSocket(newSocket);

    // Store cleanup function for later use
    newSocket.cleanup = cleanup;
    socketCleanupRef.current = cleanup;
  };

  // Socket event listeners for V2 system
  const setupSocketEventListeners = (newSocket: Socket) => {
    // CRITICAL: Check if listeners already exist to prevent duplicates
    const existingListeners = {
      newMessage: newSocket.listeners('new-message').length,
      connected: newSocket.listeners('connected').length,
      propertyJoined: newSocket.listeners('property-conversation-joined').length
    };

    console.log('📊 Existing listeners before setup:', existingListeners);

    if (existingListeners.newMessage > 0 || existingListeners.connected > 0) {
      console.warn('⚠️ Socket already has listeners, cleaning before registration');
      newSocket.removeAllListeners();
    }

    console.log('🎯 Registering fresh socket event listeners...');
    newSocket.on('connect', () => {
      console.log('✅ Connected to V2 messaging server');
      console.log('🔗 Socket ID:', newSocket.id);
      setIsConnected(true);
      setIsConnecting(false);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected from V2 messaging server:', reason);
      setIsConnected(false);

      // Check if this is a page refresh or navigation away
      const isPageRefresh = reason === 'transport close' || reason === 'transport error' || reason === 'io server disconnect';

      if (!isPageRefresh) {
        // Clear current user info and state only on real disconnects
        setCurrentUserId(null);
        setCurrentUserType(null);
        currentUserIdRef.current = null;
        currentUserTypeRef.current = null;
        setOnlineUsers([]);

        // Clear joined properties on disconnect to prevent stale state
        joinedPropertiesRef.current.clear();

        // Clear recently processed messages to prevent stale state
        setRecentlyProcessedMessages(new Set());
      } else {
        console.log('🔄 Page refresh detected, preserving connection state');
      }

      // Auto-reconnect on page refresh or network issues, but not on intentional disconnects
      if (isPageRefresh && reason !== 'io client disconnect') {
        console.log('🔄 Auto-reconnecting due to:', reason);
        setTimeout(() => {
          if (!newSocket.connected && newSocket.io._readyState === 'opening') {
            console.log('🔄 Attempting reconnection...');
            newSocket.connect();
          }
        }, 500); // Reduced timeout for faster reconnection
      }

      // Clean up event listeners to prevent memory leaks and duplicates
      if (reason !== 'io client disconnect' && !isPageRefresh) {
        // Only clean up if not intentionally disconnected and not a page refresh
        console.log('🧹 Cleaning up event listeners on unexpected disconnect');
        newSocket.removeAllListeners();
      }
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

      // FORCE CONNECTION STATE TO TRUE when authenticated
      setIsConnected(true);
      setIsConnecting(false);
      console.log('✅ FORCED CONNECTION STATE TO TRUE');

      // CRITICAL FIX: Set current user info immediately from server response
      if (data.userId && data.userType) {
        console.log('🔧 AUTHENTICATION COMPLETE: Setting currentUserId and currentUserType from server:', {
          userId: data.userId,
          userType: data.userType
        });

        setCurrentUserId(data.userId);
        setCurrentUserType(data.userType);
        currentUserIdRef.current = data.userId;
        currentUserTypeRef.current = data.userType;

        // IMPORTANT: Force a state update to ensure UI reflects connection
        // This addresses the stale closure issue with React state
        setTimeout(() => {
          console.log('🔄 Force re-render for connection state');
          setIsConnected(true); // Force re-render
        }, 0);

        console.log('✅ User authentication state established:', {
          userId: data.userId,
          userType: data.userType,
          canSendMessages: true,
          serverResponse: data
        });
      } else {
        console.error('❌ Server did not provide userId or userType:', data);
        // Set fallback authentication for clients to prevent blocking
        if (!isAuthenticated && !user) {
          const fallbackUserId = `anonymous_${Date.now()}`;
          console.warn('⚠️ Using fallback client authentication:', fallbackUserId);
          setCurrentUserId(fallbackUserId);
          setCurrentUserType('CLIENT');
          currentUserIdRef.current = fallbackUserId;
          currentUserTypeRef.current = 'CLIENT';
        }
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
        currentUserId: currentUserIdRef.current,
        currentUserType: currentUserTypeRef.current,
        authenticationComplete: currentUserIdRef.current !== null && currentUserTypeRef.current !== null,
        fullMessage: message
      });

      // CRITICAL FIX: Don't process INCOMING messages if authentication is not complete
      // But allow optimistic messages (temp IDs) to pass through
      const isOptimisticMessage = message.id && message.id.toString().startsWith('temp-');

      if (!isOptimisticMessage && (currentUserIdRef.current === null || currentUserTypeRef.current === null)) {
        console.warn('⚠️ Received incoming message before authentication complete, blocking:', {
          messageId: message.id,
          isOptimistic: isOptimisticMessage,
          currentUserId: currentUserIdRef.current,
          currentUserType: currentUserTypeRef.current
        });
        return;
      }

      // EMERGENCY DUPLICATE PREVENTION: Check if we recently processed this exact message
      const messageKey = `${message.id}-${message.content.substring(0, 50)}-${message.createdAt}`;
      if (recentlyProcessedMessages.has(messageKey)) {
        console.warn('🚨 BLOCKING: Recently processed message detected', {
          messageId: message.id,
          messageKey: messageKey.substring(0, 100)
        });
        return;
      }

      // Add to recently processed (keep for 30 seconds)
      setRecentlyProcessedMessages(prev => {
        const newSet = new Set(prev);
        newSet.add(messageKey);
        // Clean up old entries after 30 seconds
        setTimeout(() => {
          setRecentlyProcessedMessages(current => {
            const updated = new Set(current);
            updated.delete(messageKey);
            return updated;
          });
        }, 30000);
        return newSet;
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

        // CLAUDE OPUS SOLUTION 2: Simple ID-based deduplication (no time window needed)
        const isDuplicate = existingMessages.some(existingMsg => {
          // Exact ID match for non-temp messages (server is authoritative)
          return existingMsg.id === transformedMessage.id && !transformedMessage.id.startsWith('temp-');
        });

        // Enhanced debug duplicate detection
        console.log('🔍 DUPLICATE CHECK for message:', {
          messageId: transformedMessage.id,
          senderType: transformedMessage.senderType,
          senderId: transformedMessage.senderId,
          content: transformedMessage.content.substring(0, 30),
          currentUserId,
          currentUserType,
          isFromCurrentUser: transformedMessage.senderId === currentUserId,
          isDuplicate,
          existingCount: existingMessages.length,
          existingMessages: existingMessages.map(m => ({
            id: m.id,
            senderType: m.senderType,
            senderId: m.senderId,
            content: m.content.substring(0, 20),
            isTemp: m.id.startsWith('temp-'),
            isFromCurrentUser: m.senderId === currentUserId
          }))
        });

        if (isDuplicate) {
          console.log('🔄 Skipping duplicate message:', transformedMessage.id);
          return prev;
        }

        // ENHANCED TEMP MESSAGE REPLACEMENT: More robust matching and replacement
        let filteredMessages = existingMessages;
        if (!transformedMessage.id.startsWith('temp-')) {
          // Find and replace temp messages with same content from same sender
          const tempMessageIndex = existingMessages.findIndex(existingMsg =>
            existingMsg.id.startsWith('temp-') &&
            existingMsg.content.trim() === transformedMessage.content.trim() &&
            existingMsg.senderId === transformedMessage.senderId &&
            Math.abs(new Date(existingMsg.createdAt).getTime() - new Date(transformedMessage.createdAt).getTime()) < 15000
          );

          if (tempMessageIndex !== -1) {
            // Replace the temp message with the real message at the same position
            filteredMessages = [...existingMessages];
            filteredMessages[tempMessageIndex] = transformedMessage;
            console.log('🔄 Replaced temp message with real message:', {
              tempId: existingMessages[tempMessageIndex].id,
              realId: transformedMessage.id,
              content: transformedMessage.content.substring(0, 30)
            });

            return {
              ...prev,
              [propertyId]: filteredMessages,
            };
          } else {
            // No temp message found, just filter out any potential duplicates
            filteredMessages = existingMessages.filter(existingMsg =>
              !(existingMsg.id.startsWith('temp-') &&
                existingMsg.content.trim() === transformedMessage.content.trim() &&
                existingMsg.senderId === transformedMessage.senderId &&
                Math.abs(new Date(existingMsg.createdAt).getTime() - new Date(transformedMessage.createdAt).getTime()) < 15000)
            );
          }
        }

        return {
          ...prev,
          [propertyId]: [...filteredMessages, transformedMessage],
        };
      });

      // Update property notification count if message is not from current user
      // Use the WebSocket currentUserId instead of mission control user ID for accurate comparison
      // Also check that the message is not a temporary optimistic message to avoid duplicate notifications
      const isFromCurrentUser = transformedMessage.senderId === currentUserIdRef.current;

      // Debug notification logic
      console.log('🔔 Notification check:', {
        messageId: message.id,
        senderId: transformedMessage.senderId,
        currentUserId: currentUserIdRef.current,
        currentUserType: currentUserTypeRef.current,
        isFromCurrentUser,
        isOptimisticMessage,
        currentUserIdIsNull: currentUserIdRef.current === null,
        willShowNotification: !isFromCurrentUser && !isOptimisticMessage && currentUserIdRef.current !== null
      });

      // CRITICAL FIX: Don't show notifications if currentUserId is null (authentication not complete)
      // This prevents notifications when WebSocket connection is established but user auth is pending
      if (!isFromCurrentUser && !isOptimisticMessage && currentUserIdRef.current !== null) {
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

    // Handle property conversation joined (load messages) - ENHANCED DATABASE SYNC
    newSocket.on('property-conversation-joined', (data: {
      propertyId: string;
      conversationId: string | null;
      messages: MessageV2[];
      status: string;
    }) => {
      console.log('🔵 Property conversation joined:', data);

      // Handle different status responses
      if (data.status === 'success' && data.conversationId) {
        console.log(`✅ Property ${data.propertyId} joined successfully`);

        // Store conversation data
        setPropertyConversations(prev => ({
          ...prev,
          [data.propertyId]: {
            id: data.conversationId,
            propertyId: data.propertyId,
            lastMessageAt: new Date(),
          } as PropertyConversation
        }));

        // ENHANCED DATABASE SYNC: Perfect message deduplication using Map-based approach
        setMessages(prev => {
          const existingMessages = prev[data.propertyId] || [];
          const serverMessages = data.messages || [];

          // Create comprehensive message map using ID as key for perfect deduplication
          const messageMap = new Map<string, MessageV2>();

          // Step 1: Add existing non-temp messages (preserve local state)
          existingMessages.forEach(msg => {
            if (!msg.id.startsWith('temp-')) {
              messageMap.set(msg.id, msg);
            }
          });

          // Step 2: Add/update with server messages (server is authoritative for real messages)
          serverMessages.forEach(serverMsg => {
            const transformed = transformMessage(serverMsg);
            messageMap.set(transformed.id, transformed); // Overwrites any existing
          });

          // Step 3: Add back unconfirmed temp messages
          existingMessages.forEach(localMsg => {
            if (localMsg.id.startsWith('temp-')) {
              const hasServerEquivalent = serverMessages.some(serverMsg =>
                serverMsg.content.trim() === localMsg.content.trim() &&
                serverMsg.senderId === localMsg.senderId
              );
              if (!hasServerEquivalent) {
                messageMap.set(localMsg.id, localMsg);
                console.log('🔄 Preserving optimistic message:', {
                  tempId: localMsg.id,
                  content: localMsg.content.substring(0, 30)
                });
              }
            }
          });

          const finalMessages = Array.from(messageMap.values()).sort((a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );

          console.log('🔄 FIXED Database sync complete:', {
            propertyId: data.propertyId,
            existingCount: existingMessages.length,
            serverCount: serverMessages.length,
            finalCount: finalMessages.length,
            tempMessagesPreserved: finalMessages.filter(m => m.id.startsWith('temp-')).length,
            duplicatesPrevented: (existingMessages.length + serverMessages.length) - finalMessages.length
          });

          return {
            ...prev,
            [data.propertyId]: finalMessages
          };
        });
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

    // Return cleanup function to remove all event listeners
    return () => {
      console.log('🧹 Cleaning up socket event listeners');
      newSocket.removeAllListeners();
      newSocket.disconnect();
    };
  };

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (socket) {
        console.log('🧹 Cleaning up socket on socket change');
        // Call cleanup function if it exists to remove event listeners
        if (socket.cleanup) {
          socket.cleanup();
        } else {
          // Fallback cleanup
          socket.removeAllListeners();
          socket.disconnect();
        }
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

      // Simple check: prevent duplicate joins in progress
      if (joiningProperties.has(propertyId)) {
        console.log(`⏳ Property conversation join already in progress: ${propertyId}`);
        throw new Error(`Already joining property conversation: ${propertyId}`);
      }

      // First, try to join the property conversation via WebSocket
      if (socket && isConnected) {
        // Mark as joining
        setJoiningProperties(prev => new Set(prev).add(propertyId));

        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            // Remove from joining on timeout
            setJoiningProperties(prev => {
              const next = new Set(prev);
              next.delete(propertyId);
              return next;
            });
            reject(new Error('Timeout waiting for property conversation'));
          }, 10000);

          // Listen for successful join response
          socket.once('property-conversation-joined', (data: { propertyId: string; conversationId: string; messages: any[] }) => {
            clearTimeout(timeout);

            // Remove from joining
            setJoiningProperties(prev => {
              const next = new Set(prev);
              next.delete(propertyId);
              return next;
            });

            if (data.propertyId === propertyId) {
              // DUPLICATE CONVERSATION CREATION REMOVED - Main handler handles this
              console.log(`🗑️ Promise handler: Skipping conversation creation for ${propertyId}`);

              // DUPLICATE MESSAGE PROCESSING REMOVED - Main handler processes messages
              console.log(`🗑️ Promise handler: Skipping message processing for ${propertyId} (${data.messages?.length || 0} messages)`);

              // Return minimal object for Promise resolution
              resolve({ id: data.conversationId, propertyId: data.propertyId } as PropertyConversation);
            }
          });

          // Listen for errors
          socket.once('error', (error: any) => {
            clearTimeout(timeout);

            // Remove from joining on error
            setJoiningProperties(prev => {
              const next = new Set(prev);
              next.delete(propertyId);
              return next;
            });

            // Only log if not already rate limited
            const now = Date.now();
            const lastErrorTime = socket.lastErrorTime || 0;
            if (now - lastErrorTime > 1000) {
              console.error('❌ Property conversation error:', error.message);
              socket.lastErrorTime = now;
            }

            reject(new Error(error.message || 'Failed to join property conversation'));
          });

          // Join attempt already tracked above

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
    // Enhanced connection validation
    if (!socket) {
      throw new Error('WebSocket not initialized');
    }

    if (!isConnected || !socket.connected) {
      throw new Error('Not connected to V2 messaging server');
    }

    // CRITICAL FIX: Wait for authentication to complete before sending messages
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds maximum wait
    while ((currentUserId === null || currentUserType === null) && attempts < maxAttempts) {
      console.log(`⏳ Waiting for authentication... Attempt ${attempts + 1}/${maxAttempts}`);
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (currentUserId === null || currentUserType === null) {
      console.error('❌ Authentication timeout - cannot send message:', {
        currentUserId,
        currentUserType,
        isConnected,
        socketId: socket?.id
      });
      throw new Error('Authentication required - please wait for connection to complete');
    }

    // Ensure conversation exists
    const conversation = propertyConversations[propertyId];
    if (!conversation) {
      throw new Error('No conversation found for this property');
    }

    console.log(`📤 Sending message to property ${propertyId}: "${content}"`);

    // CRITICAL FIX: Use authenticated user state for message sending
    const userType = currentUserType;
    const senderId = currentUserId;

    // Debug logging for send message
    console.log('🔍 Send message debug:', {
      currentUserType,
      userType,
      currentUserId,
      senderId,
      isAuthenticated,
      hasUser: !!user,
      userId: user?.id,
      socketConnected: socket.connected,
      authenticationComplete: currentUserId !== null && currentUserType !== null
    });

    // Create optimistic message for immediate UI update
    const optimisticMessage: MessageV2 = {
      id: `temp-${Date.now()}`, // Temporary ID
      content,
      type: messageType,
      senderId: senderId,
      senderType: userType,
      createdAt: new Date(),
      isEdited: false,
      sender: {
        id: senderId,
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

        // OPTIMISTIC UPDATE PERSISTENCE: Update temporary message with real server data
        if (response.messageId) {
          setMessages(prev => {
            const currentMessages = prev[propertyId] || [];
            const tempMessageIndex = currentMessages.findIndex(msg => msg.id === optimisticMessage.id);

            if (tempMessageIndex !== -1) {
              // Update the temp message with real ID and ensure it persists
              const updatedMessages = [...currentMessages];
              updatedMessages[tempMessageIndex] = {
                ...updatedMessages[tempMessageIndex],
                id: response.messageId,
                createdAt: response.createdAt || updatedMessages[tempMessageIndex].createdAt // Use server timestamp if available
              };

              console.log('✅ Optimistic message updated with real ID:', {
                tempId: optimisticMessage.id,
                realId: response.messageId,
                content: optimisticMessage.content.substring(0, 30)
              });

              return {
                ...prev,
                [propertyId]: updatedMessages
              };
            }

            return prev;
          });
        }

        resolve();
      };

      const handleError = (error: any) => {
        clearTimeout(timeout);
        console.error('❌ Message send error:', {
          error: error.message || error,
          propertyId,
          userId: senderId,
          userType,
          isConnected,
          socketConnected: socket.connected,
          authenticationReady: currentUserId !== null && currentUserType !== null
        });

        // Remove optimistic message on error
        setMessages(prev => ({
          ...prev,
          [propertyId]: (prev[propertyId] || []).filter(msg => msg.id !== optimisticMessage.id),
        }));

        reject(new Error(error.message || error.error || 'Failed to send message'));
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
    if (!socket || !isConnected) {
      console.log('🔇 Cannot join property conversation - not connected');
      return;
    }

    // Check if we already have messages for this property (faster reopen)
    const hasExistingMessages = messages[propertyId] && messages[propertyId].length > 0;

    // Prevent duplicate joins for the same property
    if (joinedPropertiesRef.current.has(propertyId)) {
      console.log('🔄 Property conversation already joined, skipping duplicate:', propertyId);
      return;
    }

    console.log('🔵 Joining property conversation:', propertyId, hasExistingMessages ? '(has cached messages)' : '(will fetch messages)');

    // Always emit join to ensure we're in the socket room, but server won't duplicate messages
    socket.emit('join-property-conversation', { propertyId });
    setActivePropertyId(propertyId);

    // Track that we've joined this property
    joinedPropertiesRef.current.add(propertyId);
  }, [socket, isConnected, messages]);

  // Clear joined property (call when leaving a chat)
  const leavePropertyConversation = useCallback((propertyId: string) => {
    if (!socket) return;

    console.log('🚪 Leaving property conversation:', propertyId);

    // Emit socket event to leave the conversation
    socket.emit('leave-property-conversation', { propertyId });

    // Keep messages in memory for fast reopen (duplicates now fixed at source)

    // Clear other related state (but keep messages for fast reopen)
    joinedPropertiesRef.current.delete(propertyId);
    if (activePropertyId === propertyId) {
      setActivePropertyId(null);
    }

    // Clear notifications for this property
    setPropertyNotificationCounts(prev => ({
      ...prev,
      [propertyId]: 0,
    }));

    console.log(`🔄 Left property conversation (messages preserved): ${propertyId}`);
  }, [socket, activePropertyId]);

  // Reset property initialization state (simplified)
  const resetPropertyInitialization = useCallback((propertyId: string) => {
    console.log('🔄 Reset property initialization:', propertyId);
    // Clear any joining state
    setJoiningProperties(prev => {
      const next = new Set(prev);
      next.delete(propertyId);
      return next;
    });
  }, []);

  // Simple reset - clear joining state and conversation
  const forceResetPropertyConversation = useCallback((propertyId: string) => {
    console.log('💥 RESET: Clearing state for property:', propertyId);

    // Clear simple tracking
    setJoiningProperties(prev => {
      const next = new Set(prev);
      next.delete(propertyId);
      return next;
    });

    // Clear conversation data
    setPropertyConversations(prev => {
      const next = { ...prev };
      delete next[propertyId];
      return next;
    });

    // Clear messages
    setMessages(prev => {
      const next = { ...prev };
      delete next[propertyId];
      return next;
    });
  }, []);

  // Typing indicators - Fixed to use propertyId
  const startTyping = useCallback((propertyId: string) => {
    if (!socket || !isConnected) return;
    const conversation = propertyConversations[propertyId];
    if (!conversation) return;

    // Use propertyId for typing events to match server expectations
    socket.emit('typing-start', { propertyId });
  }, [socket, isConnected, propertyConversations]);

  const stopTyping = useCallback((propertyId: string) => {
    if (!socket || !isConnected) return;
    const conversation = propertyConversations[propertyId];
    if (!conversation) return;

    // Use propertyId for typing events to match server expectations
    socket.emit('typing-stop', { propertyId });
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

  // Auto-join removed - components should handle joining explicitly to prevent duplicates

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
    leavePropertyConversation,
    resetPropertyInitialization,
    forceResetPropertyConversation,

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
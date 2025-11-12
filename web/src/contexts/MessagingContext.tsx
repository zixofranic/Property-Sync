'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { useMissionControlStore } from '@/stores/missionControlStore';
import { useBadgePersistenceStore } from '@/stores/badgePersistenceStore';
import { useUnifiedBadges } from './UnifiedBadgeContext'; // P2-7: Unified badge system integration

// Extend Socket interface to include our cleanup function
declare module 'socket.io-client' {
  interface Socket {
    cleanup?: () => void;
  }
}

// TASK 8: Connection state machine for lifecycle management with AUTHENTICATING state
enum ConnectionState {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  AUTHENTICATING = 'AUTHENTICATING', // TASK 8: New state between CONNECTING and CONNECTED
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  DISCONNECTED = 'DISCONNECTED',
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

  // TASK 3: Hierarchical unread count methods (Agent-only)
  getTotalUnreadCount: () => number;
  getClientUnreadCount: (clientId: string) => number;
  fetchHierarchicalUnreadCounts: () => Promise<void>;

  // PHASE 2: Client badge methods (Client-only)
  clientUnreadCounts: Record<string, number>; // propertyId -> unread count
  fetchClientUnreadCounts: () => Promise<void>;
  getClientPropertyUnreadCount: (propertyId: string) => number;

  // Real-time events
  typingUsers: Record<string, string[]>; // propertyId -> userIds
  startTyping: (propertyId: string) => void;
  stopTyping: (propertyId: string) => void;
}

const MessagingContext = createContext<MessagingContextV2Type | null>(null);

export function MessagingProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useMissionControlStore();
  const { addNotification } = useMissionControlStore();

  // P2-7: Integrate with unified badge system
  const unifiedBadges = useUnifiedBadges();

  // Connection state with state machine
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.IDLE);
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

  // TASK 3: Hierarchical unread counts state (Agent-only)
  const [hierarchicalUnreadCounts, setHierarchicalUnreadCounts] = useState<{
    totalUnread: number;
    clients: Array<{
      clientId: string;
      clientName: string;
      unreadCount: number;
      properties: Array<{
        propertyId: string;
        address: string;
        unreadCount: number;
      }>;
    }>;
  } | null>(null);

  // P2-6 FIX: Flattened badge state for O(1) lookups
  const [flatBadgeState, setFlatBadgeState] = useState<{
    totalUnread: number;
    byClient: Record<string, number>; // clientId -> unreadCount
    byProperty: Record<string, { count: number; clientId: string; address: string }>; // propertyId -> { count, clientId, address }
    clientNames: Record<string, string>; // clientId -> clientName
  }>({
    totalUnread: 0,
    byClient: {},
    byProperty: {},
    clientNames: {},
  });

  // PHASE 2: Client unread counts state (Client-only)
  const [clientUnreadCounts, setClientUnreadCounts] = useState<Record<string, number>>({});

  // Badge data loading state
  const [badgeDataLoading, setBadgeDataLoading] = useState<boolean>(false);

  // TASK 8: Optimized message deduplication cache (Map with timestamps, max 100 entries, 10s timeout)
  const [recentlyProcessedMessages, setRecentlyProcessedMessages] = useState<Map<string, number>>(new Map());
  const MAX_PROCESSED_MESSAGES = 100;
  const PROCESSED_MESSAGE_TIMEOUT = 10000; // 10 seconds

  // TASK 10: Property conversation state management with lifecycle tracking
  type PropertyState = 'joining' | 'joined' | 'error';
  const [propertyStates, setPropertyStates] = useState<Map<string, PropertyState>>(new Map());

  // Track joined properties to prevent duplicates - use ref to persist across re-renders
  const joinedPropertiesRef = useRef<Set<string>>(new Set());

  // ISSUE 7 FIX: Store property IDs before disconnect for reconnection restoration
  const propertyIdsBeforeDisconnectRef = useRef<Set<string>>(new Set());

  // TASK 3: Authentication refs removed - using state variables instead

  // TASK 2: socketCleanupRef removed - cleanup stored on socket instance

  // TASK 3: Authentication promise to block message processing until auth completes
  const authenticationPromiseRef = useRef<Promise<void> | null>(null);
  const authenticationResolveRef = useRef<(() => void) | null>(null);

  // TASK 1 & 2: Message queue for pre-authentication messages
  const messageQueueRef = useRef<any[]>([]);

  // Auth state refs to avoid stale closures in event handlers
  const currentUserIdRef = useRef<string | null>(null);
  const currentUserTypeRef = useRef<'AGENT' | 'CLIENT' | null>(null);

  // Connection management refs
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectionAttempts = useRef<number>(0);
  const backoffIndex = useRef<number>(0);
  const reconnectionInFlightRef = useRef<boolean>(false);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const MAX_CONNECTION_ATTEMPTS = 10;
  const BACKOFF_DELAYS = [1000, 2000, 5000, 10000, 30000]; // Exponential backoff delays

  // P1-5 FIX: AbortController for request deduplication
  const fetchAbortControllerRef = useRef<AbortController | null>(null);

  // TASK 1 & 2: Auth state initialization tracking
  const [authStateChecked, setAuthStateChecked] = useState(false);
  const authInitializedRef = useRef(false);

  // TASK 3: Waiting for auth flag
  const waitingForAuthRef = useRef(false);

  // TASK 6: Token availability monitor refs
  const tokenMonitorIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const tokenCheckAttemptsRef = useRef<number>(0);

  // TASK 7: Health check optimization refs
  const healthCheckFailures = useRef<number>(0);
  const MAX_HEALTH_CHECK_FAILURES = 3;

  // TASK 3: Pong timeout management ref
  const pongTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastPingTimeRef = useRef<number>(0);

  // TASK 9: Connection backoff strategy enhancement
  type FailureReason = 'network' | 'auth' | 'server';
  const lastFailureReason = useRef<FailureReason>('network');
  const stableConnectionTime = useRef<number>(0);

  // TASK 4: Share token persistence for client reconnection
  const shareTokenRef = useRef<string | null>(null);
  const sessionTokenRef = useRef<string | null>(null);

  // TASK 9: Session token timestamp tracking
  const sessionTokenTimestampRef = useRef<number | null>(null);
  const SESSION_TOKEN_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

  // Helper to synchronize auth state and refs atomically
  const updateAuthState = useCallback((userId: string | null, userType: 'AGENT' | 'CLIENT' | null) => {
    setCurrentUserId(userId);
    setCurrentUserType(userType);
    currentUserIdRef.current = userId;
    currentUserTypeRef.current = userType;
    console.log(`🔐 Auth state updated: userId=${userId}, userType=${userType}`);
  }, []);

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

  // TASK 9 & 10: Calculate backoff delay based on failure reason with mobile detection
  const calculateBackoffDelay = useCallback((reason: FailureReason, attemptIndex: number): number => {
    // TASK 10: Detect mobile clients
    const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isClient = currentUserType === 'CLIENT' || shareTokenRef.current !== null;

    let baseDelay: number;

    // TASK 10: Mobile-specific strategy - faster initial retries
    if (isMobile && isClient) {
      switch (reason) {
        case 'network':
          // Mobile strategy: 500ms initial, faster retries, max 15s (not 30s)
          baseDelay = Math.min(500 * Math.pow(1.5, attemptIndex), 15000);
          break;
        case 'auth':
          // Mobile auth: 3s (faster than desktop)
          baseDelay = 3000;
          break;
        case 'server':
          // Mobile server: 5-15s range
          baseDelay = Math.min(5000 + (attemptIndex * 1000), 15000);
          break;
        default:
          baseDelay = 3000;
      }
      console.log(`📱 TASK 10: Mobile client reconnection strategy (${reason})`);
    } else {
      // Desktop/agent strategy (original)
      switch (reason) {
        case 'network':
          // Exponential starting at 1s
          baseDelay = Math.min(1000 * Math.pow(2, attemptIndex), 30000);
          break;
        case 'auth':
          // Fixed 5s
          baseDelay = 5000;
          break;
        case 'server':
          // 10-30s range based on attempt
          baseDelay = Math.min(10000 + (attemptIndex * 2000), 30000);
          break;
        default:
          baseDelay = 5000;
      }
    }

    // Add ±20% jitter
    const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
    const finalDelay = Math.max(500, baseDelay + jitter); // TASK 10: Min 500ms for mobile

    return Math.floor(finalDelay);
  }, [currentUserType]);

  // Central reconnection handler with enhanced backoff (TASK 1, 9 & 10)
  const handleReconnection = useCallback((reason: FailureReason = 'network') => {
    // Prevent multiple simultaneous reconnection attempts
    if (reconnectionInFlightRef.current) {
      console.log('🔄 Reconnection already in flight, skipping');
      return;
    }

    // TASK 10: Mobile clients get 15 attempts instead of 10
    const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isClient = currentUserType === 'CLIENT' || shareTokenRef.current !== null;
    const maxAttempts = (isMobile && isClient) ? 15 : MAX_CONNECTION_ATTEMPTS;

    if (connectionAttempts.current >= maxAttempts) {
      console.error(`❌ TASK 10: Max reconnection attempts reached (${maxAttempts})`);
      setConnectionState(ConnectionState.DISCONNECTED);
      return;
    }

    reconnectionInFlightRef.current = true;
    setConnectionState(ConnectionState.RECONNECTING);

    // TASK 9 & 10: Track failure reason and calculate appropriate backoff
    lastFailureReason.current = reason;
    const delay = calculateBackoffDelay(reason, backoffIndex.current);

    console.log(`🔄 TASK 10: Scheduling reconnection in ${delay}ms (attempt ${connectionAttempts.current + 1}/${maxAttempts}, reason: ${reason}, mobile: ${isMobile && isClient})`);
    backoffIndex.current++;

    setTimeout(() => {
      reconnectionInFlightRef.current = false;

      // TASK 4: Check if we have stored client tokens for reconnection
      if (shareTokenRef.current && sessionTokenRef.current) {
        console.log('✅ TASK 4: Reconnecting with stored client tokens:', {
          shareToken: shareTokenRef.current.substring(0, 10) + '...',
          hasSessionToken: !!sessionTokenRef.current
        });
        connectionAttempts.current++;
        setConnectionState(ConnectionState.CONNECTING);
        connectWithClientAuth(sessionTokenRef.current, shareTokenRef.current);
      } else {
        debouncedConnect();
      }
    }, delay);
  }, [calculateBackoffDelay]);


  // Debounced connection manager to prevent race conditions (TASK 1: respects state machine)
  const debouncedConnect = useCallback(() => {
    // Clear any pending connection attempts
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }

    // Respect state machine: don't connect if already connecting or connected
    if (connectionState === ConnectionState.CONNECTING || connectionState === ConnectionState.CONNECTED) {
      console.log('🔄 Connection already active, skipping', { connectionState });
      return;
    }

    // Check connection attempt limits
    if (connectionAttempts.current >= MAX_CONNECTION_ATTEMPTS) {
      console.error('❌ Max connection attempts reached. Please refresh the page.');
      setConnectionState(ConnectionState.DISCONNECTED);
      return;
    }

    // Debounce connection attempts by 300ms
    connectionTimeoutRef.current = setTimeout(() => {
      // Double-check state before attempting connection
      if (socket?.connected || connectionState === ConnectionState.CONNECTED) {
        console.log('🔄 Connection already active, skipping');
        return;
      }

      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const clientMode = urlParams?.get('clientMode') === 'true';

      console.log(`🔄 Debounced connection attempt ${connectionAttempts.current + 1}/${MAX_CONNECTION_ATTEMPTS}`);

      // Priority 1: Client mode with propertyId
      if (clientMode) {
        const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('clientSessionToken') : null;
        const propertyId = urlParams?.get('propertyId');

        if (propertyId) {
          const effectiveToken = sessionToken || 'anonymous-client';
          console.log('✅ CLIENT MODE: Connecting with propertyId');
          connectionAttempts.current++;
          setConnectionState(ConnectionState.CONNECTING);
          connectWithClientAuth(effectiveToken, propertyId);
          return;
        }
      }

      // Priority 2: Timeline paths (force client auth)
      if (currentPath && currentPath.includes('/timeline/') && currentPath !== '/timeline') {
        const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('clientSessionToken') : null;
        const pathSegments = currentPath.split('/').filter(Boolean);
        const timelineIndex = pathSegments.indexOf('timeline');

        if (timelineIndex !== -1 && timelineIndex + 1 < pathSegments.length) {
          const shareToken = pathSegments[timelineIndex + 1];
          if (shareToken.length > 10 && !['properties', 'messages', 'chat'].includes(shareToken)) {
            const effectiveToken = sessionToken || 'anonymous-client';
            console.log('✅ TIMELINE PATH: Connecting with shareToken');
            connectionAttempts.current++;
            setConnectionState(ConnectionState.CONNECTING);
            connectWithClientAuth(effectiveToken, shareToken);
            return;
          }
        }
      }

      // Priority 3: Agent authentication
      if (token) {
        console.log('✅ AGENT MODE: Connecting with token');
        connectionAttempts.current++;
        setConnectionState(ConnectionState.CONNECTING);
        connectWithAgentAuth(token);
        return;
      }

      // TASK 3 & 5: No authentication available - set waiting flag but keep state as IDLE
      console.log('⚪ No authentication available for connection - waiting for auth');
      waitingForAuthRef.current = true;
    }, 300); // 300ms debounce
  }, [socket, connectionState]);

  // Initialize socket connection to V2 namespace
  useEffect(() => {
    console.log('🚀 Socket initialization triggered on mount');

    // Cleanup any disconnected socket
    if (socket && !socket.connected) {
      console.log('🧹 Cleaning up disconnected socket');
      socket.removeAllListeners();
      if (socket.cleanup) socket.cleanup();
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
      setRecentlyProcessedMessages(new Map()); // TASK 8: Clear Map
      joinedPropertiesRef.current.clear();
    }

    // TASK 1 & 2: Only connect after auth state is checked
    if (authStateChecked) {
      console.log('✅ Auth state checked - initiating connection');
      debouncedConnect();
    } else {
      console.log('⏳ Waiting for auth state to be checked before connecting');
    }

    // Return cleanup function (TASK 2: socketCleanupRef removed)
    return () => {
      console.log('🧹 Cleaning up socket initialization');
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
      if (tokenMonitorIntervalRef.current) {
        clearInterval(tokenMonitorIntervalRef.current);
      }
      if (socket?.cleanup) {
        socket.cleanup();
      }
    };
  }, [authStateChecked]); // Run when authStateChecked changes

  // TASK 2 & 4: Watch for authentication changes and set initialization flag
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

    // TASK 2: Mark auth as initialized on first run
    if (!authInitializedRef.current) {
      console.log('🔐 Auth watching effect - first run, marking as initialized');
      authInitializedRef.current = true;
      setAuthStateChecked(true);

      // TASK 4: If token exists but socket isn't connected, trigger connection
      if (token && (!socket || !socket.connected)) {
        console.log('🔄 Auth initialized with token - triggering connection');
        debouncedConnect();
      }
    }

    // TASK 3: If we were waiting for auth and now have it, trigger connection
    if (waitingForAuthRef.current && token && (!socket || !socket.connected)) {
      console.log('🔄 Auth became available - triggering delayed connection');
      waitingForAuthRef.current = false;
      debouncedConnect();
    }

    // Only attempt reconnection if:
    // 1. We have a token
    // 2. We don't have a connected socket
    // 3. User is authenticated
    if (token && !socket?.connected && isAuthenticated && user) {
      console.log('🔄 Auth state changed - attempting reconnection');
      debouncedConnect();
    }
  }, [isAuthenticated, user, socket?.connected, debouncedConnect]);

  // TASK 1: Token polling removed - connection managed by state machine and health checks

  // TASK 6 & 7: Optimized health check system with client portal compatibility
  useEffect(() => {
    if (!socket || !socket.connected) {
      return;
    }

    // Detect if mobile device
    const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const healthCheckInterval = isMobile ? 60000 : 30000; // 60s for mobile, 30s for desktop

    // TASK 6: Check if this is a client connection
    const isClientConnection = currentUserType === 'CLIENT' || shareTokenRef.current !== null;

    // TASK 6: Adjust failure threshold for clients (mobile networks are less stable)
    const maxFailures = isClientConnection ? 5 : 3;

    console.log(`🏥 TASK 6: Starting health check system (${healthCheckInterval / 1000}s interval, mobile: ${isMobile}, client: ${isClientConnection}, maxFailures: ${maxFailures})`);

    const healthCheck = () => {
      if (socket.connected && connectionState === ConnectionState.CONNECTED) {
        const pingTime = Date.now();
        lastPingTimeRef.current = pingTime; // TASK 4: Store ping time for RTT calculation
        console.log(`🏥 TASK 6: Sending ping to server at ${new Date(pingTime).toISOString()}`);
        console.log(`   Socket state: ${socket.connected ? 'connected' : 'disconnected'}, ID: ${socket.id}`);
        console.log(`   Current failure count: ${healthCheckFailures.current}/${maxFailures}`);
        console.log(`   Client connection: ${isClientConnection}`);
        socket.emit('ping');

        // TASK 3: Store timeout in ref for persistent pong listener to clear
        pongTimeoutRef.current = setTimeout(() => {
          healthCheckFailures.current++;
          const timeoutTime = Date.now();
          console.warn(`⚠️ TASK 6: Socket health check failed - no pong received after 15s (${healthCheckFailures.current}/${maxFailures})`);
          console.warn(`   Ping sent at: ${new Date(pingTime).toISOString()}, Timeout at: ${new Date(timeoutTime).toISOString()}`);
          console.warn(`   Socket state at timeout: ${socket.connected ? 'connected' : 'disconnected'}, ID: ${socket.id}`);
          console.warn(`   Client connection: ${isClientConnection}`);

          // Clear the ref since timeout fired
          pongTimeoutRef.current = null;

          // TASK 6 & 7: Disconnect after max failures (higher threshold for clients)
          if (healthCheckFailures.current >= maxFailures) {
            console.error(`❌ TASK 6: Max health check failures reached (${maxFailures}) - disconnecting`);
            socket.disconnect();
            setIsConnected(false);
            setConnectionState(ConnectionState.DISCONNECTED);
            healthCheckFailures.current = 0;

            // TASK 6 & 9: Use central reconnection handler with network failure reason
            // Exponential backoff will be applied automatically
            handleReconnection('network');
          }
        }, 15000); // TASK 7: 15 second timeout for pong response

        console.log(`⏱️ TASK 6: Pong timeout set - expecting response within 15s`);
      }
    };

    // Run health check at calculated interval
    healthCheckIntervalRef.current = setInterval(healthCheck, healthCheckInterval);

    // Initial health check
    healthCheck();

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up health check system');
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
        healthCheckIntervalRef.current = null;
      }
    };
  }, [socket, socket?.connected, connectionState, handleReconnection]);

  // Listen for localStorage changes (cross-tab token updates or login events)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Only react to accessToken changes
      if (e.key === 'accessToken') {
        console.log('🔄 Storage event: accessToken changed', {
          oldValue: !!e.oldValue,
          newValue: !!e.newValue,
          currentlyConnected: socket?.connected
        });

        if (e.newValue && !socket?.connected) {
          // Token was added/updated and we're not connected
          console.log('🔄 Token added - triggering reconnection');
          debouncedConnect();
        } else if (!e.newValue && socket?.connected) {
          // Token was removed - disconnect
          console.log('🔄 Token removed - disconnecting socket');
          socket.disconnect();
          setIsConnected(false);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [socket?.connected, debouncedConnect]);

  // TASK 6: Token availability monitor
  useEffect(() => {
    // Only run if socket is null or disconnected
    if (socket?.connected) {
      return;
    }

    console.log('🔍 Starting token availability monitor');
    tokenCheckAttemptsRef.current = 0;

    const checkInterval = setInterval(() => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      tokenCheckAttemptsRef.current++;

      if (token) {
        console.log('✅ Token found by monitor - triggering connection');
        clearInterval(checkInterval);
        debouncedConnect();
      } else if (tokenCheckAttemptsRef.current >= 10) {
        console.log('⏰ Token monitor timeout - max attempts reached');
        clearInterval(checkInterval);
      }
    }, 500);

    tokenMonitorIntervalRef.current = checkInterval;

    return () => {
      if (tokenMonitorIntervalRef.current) {
        clearInterval(tokenMonitorIntervalRef.current);
        tokenMonitorIntervalRef.current = null;
      }
    };
  }, [socket?.connected, debouncedConnect]);

  // TASK 8: Listen for auth:ready custom event
  useEffect(() => {
    const handleAuthReady = (event: CustomEvent) => {
      console.log('🔐 Auth ready event received:', event.detail);

      if (event.detail.authenticated && !socket?.connected) {
        console.log('✅ Auth ready with authentication - triggering connection');
        debouncedConnect();
      }
    };

    window.addEventListener('auth:ready', handleAuthReady as EventListener);

    return () => {
      window.removeEventListener('auth:ready', handleAuthReady as EventListener);
    };
  }, [socket?.connected, debouncedConnect]);

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
      // CRITICAL: Railway WebSocket fixes
      transports: ['polling', 'websocket'], // Start with polling, upgrade to websocket
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: 5, // Reduced for faster fallback
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true, // Force new connection for Railway
      autoConnect: true,

      // Railway-specific settings
      path: '/socket.io/', // Explicit path
      secure: typeof window !== 'undefined' && window.location.protocol === 'https:', // Force secure in production
      rejectUnauthorized: false, // Allow self-signed certs temporarily
    });

    const cleanup = setupSocketEventListeners(newSocket);
    setSocket(newSocket);

    // TASK 2: Cleanup function stored on socket instance via Object.defineProperty
  };

  // Client WebSocket connection to V2 namespace
  const connectWithClientAuth = (sessionToken: string, shareToken: string) => {
    setIsConnecting(true);

    // TASK 9: Validate session token age
    const now = Date.now();
    if (sessionTokenTimestampRef.current) {
      const tokenAge = now - sessionTokenTimestampRef.current;
      if (tokenAge > SESSION_TOKEN_MAX_AGE) {
        console.warn('⚠️ TASK 9: Session token expired (age: ${tokenAge}ms), clearing tokens');
        // Clear expired token
        if (typeof window !== 'undefined') {
          localStorage.removeItem('clientSessionToken');
        }
        sessionTokenRef.current = null;
        sessionTokenTimestampRef.current = null;
        // Use anonymous token for fresh session
        sessionToken = 'anonymous-client';
      } else {
        console.log('✅ TASK 9: Session token valid (age: ${tokenAge}ms)');
      }
    } else {
      // First time storing token, record timestamp
      sessionTokenTimestampRef.current = now;
      console.log('✅ TASK 9: Session token timestamp recorded:', new Date(now).toISOString());
    }

    // TASK 4: Store tokens for reconnection
    shareTokenRef.current = shareToken;
    sessionTokenRef.current = sessionToken;
    console.log('✅ TASK 4 & 9: Stored client tokens for reconnection:', {
      shareToken: shareToken.substring(0, 10) + '...',
      hasSessionToken: !!sessionToken,
      tokenTimestamp: sessionTokenTimestampRef.current ? new Date(sessionTokenTimestampRef.current).toISOString() : 'new'
    });

    const newSocket = io(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3010'}/messaging-v2`, {
      auth: {
        token: sessionToken, // Use sessionToken as token for clients
        userType: 'CLIENT',
        timelineId: shareToken, // Use shareToken as timelineId for clients
      },
      // CRITICAL: Railway WebSocket fixes
      transports: ['polling', 'websocket'], // Start with polling, upgrade to websocket
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: 5, // Reduced for faster fallback
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: true, // Force new connection for Railway
      autoConnect: true,

      // Railway-specific settings
      path: '/socket.io/', // Explicit path
      secure: typeof window !== 'undefined' && window.location.protocol === 'https:', // Force secure in production
      rejectUnauthorized: false, // Allow self-signed certs temporarily
    });

    const cleanup = setupSocketEventListeners(newSocket);
    setSocket(newSocket);

    // TASK 2: Cleanup function stored on socket instance via Object.defineProperty
  };

  // Helper function to clear all listeners (TASK 2)
  const clearAllListeners = useCallback((socket: Socket) => {
    console.log('🧹 Clearing all socket event listeners');

    // Execute stored cleanup function if it exists
    if (socket.cleanup) {
      socket.cleanup();
    }

    // Remove all listeners as fallback
    socket.removeAllListeners();
  }, []);

  // Socket event listeners for V2 system (TASK 2: improved cleanup, TASK 3: auth promise)
  const setupSocketEventListeners = useCallback((newSocket: Socket) => {
    // Defensive ref initialization check
    if (typeof currentUserIdRef === 'undefined' || typeof currentUserTypeRef === 'undefined') {
      console.error('❌ CRITICAL: Auth state refs not initialized. Cannot setup event listeners.');
      return () => {}; // Return empty cleanup function
    }

    // TASK 2: Clear all existing listeners at start
    clearAllListeners(newSocket);

    // TASK 3 & 7: Create authentication promise that resolves on 'connected' event
    const authPromiseTimestamp = Date.now();
    authenticationPromiseRef.current = new Promise<void>((resolve) => {
      authenticationResolveRef.current = resolve;
    });

    console.log('📊 TASK 7: Setting up fresh event listeners');
    console.log('🔐 TASK 7: Authentication promise created at:', new Date(authPromiseTimestamp).toISOString());
    console.log('⏳ TASK 7: Messages will be queued until authentication completes');

    console.log('🎯 Registering fresh socket event listeners...');
    newSocket.on('connect', () => {
      console.log('✅ Connected to V2 messaging server');
      console.log('🔗 Socket ID:', newSocket.id);

      // TASK 8: Transition to AUTHENTICATING state (not CONNECTED yet)
      console.log('🔐 TASK 8: Transitioning to AUTHENTICATING state');
      setConnectionState(ConnectionState.AUTHENTICATING);
      setIsConnecting(false);
      // Don't set isConnected=true yet, wait for 'connected' event with auth data

      // TASK 9: Track stable connection time
      stableConnectionTime.current = Date.now();

      // Reset connection management on successful connection
      connectionAttempts.current = 0;
      reconnectionInFlightRef.current = false;

      // TASK 9: Only reset backoff after 60s of stable connection
      setTimeout(() => {
        const connectionDuration = Date.now() - stableConnectionTime.current;
        if (connectionDuration >= 60000) {
          backoffIndex.current = 0;
          console.log('✅ 60s stable connection reached - backoff reset');
        }
      }, 60000);

      console.log('🔄 Connection attempts reset');
    });

    // TASK 2: Persistent pong listener for health checks
    newSocket.on('pong', () => {
      const now = Date.now();
      const roundTripTime = lastPingTimeRef.current > 0 ? now - lastPingTimeRef.current : 0;

      console.log(`✅ Pong received at ${new Date(now).toISOString()}`);
      console.log(`   Round-trip time: ${roundTripTime}ms`);
      console.log(`   Socket state: ${newSocket.connected ? 'connected' : 'disconnected'}, ID: ${newSocket.id}`);

      // TASK 3: Clear timeout if it exists
      if (pongTimeoutRef.current) {
        clearTimeout(pongTimeoutRef.current);
        pongTimeoutRef.current = null;
        console.log(`🧹 Cleared pong timeout (RTT: ${roundTripTime}ms)`);
      }

      // TASK 4: Reset failure counter and backoff on successful pong
      healthCheckFailures.current = 0;
      backoffIndex.current = 0;
      console.log(`✅ Health check successful - failure counter reset (RTT: ${roundTripTime}ms)`);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected from V2 messaging server:', reason);
      setIsConnected(false);
      setConnectionState(ConnectionState.DISCONNECTED);

      // Check if this is a page refresh or navigation away
      const isPageRefresh = reason === 'transport close' || reason === 'transport error' || reason === 'io server disconnect';
      const isIntentionalDisconnect = reason === 'io client disconnect';

      if (!isPageRefresh) {
        // Clear current user info and state only on real disconnects (TASK 3: using state only)
        updateAuthState(null, null);
        setOnlineUsers([]);

        // ISSUE 7 FIX: Store joined properties before clearing for reconnection
        propertyIdsBeforeDisconnectRef.current = new Set(joinedPropertiesRef.current);
        console.log('💾 ISSUE 7: Stored property IDs before disconnect:', Array.from(propertyIdsBeforeDisconnectRef.current));

        // Clear joined properties on disconnect to prevent stale state
        joinedPropertiesRef.current.clear();

        // TASK 8: Clear recently processed messages Map
        setRecentlyProcessedMessages(new Map());

        // P2-8 FIX: Invalidate badge cache on disconnect
        const { clearCache } = useBadgePersistenceStore.getState();
        clearCache();
        console.log('🗑️ P2-8: Badge cache cleared on disconnect');
      } else {
        console.log('🔄 Page refresh detected, preserving connection state');
      }

      // TASK 9: Auto-reconnect using central handler with failure reason
      if (!isIntentionalDisconnect) {
        // Determine failure reason from disconnect reason
        const failureReason: FailureReason =
          reason === 'io server disconnect' ? 'server' :
          reason === 'transport error' ? 'network' :
          'network';
        handleReconnection(failureReason);
      }

      // Clean up event listeners to prevent memory leaks and duplicates
      if (!isIntentionalDisconnect && !isPageRefresh) {
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
      setConnectionState(ConnectionState.DISCONNECTED);

      // TASK 9: Determine failure reason from error type
      const failureReason: FailureReason =
        error.message?.includes('auth') || error.message?.includes('Authentication') ? 'auth' :
        error.type === 'TransportError' ? 'network' :
        'network';

      handleReconnection(failureReason);
    });

    newSocket.on('connected', (data) => {
      const connectedTimestamp = Date.now();
      console.log('🔐 TASK 7: V2 messaging initialized at:', new Date(connectedTimestamp).toISOString());
      console.log('🔍 TASK 7: Server user detection:', {
        serverUserId: data.userId,
        serverUserType: data.userType,
        localIsAuthenticated: isAuthenticated,
        localUser: user?.id,
        expectedType: isAuthenticated && user ? 'AGENT' : 'CLIENT',
        queuedMessagesCount: messageQueueRef.current.length
      });
      setOnlineUsers(data.onlineUsers || []);

      // TASK 8: Transition from AUTHENTICATING to CONNECTED state
      setIsConnected(true);
      setIsConnecting(false);
      setConnectionState(ConnectionState.CONNECTED); // TASK 8: Now fully authenticated and connected
      console.log('✅ TASK 7 & 8: State transitioned to CONNECTED');

      // TASK 1 & 3: Enhanced client authentication detection
      // Check if userId pattern indicates client connection
      const isClientUserId = data.userId && (
        data.userId.startsWith('client_') ||
        data.userId.startsWith('anonymous_') ||
        (typeof window !== 'undefined' && window.location.pathname.includes('/timeline/'))
      );

      // TASK 1: Determine user type with client detection
      let detectedUserType = data.userType;
      if (!detectedUserType && isClientUserId) {
        detectedUserType = 'CLIENT';
        console.log('✅ TASK 1: Detected CLIENT userType from userId pattern:', data.userId);
      }

      // TASK 3 & 7: Set current user info immediately from server response
      if (data.userId && detectedUserType) {
        const authStartTimestamp = Date.now();
        console.log('🔧 TASK 1 & 7: AUTHENTICATION COMPLETE at:', new Date(authStartTimestamp).toISOString());
        console.log('🔧 TASK 1 & 7: Setting currentUserId and currentUserType from server:', {
          userId: data.userId,
          userType: detectedUserType,
          isClientDetected: isClientUserId,
          queuedMessages: messageQueueRef.current.length,
          timeSincePromiseCreated: `${authStartTimestamp - connectedTimestamp}ms`,
          connectionState: 'CONNECTED' // TASK 8
        });

        updateAuthState(data.userId, detectedUserType);

        // Store queue length before processing for later logging
        const processedQueueLength = messageQueueRef.current.length;

        // Add microtask delay to ensure refs are updated before processing queue
        Promise.resolve().then(() => {
          // TASK 5 & 7: Validate authentication state before processing queue
          console.log(`📦 TASK 5 & 7: Validating auth state before queue processing at:`, new Date().toISOString());
          console.log(`   userId: ${data.userId}, userType: ${detectedUserType}`);
          console.log(`   Queue size: ${messageQueueRef.current.length}`);

          // TASK 5: Additional validation for client messages
          if (detectedUserType === 'CLIENT') {
            console.log(`✅ TASK 5: Client authentication confirmed - processing queue`);
          }

          // TASK 3 & 7: Process queued messages BEFORE resolving authentication promise
          console.log(`📦 TASK 5 & 7: Processing ${messageQueueRef.current.length} queued messages at:`, new Date().toISOString());
          const queuedMessages = [...messageQueueRef.current];
          messageQueueRef.current = []; // Clear queue

          // Process each queued message through the normal handler
          queuedMessages.forEach((queuedMessage, index) => {
            console.log(`📨 TASK 5 & 7: Processing queued message ${index + 1}/${queuedMessages.length}:`, {
              messageId: queuedMessage.id,
              content: queuedMessage.content?.substring(0, 30),
              timestamp: new Date().toISOString(),
              isClientMessage: detectedUserType === 'CLIENT'
            });
            // Trigger the handler by emitting to self
            newSocket.emit('__process_queued_message', queuedMessage);
          });

          // Resolve authentication promise to unblock future message processing
          if (authenticationResolveRef.current) {
            const resolveTimestamp = Date.now();
            console.log('✅ TASK 7: Resolving authentication promise at:', new Date(resolveTimestamp).toISOString());
            console.log('⏱️ TASK 7: Total auth time:', `${resolveTimestamp - connectedTimestamp}ms`);
            authenticationResolveRef.current();
            authenticationResolveRef.current = null;
            authenticationPromiseRef.current = null;
          }
        });

        // ISSUE 4 FIX: Fetch hierarchical counts automatically on agent login
        if (detectedUserType === 'AGENT') {
          console.log('✅ ISSUE 4: Agent authenticated - scheduling hierarchical unread counts fetch');
          // Use setTimeout to ensure React state updates have completed
          setTimeout(() => {
            console.log('📊 Badge fetch: Verifying auth state before fetch:', {
              currentUserId: currentUserIdRef.current,
              currentUserType: currentUserTypeRef.current,
              isConnected
            });
            if (currentUserIdRef.current && currentUserTypeRef.current) {
              fetchHierarchicalUnreadCounts();
            } else {
              console.warn('⚠️ Badge fetch skipped: Auth state not ready');
            }
          }, 100);
        }

        // ISSUE 7 FIX: Restore property subscriptions after reconnection
        if (propertyIdsBeforeDisconnectRef.current.size > 0) {
          console.log('🔄 ISSUE 7: Restoring property subscriptions after reconnection');
          const propertiesToRestore = Array.from(propertyIdsBeforeDisconnectRef.current);
          console.log('📋 ISSUE 7: Properties to restore:', propertiesToRestore);

          setTimeout(() => {
            propertiesToRestore.forEach((propertyId) => {
              console.log(`🔌 ISSUE 7: Rejoining property: ${propertyId}`);
              joinPropertyConversation(propertyId);
            });
            // Clear the stored property IDs after restoration
            propertyIdsBeforeDisconnectRef.current.clear();

            // Refresh badge counts after property subscription restoration
            if (currentUserTypeRef.current === 'AGENT') {
              setTimeout(() => {
                console.log('🔄 Refreshing badge counts after reconnection');
                fetchHierarchicalUnreadCounts();
              }, 500);
            }
          }, 200);
        }

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
          processedQueuedMessages: processedQueueLength,
          serverResponse: data
        });
      } else {
        console.error('❌ Server did not provide userId or userType:', data);
        // TASK 3: Enhanced fallback authentication with share token detection
        if (!isAuthenticated && !user) {
          // Check if this is a client portal session with share tokens
          const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
          const shareToken = urlParams?.get('shareToken');
          const timelineId = urlParams?.get('timelineId');
          const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

          // Extract timeline from path if present
          let extractedTimelineId = timelineId;
          if (currentPath.includes('/timeline/')) {
            const pathSegments = currentPath.split('/').filter(Boolean);
            const timelineIndex = pathSegments.indexOf('timeline');
            if (timelineIndex !== -1 && timelineIndex + 1 < pathSegments.length) {
              extractedTimelineId = pathSegments[timelineIndex + 1];
            }
          }

          // TASK 3: Create client-specific fallback ID
          let fallbackUserId;
          if (extractedTimelineId) {
            fallbackUserId = `client_${extractedTimelineId}`;
            console.warn('⚠️ TASK 3: Using timeline-based client authentication:', fallbackUserId);
          } else if (shareToken) {
            fallbackUserId = `client_${shareToken.substring(0, 12)}`;
            console.warn('⚠️ TASK 3: Using shareToken-based client authentication:', fallbackUserId);
          } else {
            fallbackUserId = `anonymous_${Date.now()}`;
            console.warn('⚠️ TASK 3: Using anonymous client authentication:', fallbackUserId);
          }

          updateAuthState(fallbackUserId, 'CLIENT');

          // Process queued messages even for fallback
          console.log(`📦 TASK 3: Processing ${messageQueueRef.current.length} queued messages (fallback)...`);
          const queuedMessages = [...messageQueueRef.current];
          messageQueueRef.current = [];

          queuedMessages.forEach((queuedMessage, index) => {
            console.log(`📨 TASK 3: Processing queued message ${index + 1}/${queuedMessages.length}:`, {
              messageId: queuedMessage.id,
              content: queuedMessage.content?.substring(0, 30)
            });
            newSocket.emit('__process_queued_message', queuedMessage);
          });

          // TASK 3: Resolve authentication promise even for fallback
          if (authenticationResolveRef.current) {
            console.log('✅ TASK 3: Resolving authentication promise for client fallback');
            authenticationResolveRef.current();
            authenticationResolveRef.current = null;
            authenticationPromiseRef.current = null;
          }
        }
      }
    });

    // Handle successful authentication
    newSocket.on('authenticated', (data) => {
      console.log('V2 messaging authenticated:', data);
      setIsConnected(true);
      setIsConnecting(false);
    });

    // TASK 9: Listen for auth-expired events from server
    newSocket.on('auth-expired', (data) => {
      console.warn('⚠️ TASK 9: Authentication expired event received from server:', data);
      // Clear stored tokens
      sessionTokenRef.current = null;
      sessionTokenTimestampRef.current = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('clientSessionToken');
      }
      // Disconnect and trigger reconnection with fresh auth
      newSocket.disconnect();
      setIsConnected(false);
      setConnectionState(ConnectionState.DISCONNECTED);
      handleReconnection('auth');
    });

    newSocket.on('user_online', (data) => {
      setOnlineUsers(prev => [...prev.filter(id => id !== data.userId), data.userId]);
    });

    newSocket.on('user_offline', (data) => {
      setOnlineUsers(prev => prev.filter(id => id !== data.userId));
    });

    // Handle new messages from V2 system (TASK 3: wait for authentication promise)
    newSocket.on('new-message', async (message: any) => {
      console.log('📨 V2 new message received:', {
        messageId: message.id,
        senderType: message.senderType || message.sender?.type,
        senderId: message.senderId || message.sender?.id,
        content: message.content?.substring(0, 20),
        currentUserId: currentUserIdRef.current,
        currentUserType: currentUserTypeRef.current,
        authenticationComplete: currentUserIdRef.current !== null && currentUserTypeRef.current !== null,
        authPromiseExists: !!authenticationPromiseRef.current,
        fullMessage: message
      });

      // TASK 2: Queue messages that arrive before authentication completes
      const isOptimisticMessage = message.id && message.id.toString().startsWith('temp-');

      if (!isOptimisticMessage && authenticationPromiseRef.current) {
        console.log('⏳ QUEUING: Message arrived before authentication complete, adding to queue:', {
          messageId: message.id,
          queueSize: messageQueueRef.current.length
        });
        messageQueueRef.current.push(message);
        return; // Don't process now, will process after auth completes
      }

      if (!isOptimisticMessage && (currentUserIdRef.current === null || currentUserTypeRef.current === null)) {
        console.warn('⚠️ Received incoming message before authentication complete, queuing:', {
          messageId: message.id,
          isOptimistic: isOptimisticMessage,
          currentUserId: currentUserIdRef.current,
          currentUserType: currentUserTypeRef.current,
          queueSize: messageQueueRef.current.length
        });
        messageQueueRef.current.push(message);
        return;
      }

      // TASK 8: Optimized duplicate prevention with Map
      const messageKey = `${message.id}-${message.content.substring(0, 50)}-${message.createdAt}`;
      const now = Date.now();

      if (recentlyProcessedMessages.has(messageKey)) {
        console.warn('🚨 BLOCKING: Recently processed message detected', {
          messageId: message.id,
          messageKey: messageKey.substring(0, 100)
        });
        return;
      }

      // Add to recently processed with timestamp
      setRecentlyProcessedMessages(prev => {
        const newMap = new Map(prev);

        // Remove entries older than 10 seconds (cleanup on add)
        for (const [key, timestamp] of newMap.entries()) {
          if (now - timestamp > PROCESSED_MESSAGE_TIMEOUT) {
            newMap.delete(key);
          }
        }

        // If we're at max capacity, remove oldest entry
        if (newMap.size >= MAX_PROCESSED_MESSAGES) {
          const oldestKey = Array.from(newMap.entries())
            .sort((a, b) => a[1] - b[1])[0][0];
          newMap.delete(oldestKey);
          console.log('🧹 Removed oldest processed message entry (capacity limit)');
        }

        // Add new entry with timestamp
        newMap.set(messageKey, now);

        // Schedule cleanup for this specific entry
        setTimeout(() => {
          setRecentlyProcessedMessages(current => {
            const updated = new Map(current);
            updated.delete(messageKey);
            return updated;
          });
        }, PROCESSED_MESSAGE_TIMEOUT);

        return newMap;
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

      // TASK 8: Client-specific message deduplication with flexible comparison
      let isFromCurrentUser = transformedMessage.senderId === currentUserId;

      // TASK 8: For client connections, use flexible sender ID matching
      if (currentUserType === 'CLIENT' && !isFromCurrentUser) {
        // Check if sender ID contains timeline ID or matches client patterns
        const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
        let timelineId = null;

        // Extract timeline ID from path
        if (currentPath.includes('/timeline/')) {
          const pathSegments = currentPath.split('/').filter(Boolean);
          const timelineIndex = pathSegments.indexOf('timeline');
          if (timelineIndex !== -1 && timelineIndex + 1 < pathSegments.length) {
            timelineId = pathSegments[timelineIndex + 1];
          }
        }

        // TASK 8: Check if message is from this client using flexible matching
        if (timelineId && transformedMessage.senderId.includes(timelineId)) {
          isFromCurrentUser = true;
          console.log('✅ TASK 8: Detected own message via timelineId match:', {
            senderId: transformedMessage.senderId,
            timelineId,
            currentUserId
          });
        } else if (currentUserId && (
          currentUserId.startsWith('client_') || currentUserId.startsWith('anonymous_')
        )) {
          // For synthetic IDs, check if sender matches pattern
          const userIdBase = currentUserId.split('_')[1];
          if (transformedMessage.senderId.includes(userIdBase)) {
            isFromCurrentUser = true;
            console.log('✅ TASK 8: Detected own message via synthetic ID match:', {
              senderId: transformedMessage.senderId,
              currentUserId,
              userIdBase
            });
          }
        }
      }

      // Debug notification logic
      console.log('🔔 TASK 8: Notification check:', {
        messageId: message.id,
        senderId: transformedMessage.senderId,
        currentUserId: currentUserId,
        currentUserType: currentUserType,
        isFromCurrentUser,
        isOptimisticMessage,
        currentUserIdIsNull: currentUserId === null,
        isClientConnection: currentUserType === 'CLIENT',
        willShowNotification: !isFromCurrentUser && !isOptimisticMessage && currentUserId !== null
      });

      // Don't show notifications if currentUserId is null (authentication not complete)
      if (!isFromCurrentUser && !isOptimisticMessage && currentUserId !== null) {
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

    // TASK 3: Handle queued message processing (internal event)
    newSocket.on('__process_queued_message', async (message: any) => {
      console.log('📨 Processing queued message from queue:', {
        messageId: message.id,
        content: message.content?.substring(0, 30)
      });

      // Process through the same logic as new-message handler
      // (duplicate the core processing logic below)

      // TASK 8: Optimized duplicate prevention with Map
      const messageKey = `${message.id}-${message.content.substring(0, 50)}-${message.createdAt}`;
      const now = Date.now();

      if (recentlyProcessedMessages.has(messageKey)) {
        console.warn('🚨 BLOCKING: Recently processed message detected (from queue)', {
          messageId: message.id,
          messageKey: messageKey.substring(0, 100)
        });
        return;
      }

      // Add to recently processed with timestamp
      setRecentlyProcessedMessages(prev => {
        const newMap = new Map(prev);

        // Remove entries older than 10 seconds (cleanup on add)
        for (const [key, timestamp] of newMap.entries()) {
          if (now - timestamp > PROCESSED_MESSAGE_TIMEOUT) {
            newMap.delete(key);
          }
        }

        // If we're at max capacity, remove oldest entry
        if (newMap.size >= MAX_PROCESSED_MESSAGES) {
          const oldestKey = Array.from(newMap.entries())
            .sort((a, b) => a[1] - b[1])[0][0];
          newMap.delete(oldestKey);
          console.log('🧹 Removed oldest processed message entry (capacity limit)');
        }

        // Add new entry with timestamp
        newMap.set(messageKey, now);

        // Schedule cleanup for this specific entry
        setTimeout(() => {
          setRecentlyProcessedMessages(current => {
            const updated = new Map(current);
            updated.delete(messageKey);
            return updated;
          });
        }, PROCESSED_MESSAGE_TIMEOUT);

        return newMap;
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

        if (isDuplicate) {
          console.log('🔄 Skipping duplicate message (from queue):', transformedMessage.id);
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
            console.log('🔄 Replaced temp message with real message (from queue):', {
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

      // TASK 3: Update property notification count using state variables
      const isFromCurrentUser = transformedMessage.senderId === currentUserId;

      // Don't show notifications if currentUserId is null (authentication not complete)
      if (!isFromCurrentUser && currentUserId !== null) {
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
      console.log('🔵 Property conversation joined:', {
        propertyId: data.propertyId,
        conversationId: data.conversationId,
        status: data.status,
        messageCount: data.messages?.length || 0,
        messages: data.messages?.map(m => ({
          id: m.id,
          content: m.content?.substring(0, 30),
          senderType: m.senderType,
          senderId: m.senderId,
          createdAt: m.createdAt
        }))
      });

      // Handle different status responses
      if (data.status === 'success' && data.conversationId) {
        console.log(`✅ Property ${data.propertyId} joined successfully with ${data.messages?.length || 0} messages`);

        // Store conversation data
        setPropertyConversations(prev => ({
          ...prev,
          [data.propertyId]: {
            id: data.conversationId,
            propertyId: data.propertyId,
            lastMessageAt: new Date(),
          } as PropertyConversation
        }));

        // TASK 4: ENHANCED DATABASE SYNC with duplicate prevention
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
          // TASK 4: Also add to recentlyProcessedMessages Map to prevent duplicate event processing
          serverMessages.forEach(serverMsg => {
            const transformed = transformMessage(serverMsg);
            messageMap.set(transformed.id, transformed); // Overwrites any existing

            // TASK 4: Mark as processed to prevent duplicate processing from new-message events
            const messageKey = `${transformed.id}-${transformed.content.substring(0, 50)}-${transformed.createdAt}`;
            setRecentlyProcessedMessages(current => {
              const newMap = new Map(current);
              newMap.set(messageKey, Date.now());

              // Schedule cleanup
              setTimeout(() => {
                setRecentlyProcessedMessages(latest => {
                  const updated = new Map(latest);
                  updated.delete(messageKey);
                  return updated;
                });
              }, PROCESSED_MESSAGE_TIMEOUT);

              return newMap;
            });
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

          console.log('🔄 TASK 4: Database sync complete with duplicate prevention:', {
            propertyId: data.propertyId,
            existingCount: existingMessages.length,
            serverCount: serverMessages.length,
            finalCount: finalMessages.length,
            tempMessagesPreserved: finalMessages.filter(m => m.id.startsWith('temp-')).length,
            duplicatesPrevented: (existingMessages.length + serverMessages.length) - finalMessages.length,
            markedAsProcessed: serverMessages.length,
            finalMessages: finalMessages.map(m => ({
              id: m.id,
              content: m.content?.substring(0, 30),
              senderType: m.senderType,
              senderId: m.senderId
            }))
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

    // TASK 6: Listen for unread counts updated event
    newSocket.on('unreadCountsUpdated', (data: { propertyId: string; agentUnreadCount: number; clientUnreadCount: number }) => {
      console.log('📊 Unread counts updated:', data);

      // Update the conversation unread count in state
      setPropertyConversations(prev => {
        const conversation = prev[data.propertyId];
        if (conversation) {
          return {
            ...prev,
            [data.propertyId]: {
              ...conversation,
              unreadAgentCount: data.agentUnreadCount,
              unreadClientCount: data.clientUnreadCount,
            },
          };
        }
        return prev;
      });

      // P1-3 FIX: Removed redundant fetchHierarchicalUnreadCounts() call
      // Badge updates now come via hierarchicalUnreadCountsUpdated event (P0-1 fix)
      if (currentUserType === 'CLIENT') {
        // PHASE 3: Update client badge counts directly from socket event
        setClientUnreadCounts(prev => ({
          ...prev,
          [data.propertyId]: data.clientUnreadCount
        }));
        console.log('✅ CLIENT BADGE: Updated badge count for property:', data.propertyId, data.clientUnreadCount);

        // BADGE FIX: Clear client badge cache to force fresh fetch on next reload
        setCachedClientBadgeState(prev => ({
          ...prev,
          [data.propertyId]: data.clientUnreadCount
        }));
      }
    });

    // ISSUE 1 FIX + P2-7: Listen for hierarchical unread counts updated event
    newSocket.on('hierarchicalUnreadCountsUpdated', (data: {
      totalUnread: number;
      clients: Array<{
        clientId: string;
        clientName: string;
        unreadCount: number;
        properties: Array<{
          propertyId: string;
          address: string;
          unreadCount: number;
        }>;
      }>;
    }) => {
      console.log('📊 P2-7: Hierarchical unread counts updated via WebSocket:', data);

      // Directly update the hierarchical unread counts state (legacy)
      setHierarchicalUnreadCounts(data);

      // P2-7: Sync with unified badge system
      // Clear existing message badges and add new ones
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

      console.log('✅ P2-7: Synced hierarchical badge counts to unified system');
    });

    // BADGE FIX: Listen for client badge updates
    newSocket.on('clientUnreadCountsUpdated', (data: { counts: { [propertyId: string]: number } }) => {
      console.log('📊 BADGE FIX: Client unread counts updated via WebSocket:', data);

      // Update client badge counts directly from socket event
      setClientUnreadCounts(data.counts || {});

      // BADGE FIX: Clear cache to force fresh fetch on next reload
      setCachedClientBadgeState({});
      console.log('✅ BADGE FIX: Updated client badge counts and cleared cache');
    });

    newSocket.on('error', (error: any) => {
      // Rate limit error logging to prevent spam
      const now = Date.now();
      const lastErrorTime = newSocket.lastErrorTime || 0;

      // P0 FIX: Handle empty error objects gracefully
      const errorMessage = error?.message || error?.error || 'Unknown error';
      const hasUsefulError = error && (error.message || error.error || Object.keys(error).length > 0);

      if (now - lastErrorTime > 1000 && hasUsefulError) { // Only log errors once per second
        console.error('❌ V2 messaging error:', {
          message: errorMessage,
          details: error
        });
        newSocket.lastErrorTime = now;
      }

      // Only show critical connection errors to user
      if (error?.message &&
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

    // TASK 2: Store cleanup function on socket instance (non-enumerable)
    const cleanup = () => {
      console.log('🧹 Cleaning up socket event listeners');
      newSocket.removeAllListeners();
      newSocket.disconnect();
    };

    // Store cleanup function using Object.defineProperty (non-enumerable)
    Object.defineProperty(newSocket, 'cleanup', {
      value: cleanup,
      writable: true,
      enumerable: false,
      configurable: true
    });

    return cleanup;
  }, [clearAllListeners, transformMessage, addNotification, user, currentUserId, currentUserType, isAuthenticated, handleReconnection]);

  // Cleanup effect (TASK 2: uses stored cleanup function, removed socketCleanupRef)
  useEffect(() => {
    return () => {
      if (socket) {
        console.log('🧹 Cleaning up socket on socket change');
        // Execute stored cleanup function
        if (socket.cleanup) {
          socket.cleanup();
        } else {
          // Fallback cleanup
          socket.removeAllListeners();
          socket.disconnect();
        }
        setSocket(null);
        setIsConnected(false);

        // P2-8 FIX: Invalidate badge cache on cleanup
        const { clearCache } = useBadgePersistenceStore.getState();
        clearCache();
        console.log('🗑️ P2-8: Badge cache cleared on cleanup');
      }
    };
  }, [socket]);

  // Monitor auth state sync between state and refs (diagnostic hook)
  useEffect(() => {
    const stateUserId = currentUserId;
    const stateUserType = currentUserType;
    const refUserId = currentUserIdRef.current;
    const refUserType = currentUserTypeRef.current;

    if (stateUserId !== refUserId || stateUserType !== refUserType) {
      console.warn('⚠️ AUTH STATE DIVERGENCE DETECTED:', {
        timestamp: new Date().toISOString(),
        state: { userId: stateUserId, userType: stateUserType },
        ref: { userId: refUserId, userType: refUserType }
      });
    }
  }, [currentUserId, currentUserType]);

  // P2-9 FIX: Multi-tab synchronization via storage events
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      // Only handle badge persistence storage changes
      if (event.key === 'badge-persistence-storage' && event.newValue) {
        try {
          const newState = JSON.parse(event.newValue);
          const cachedBadgeState = newState.state?.cachedBadgeState;

          if (cachedBadgeState?.hierarchicalCounts) {
            console.log('🔄 P2-9: Badge state synced from another tab');
            setHierarchicalUnreadCounts(cachedBadgeState.hierarchicalCounts);
          }
        } catch (error) {
          console.error('❌ P2-9: Failed to parse storage event:', error);
        }
      }
    };

    // Listen for storage changes from other tabs
    window.addEventListener('storage', handleStorageChange);

    console.log('👀 P2-9: Multi-tab synchronization enabled');

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      console.log('🧹 P2-9: Multi-tab synchronization listener removed');
    };
  }, []);

  // TASK 10: Get or create property conversation with state lifecycle
  const getOrCreatePropertyConversation = useCallback(async (propertyId: string, timelineId: string): Promise<PropertyConversation> => {
    try {
      // Check if conversation already exists locally
      if (propertyConversations[propertyId]) {
        return propertyConversations[propertyId];
      }

      // TASK 10: Check property state to prevent duplicate joins
      const currentState = propertyStates.get(propertyId);
      if (currentState === 'joining' || currentState === 'joined') {
        console.log(`⏳ Property conversation already in state: ${currentState} for ${propertyId}`);
        throw new Error(`Property already ${currentState}: ${propertyId}`);
      }

      // TASK 10: Set state to joining
      setPropertyStates(prev => new Map(prev).set(propertyId, 'joining'));

      // First, try to join the property conversation via WebSocket
      if (socket && isConnected) {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            // TASK 10: Set state to error on timeout
            setPropertyStates(prev => new Map(prev).set(propertyId, 'error'));

            // Auto-transition error to unjoined after 5s
            setTimeout(() => {
              setPropertyStates(prev => {
                const updated = new Map(prev);
                updated.delete(propertyId);
                return updated;
              });
            }, 5000);

            reject(new Error('Timeout waiting for property conversation'));
          }, 10000);

          // Listen for successful join response
          socket.once('property-conversation-joined', (data: { propertyId: string; conversationId: string; messages: any[] }) => {
            clearTimeout(timeout);

            if (data.propertyId === propertyId) {
              // TASK 10: Set state to joined on success
              setPropertyStates(prev => new Map(prev).set(propertyId, 'joined'));

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

            // TASK 10: Set state to error
            setPropertyStates(prev => new Map(prev).set(propertyId, 'error'));

            // Auto-transition error to unjoined after 5s
            setTimeout(() => {
              setPropertyStates(prev => {
                const updated = new Map(prev);
                updated.delete(propertyId);
                return updated;
              });
            }, 5000);

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

    // ISSUE 4 FIX: Use authentication promise instead of setTimeout polling
    if (authenticationPromiseRef.current) {
      console.log('⏳ Waiting for authentication to complete...');
      try {
        // Wait for authentication to complete with a timeout
        await Promise.race([
          authenticationPromiseRef.current,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Authentication timeout')), 5000)
          )
        ]);
        console.log('✅ Authentication completed, proceeding with message send');
      } catch (error) {
        console.error('❌ Authentication timeout - cannot send message:', {
          currentUserId,
          currentUserType,
          isConnected,
          socketId: socket?.id
        });
        throw new Error('Authentication required - please wait for connection to complete');
      }
    }

    // Double-check authentication state after promise resolves
    if (currentUserId === null || currentUserType === null) {
      console.error('❌ Authentication failed - cannot send message:', {
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

      // P0-2 + P2-6 FIX: Optimistically update badge counts - now uses flat state for O(1) updates
      if (userType === 'AGENT' && unreadMessages.length > 0) {
        console.log(`🔄 P0-2/P2-6: Optimistically decrementing badge by ${unreadMessages.length} for property ${propertyId}`);

        // P2-6: Direct O(1) update to flat state
        setFlatBadgeState(prev => {
          const propertyData = prev.byProperty[propertyId];

          if (!propertyData) {
            console.log('⚠️ P2-6: Property not found in flat state, skipping optimistic update');
            return prev;
          }

          const clientId = propertyData.clientId;
          const oldPropertyCount = propertyData.count;
          const oldClientCount = prev.byClient[clientId] || 0;

          // Calculate new counts
          const newPropertyCount = Math.max(0, oldPropertyCount - unreadMessages.length);
          const newClientCount = Math.max(0, oldClientCount - unreadMessages.length);
          const newTotal = Math.max(0, prev.totalUnread - unreadMessages.length);

          console.log(`✅ P2-6: Badge optimistically updated (total: ${prev.totalUnread} → ${newTotal})`);

          return {
            ...prev,
            totalUnread: newTotal,
            byClient: {
              ...prev.byClient,
              [clientId]: newClientCount,
            },
            byProperty: {
              ...prev.byProperty,
              [propertyId]: {
                ...propertyData,
                count: newPropertyCount,
              },
            },
          };
        });

        // Also update hierarchical state for backward compatibility
        setHierarchicalUnreadCounts(prev => {
          if (!prev) return prev;

          const clientWithProperty = prev.clients.find(client =>
            client.properties.some(prop => prop.propertyId === propertyId)
          );

          if (!clientWithProperty) return prev;

          const updatedClients = prev.clients.map(client => {
            if (client.clientId !== clientWithProperty.clientId) {
              return client;
            }

            const updatedProperties = client.properties.map(prop => {
              if (prop.propertyId !== propertyId) {
                return prop;
              }
              return {
                ...prop,
                unreadCount: Math.max(0, prop.unreadCount - unreadMessages.length),
              };
            });

            return {
              ...client,
              properties: updatedProperties,
              unreadCount: Math.max(0, client.unreadCount - unreadMessages.length),
            };
          });

          return {
            totalUnread: Math.max(0, prev.totalUnread - unreadMessages.length),
            clients: updatedClients,
          };
        });

        // P2-8 FIX: Invalidate badge cache after marking as read to prevent stale counts
        const { clearCache } = useBadgePersistenceStore.getState();
        clearCache();
        console.log('🗑️ P2-8: Badge cache cleared after mark-as-read to prevent stale counts');

        // P2-7: Sync to unified badge system
        unifiedBadges.markMessagesAsRead(propertyId, unreadMessages.map(m => m.id));
        console.log('✅ P2-7: Synced mark-as-read to unified badge system');
      }
    } catch (error) {
      console.error('❌ Failed to mark messages as read:', error);
    }
  }, [socket, isConnected, propertyConversations, messages, currentUserId, currentUserType, user, unifiedBadges]);

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

  // TASK 10: Reset property initialization state using Map
  const resetPropertyInitialization = useCallback((propertyId: string) => {
    console.log('🔄 Reset property initialization:', propertyId);
    // Remove property from state Map
    setPropertyStates(prev => {
      const updated = new Map(prev);
      updated.delete(propertyId);
      return updated;
    });
  }, []);

  // TASK 10: Force reset with state lifecycle management
  const forceResetPropertyConversation = useCallback((propertyId: string) => {
    console.log('💥 RESET: Clearing state for property:', propertyId);

    // Remove from property states Map
    setPropertyStates(prev => {
      const updated = new Map(prev);
      updated.delete(propertyId);
      return updated;
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

  // P2-6 FIX: Helper function to convert hierarchical data to flat structure
  const hierarchicalToFlat = useCallback((hierarchical: typeof hierarchicalUnreadCounts) => {
    if (!hierarchical) {
      return {
        totalUnread: 0,
        byClient: {},
        byProperty: {},
        clientNames: {},
      };
    }

    const byClient: Record<string, number> = {};
    const byProperty: Record<string, { count: number; clientId: string; address: string }> = {};
    const clientNames: Record<string, string> = {};

    hierarchical.clients.forEach(client => {
      byClient[client.clientId] = client.unreadCount;
      clientNames[client.clientId] = client.clientName;

      client.properties.forEach(property => {
        byProperty[property.propertyId] = {
          count: property.unreadCount,
          clientId: client.clientId,
          address: property.address,
        };
      });
    });

    return {
      totalUnread: hierarchical.totalUnread,
      byClient,
      byProperty,
      clientNames,
    };
  }, []);

  // P2-6 FIX: Sync flat state whenever hierarchical state changes
  useEffect(() => {
    const flat = hierarchicalToFlat(hierarchicalUnreadCounts);
    setFlatBadgeState(flat);
  }, [hierarchicalUnreadCounts, hierarchicalToFlat]);

  // TASK 3: Get total unread count across all properties (memoized) - P2-6: Now uses flat state
  const getTotalUnreadCount = useCallback(() => {
    return flatBadgeState.totalUnread;
  }, [flatBadgeState]);

  // ISSUE 9 FIX: Create memoized conversationsByClient map for O(1) lookup
  const conversationsByClient = useMemo(() => {
    const clientMap = new Map<string, PropertyConversation[]>();

    Object.values(propertyConversations).forEach(conv => {
      const existingConvs = clientMap.get(conv.clientId) || [];
      clientMap.set(conv.clientId, [...existingConvs, conv]);
    });

    console.log(`📊 ISSUE 9: Memoized conversationsByClient map created (${clientMap.size} clients)`);
    return clientMap;
  }, [propertyConversations]);

  // TASK 3: Get unread count for a specific client - P2-6: O(1) lookup with flat state
  const getClientUnreadCount = useCallback((clientId: string) => {
    return flatBadgeState.byClient[clientId] || 0;
  }, [flatBadgeState]);

  // TASK 3: Fetch hierarchical unread counts from API
  const fetchHierarchicalUnreadCounts = useCallback(async () => {
    console.log('📊 fetchHierarchicalUnreadCounts called with state:', {
      currentUserId,
      currentUserType,
      isConnected
    });

    if (!currentUserId || currentUserType !== 'AGENT' || !isConnected) {
      console.warn('⚠️ Skipping hierarchical fetch - incomplete auth state:', {
        hasUserId: !!currentUserId,
        isAgent: currentUserType === 'AGENT',
        isConnected
      });
      return;
    }

    // P1-5 FIX: Abort any in-flight request before starting new one
    if (fetchAbortControllerRef.current) {
      console.log('🛑 P1-5: Aborting previous fetch request');
      fetchAbortControllerRef.current.abort();
    }

    // P1-5 FIX: Create new AbortController for this request
    fetchAbortControllerRef.current = new AbortController();
    const signal = fetchAbortControllerRef.current.signal;

    setBadgeDataLoading(true);

    // ISSUE 2 FIX: Cache-then-network pattern - load from cache first
    const { getCachedBadgeState, setCachedBadgeState } = useBadgePersistenceStore.getState();
    const cachedState = getCachedBadgeState();

    if (cachedState && cachedState.isFresh) {
      console.log('✅ ISSUE 2: Loading badge state from cache (fresh, <5min old)');
      setHierarchicalUnreadCounts(cachedState.counts);
      // Continue with network request in background to refresh data
    } else if (cachedState && !cachedState.isFresh) {
      console.log('⚠️ ISSUE 2: Loading stale cache (>5min old), refreshing in background');
      setHierarchicalUnreadCounts(cachedState.counts);
    } else {
      console.log('📡 ISSUE 2: No cache available, fetching from network');
    }

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      if (!token) return;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3010'}/api/v2/conversations/unread/hierarchical`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal, // P1-5 FIX: Pass abort signal to fetch
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch hierarchical unread counts');
      }

      const data = await response.json();
      setHierarchicalUnreadCounts(data);

      // ISSUE 2 FIX: Cache the fresh data for next time
      setCachedBadgeState(data);
      console.log('✅ ISSUE 2: Cached fresh badge state to localStorage');
      console.log('✅ Hierarchical unread counts fetched:', data);
    } catch (error: any) {
      // P1-5 FIX: Handle aborted requests gracefully without logging errors
      if (error.name === 'AbortError') {
        console.log('🛑 P1-5: Fetch request was cancelled (deduplication)');
        return;
      }
      console.error('Failed to fetch hierarchical unread counts:', error);
    } finally {
      setBadgeDataLoading(false);
    }
  }, [currentUserId, currentUserType, isConnected]);

  // PHASE 2: Fetch client unread counts from API
  const fetchClientUnreadCounts = useCallback(async () => {
    console.log('📊 CLIENT BADGE: fetchClientUnreadCounts called with state:', {
      currentUserId,
      currentUserType,
      isConnected
    });

    if (!currentUserId || currentUserType !== 'CLIENT' || !isConnected) {
      console.warn('⚠️ CLIENT BADGE: Skipping client fetch - incomplete auth state:', {
        hasUserId: !!currentUserId,
        isClient: currentUserType === 'CLIENT',
        isConnected
      });
      return;
    }

    setBadgeDataLoading(true);

    // PHASE 2: Cache-then-network pattern - load from cache first
    const { getCachedClientBadgeState, setCachedClientBadgeState } = useBadgePersistenceStore.getState();
    const cachedState = getCachedClientBadgeState();

    if (cachedState && cachedState.isFresh) {
      console.log('✅ CLIENT BADGE: Loading badge state from cache (fresh, <5min old)');
      setClientUnreadCounts(cachedState.counts);
      // Continue with network request in background to refresh data
    } else if (cachedState && !cachedState.isFresh) {
      console.log('⚠️ CLIENT BADGE: Loading stale cache (>5min old), refreshing in background');
      setClientUnreadCounts(cachedState.counts);
    } else {
      console.log('📡 CLIENT BADGE: No cache available, fetching from network');
    }

    try {
      const sessionToken = typeof window !== 'undefined' ? localStorage.getItem('clientSessionToken') : null;
      if (!sessionToken) {
        console.warn('⚠️ CLIENT BADGE: No session token found');
        return;
      }

      console.log('📡 CLIENT BADGE: Fetching from API endpoint');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3010'}/api/v2/conversations/unread/client`,
        {
          headers: {
            'X-Session-Token': sessionToken,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error('❌ CLIENT BADGE: API request failed:', response.status, response.statusText);
        throw new Error(`Failed to fetch client unread counts: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ CLIENT BADGE: Received data from API:', data);

      setClientUnreadCounts(data.counts || {});

      // PHASE 2: Cache the fresh data for next time
      setCachedClientBadgeState(data.counts || {});
      console.log('✅ CLIENT BADGE: Cached fresh badge state to localStorage');
    } catch (error) {
      console.error('❌ CLIENT BADGE: Failed to fetch client unread counts:', error);
    } finally {
      setBadgeDataLoading(false);
    }
  }, [currentUserId, currentUserType, isConnected]);

  // PHASE 2: Get unread count for a specific property (client view)
  const getClientPropertyUnreadCount = useCallback((propertyId: string): number => {
    return clientUnreadCounts[propertyId] || 0;
  }, [clientUnreadCounts]);

  // Auto-fetch badges when authentication state is established
  useEffect(() => {
    if (currentUserId && currentUserType === 'AGENT' && isConnected) {
      console.log('🎯 useEffect: Auth state established, fetching hierarchical badge counts');
      fetchHierarchicalUnreadCounts();
    } else if (currentUserId && currentUserType === 'CLIENT' && isConnected) {
      console.log('🎯 CLIENT BADGE: Auth state established, fetching client badge counts');
      fetchClientUnreadCounts();
    }

    return () => {
      // Cleanup: cancel any pending fetches if component unmounts
      console.log('🧹 useEffect cleanup: Auth state changed');
    };
  }, [currentUserId, currentUserType, isConnected, fetchHierarchicalUnreadCounts, fetchClientUnreadCounts]);

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

    // TASK 3: Hierarchical unread count methods (Agent-only)
    getTotalUnreadCount,
    getClientUnreadCount,
    fetchHierarchicalUnreadCounts,
    badgeDataLoading,

    // PHASE 2: Client badge methods (Client-only)
    clientUnreadCounts,
    fetchClientUnreadCounts,
    getClientPropertyUnreadCount,

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
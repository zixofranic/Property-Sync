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

interface MessagingContextV2Type {
  // Connection state
  socket: Socket | null;
  isConnected: boolean;

  // Current user info - SIMPLIFIED
  currentUserId: string | null;
  currentUserType: 'AGENT' | 'CLIENT' | null;

  // Messages - SIMPLIFIED
  messages: Record<string, MessageV2[]>; // propertyId -> messages
  activePropertyId: string | null;
  setActivePropertyId: (propertyId: string | null) => void;

  // Actions - SIMPLIFIED
  sendMessage: (propertyId: string, content: string) => Promise<void>;
  joinPropertyConversation: (propertyId: string) => void;
}

const MessagingContext = createContext<MessagingContextV2Type | null>(null);

export function MessagingProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useMissionControlStore();
  const { addNotification } = useMissionControlStore();

  // SIMPLIFIED STATE - No complex tracking
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Record<string, MessageV2[]>>({});
  const [activePropertyId, setActivePropertyId] = useState<string | null>(null);

  // SIMPLE USER IDENTIFICATION - Use what we already know
  const currentUserId = user?.id || null;
  const currentUserType = isAuthenticated ? 'AGENT' : 'CLIENT';

  // SIMPLIFIED CONNECTION - No namespaces, no complex auth
  useEffect(() => {
    if (socket) return; // Prevent duplicate connections

    console.log('🔌 Connecting to simple messaging...', {
      userId: currentUserId,
      userType: currentUserType
    });

    const newSocket = io(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/messaging-v2`, {
      auth: {
        token: typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null,
        userType: currentUserType,
      },
      transports: ['websocket', 'polling'],
    });

    // SIMPLE EVENT LISTENERS
    newSocket.on('connect', () => {
      console.log('✅ Connected to messaging');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from messaging');
      setIsConnected(false);
    });

    // SIMPLE MESSAGE HANDLER - No optimistic updates, no complex duplicate detection
    newSocket.on('new-message', (message: any) => {
      console.log('📨 New message received:', message);

      const propertyId = message.conversation?.propertyId || message.propertyId;
      if (!propertyId) return;

      // Transform message
      const transformedMessage: MessageV2 = {
        id: message.id,
        content: message.content,
        type: message.type || 'TEXT',
        senderId: message.sender?.id || message.senderId,
        senderType: message.sender?.type || message.senderType,
        createdAt: new Date(message.createdAt),
        isEdited: false,
        sender: {
          id: message.sender?.id || message.senderId,
          email: message.sender?.email || 'unknown',
          profile: {
            firstName: message.sender?.name?.split(' ')[0] || 'User',
            lastName: message.sender?.name?.split(' ').slice(1).join(' ') || '',
          },
        },
        reads: [],
      };

      // SIMPLE DUPLICATE CHECK - Just check if ID already exists
      setMessages(prev => {
        const existing = prev[propertyId] || [];
        if (existing.some(m => m.id === transformedMessage.id)) {
          console.log('🔄 Duplicate message, skipping');
          return prev;
        }

        return {
          ...prev,
          [propertyId]: [...existing, transformedMessage],
        };
      });

      // Simple notification for messages not from current user
      if (transformedMessage.senderId !== currentUserId) {
        addNotification({
          type: 'info',
          title: 'New message',
          message: message.content.substring(0, 50),
          read: false,
        });
      }
    });

    // Handle property conversation joined
    newSocket.on('property-conversation-joined', (data: any) => {
      console.log('🏠 Joined property conversation:', data.propertyId);
      if (data.messages) {
        setMessages(prev => ({
          ...prev,
          [data.propertyId]: data.messages.map((msg: any) => ({
            id: msg.id,
            content: msg.content,
            type: msg.type || 'TEXT',
            senderId: msg.sender?.id || msg.senderId,
            senderType: msg.sender?.type || msg.senderType,
            createdAt: new Date(msg.createdAt),
            isEdited: false,
            sender: {
              id: msg.sender?.id || msg.senderId,
              email: msg.sender?.email || 'unknown',
              profile: {
                firstName: msg.sender?.name?.split(' ')[0] || 'User',
                lastName: msg.sender?.name?.split(' ').slice(1).join(' ') || '',
              },
            },
            reads: [],
          }))
        }));
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [currentUserId, currentUserType, addNotification]);

  // SIMPLIFIED SEND MESSAGE - No optimistic updates, just send and wait
  const sendMessage = useCallback(async (propertyId: string, content: string) => {
    if (!socket || !isConnected) {
      throw new Error('Not connected');
    }

    console.log('📤 Sending message:', { propertyId, content });

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Message send timeout'));
      }, 5000);

      socket.once('message-sent', () => {
        clearTimeout(timeout);
        console.log('✅ Message sent successfully');
        resolve();
      });

      socket.once('message-error', (error: any) => {
        clearTimeout(timeout);
        console.error('❌ Message send error:', error);
        reject(new Error(error.message || 'Failed to send message'));
      });

      if (currentUserType === 'AGENT') {
        socket.emit('send-message', {
          propertyId,
          content,
          type: 'TEXT',
        });
      } else {
        socket.emit('send-property-message', {
          propertyId,
          content,
          type: 'TEXT',
        });
      }
    });
  }, [socket, isConnected, currentUserType]);

  // SIMPLIFIED JOIN CONVERSATION
  const joinPropertyConversation = useCallback((propertyId: string) => {
    if (!socket || !isConnected) return;

    console.log('🔗 Joining property conversation:', propertyId);
    socket.emit('join-property-conversation', { propertyId });
    setActivePropertyId(propertyId);
  }, [socket, isConnected]);

  const value: MessagingContextV2Type = {
    socket,
    isConnected,
    currentUserId,
    currentUserType,
    messages,
    activePropertyId,
    setActivePropertyId,
    sendMessage,
    joinPropertyConversation,
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
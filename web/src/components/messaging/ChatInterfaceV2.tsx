'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, MessageSquare, User, ChevronDown, Loader2 } from 'lucide-react';
import { useMessaging } from '@/contexts/MessagingContext';
import { useMissionControlStore } from '@/stores/missionControlStore';
import { formatDistanceToNow } from 'date-fns';

interface ChatInterfaceV2Props {
  className?: string;
  onClose?: () => void;
  timelineId?: string;
  propertyId?: string;
}

export default function ChatInterfaceV2({
  className = '',
  onClose,
  timelineId,
  propertyId
}: ChatInterfaceV2Props) {
  const [messageText, setMessageText] = useState('');
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const { user } = useMissionControlStore();

  const {
    socket,
    isConnected,
    messages,
    sendMessage,
    getOrCreatePropertyConversation,
    setActivePropertyId,
    clearPropertyNotifications,
    markMessagesAsRead,
    joinPropertyConversation,
    leavePropertyConversation,
    resetPropertyInitialization,
    currentUserId,
    currentUserType
  } = useMessaging();

  // Check if user is near the bottom of the messages
  const isNearBottom = () => {
    if (!messagesContainerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    return scrollHeight - scrollTop - clientHeight < 100;
  };

  // Handle scroll events to show/hide scroll-to-bottom button
  const handleScroll = () => {
    const nearBottom = isNearBottom();
    setShowScrollToBottom(!nearBottom && currentMessages.length > 0);
  };

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = (force = false) => {
    if (messagesEndRef.current && (force || isNearBottom())) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Get current property messages with stronger deduplication
  const currentMessages = useMemo(() => {
    if (!propertyId || !messages[propertyId]) return [];

    const messageMap = new Map();
    messages[propertyId].forEach(message => {
      // Use message ID as key, keep the latest version if there are duplicates
      if (!messageMap.has(message.id) || new Date(message.createdAt) > new Date(messageMap.get(message.id).createdAt)) {
        messageMap.set(message.id, message);
      }
    });

    return Array.from(messageMap.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Newest first
  }, [propertyId, messages]);


  // Set active property and clear notifications immediately
  useEffect(() => {
    if (propertyId) {
      console.log(`🔵 Setting active property: ${propertyId}`);
      setActivePropertyId(propertyId);
      clearPropertyNotifications(propertyId);
    }
  }, [propertyId]); // Only depend on propertyId

  // Initialize conversation only when connected and have required data
  useEffect(() => {
    if (propertyId && timelineId && isConnected) {
      console.log(`🔄 Initializing conversation for property: ${propertyId}`);

      getOrCreatePropertyConversation(propertyId, timelineId)
        .then(() => {
          console.log(`✅ Property conversation ready: ${propertyId}`);
        })
        .catch(error => {
          console.error('Failed to create/get property conversation:', error);
          resetPropertyInitialization(propertyId);
        });
    }
  }, [propertyId, timelineId, isConnected]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (propertyId) {
        console.log(`🧹 Cleaning up property: ${propertyId}`);
        leavePropertyConversation(propertyId);
      }
    };
  }, [propertyId]);

  // Mark messages as read when chat opens or when new unread messages arrive from others
  // Only mark messages as read, don't spam the server on every message change
  useEffect(() => {
    if (propertyId && messages[propertyId]?.length > 0) {
      // Only mark as read if there are messages from other users (not just our own messages)
      const otherUserMessages = messages[propertyId].filter(msg => msg.senderId !== currentUserId);

      if (otherUserMessages.length > 0) {
        // Add a delay to batch mark-as-read operations and prevent spam
        const timeoutId = setTimeout(() => {
          markMessagesAsRead(propertyId);
        }, 500); // Increased delay to reduce server calls

        return () => clearTimeout(timeoutId);
      }
    }
  }, [propertyId, currentUserId, messages[propertyId]?.length]); // Include message count to trigger when messages load

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!messageText.trim() || !propertyId || !timelineId || isSending) return;

    const textToSend = messageText.trim();

    // Backup message and clear textarea immediately
    setPendingMessage(textToSend);
    setMessageText('');
    setIsSending(true);

    try {
      // Ensure conversation exists before sending message
      await getOrCreatePropertyConversation(propertyId, timelineId);

      // Now send the message
      await sendMessage(propertyId, textToSend, 'TEXT');

      // Success - clear backup
      setPendingMessage('');

      // Ensure scroll to bottom after sending message
      setTimeout(() => {
        scrollToBottom(true); // Force scroll after sending
      }, 100);
    } catch (error) {
      console.error('Failed to send message:', error);

      // Restore message text on failure
      setMessageText(textToSend);

      // Show user-friendly error
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // If no propertyId provided, show error state
  if (!propertyId) {
    return (
      <div className={`flex flex-col h-full bg-slate-900 ${className}`}>
        <div className="flex-1 p-4 flex flex-col items-center justify-center">
          <div className="text-center">
            <MessageSquare className="w-16 h-16 text-slate-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Invalid Chat Configuration</h3>
            <p className="text-slate-400">Property ID is required for V2 messaging</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-slate-900 ${className}`}>
      {/* Chat Header */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Property Chat</h2>
          <div className="flex items-center text-sm text-slate-400">
            <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            {isConnected ? 'Connected (V2)' : 'Disconnected'}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ×
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 relative flex flex-col-reverse gap-4" onScroll={handleScroll}>
        {currentMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="w-12 h-12 text-slate-500 mb-3" />
            <p className="text-slate-400">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          currentMessages.map((message, index) => {
            // Determine sender type consistently
            const isAgent = message.senderType === 'AGENT';
            const isClient = message.senderType === 'CLIENT';

            // Check if this message is from the current user for debug purposes only
            const isOwnMessage = message.senderId === currentUserId;
            const isTemporary = message.id.startsWith('temp-');

            // Debug logging for message ownership
            if (message.content.includes('test') || message.content.includes('hello')) {
              console.log('🔍 V2 Message debug:', {
                messageId: message.id,
                senderId: message.senderId,
                currentUserId,
                currentUserType,
                isOwnMessage,
                senderType: message.senderType,
                isAgent,
                isClient,
                content: message.content.substring(0, 20)
              });
            }

            // Get sender info - always show Agent/Client consistently
            const senderName = isAgent
              ? message.sender?.profile?.firstName || 'Agent'
              : 'Client';

            const senderInitials = isAgent ? 'A' : 'C';

            // Consistent color scheme based on sender type ONLY (not ownership)
            // Agents: green, Clients: purple, regardless of who is viewing
            const messageColors = isAgent
              ? 'bg-green-600 text-white'
              : 'bg-purple-600 text-white';

            const avatarColors = isAgent
              ? 'bg-green-700'
              : 'bg-purple-700';

            // Consistent positioning: Agents on the left, Clients on the right
            // This provides a consistent layout regardless of viewing perspective
            const isRightAligned = isClient;

            return (
              <div key={(message.id && message.id.trim()) || `temp-message-${index}`} className={`flex ${isRightAligned ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] ${isRightAligned ? 'ml-12' : 'mr-12'}`}>
                  {/* Sender name (always show for clarity) */}
                  {!isRightAligned && (
                    <div className="text-xs text-slate-400 mb-1 ml-10">
                      {senderName} • {isAgent ? 'Agent' : 'Client'}
                    </div>
                  )}

                  <div className="flex items-start space-x-2">
                    {/* Avatar for left-aligned messages (agents) */}
                    {!isRightAligned && (
                      <div className={`w-8 h-8 ${avatarColors} rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm`}>
                        {senderInitials}
                      </div>
                    )}

                    {/* Message content */}
                    <div className={`
                      p-3 rounded-lg transition-opacity flex-1
                      ${messageColors}
                      ${isTemporary ? 'opacity-70' : 'opacity-100'}
                      ${isRightAligned ? 'rounded-br-sm' : 'rounded-bl-sm'}
                    `}>
                      <p className="text-sm leading-relaxed">{message.content}</p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs opacity-70">
                          {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                        </p>
                        {message.reads && message.reads.length > 0 && (
                          <span className="text-xs opacity-70">✓ Read</span>
                        )}
                      </div>
                    </div>

                    {/* Avatar for right-aligned messages (clients) */}
                    {isRightAligned && (
                      <div className={`w-8 h-8 ${avatarColors} rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold text-sm`}>
                        {senderInitials}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Scroll to bottom button */}
        {showScrollToBottom && (
          <button
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg transition-colors z-10"
            title="Scroll to bottom"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-end space-x-2">
          <div className="flex-1">
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              rows={1}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
              disabled={!isConnected}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!messageText.trim() || !isConnected || isSending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        {!isConnected && (
          <p className="text-xs text-red-400 mt-2">
            Disconnected - messages cannot be sent
          </p>
        )}
      </div>
    </div>
  );
}

// Also export as named export for flexibility
export { ChatInterfaceV2 };
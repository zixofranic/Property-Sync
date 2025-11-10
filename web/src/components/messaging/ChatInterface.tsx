'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, User, Bot, ChevronDown } from 'lucide-react';
import { useMessaging } from '@/contexts/MessagingContext';
import { useMissionControlStore } from '@/stores/missionControlStore';
import { formatDistanceToNow } from 'date-fns';

interface ChatInterfaceProps {
  className?: string;
  onClose?: () => void;
  initialConversationId?: string;
  timelineId?: string;
  propertyId?: string;
}

export default function ChatInterface({
  className = '',
  onClose,
  initialConversationId,
  timelineId,
  propertyId
}: ChatInterfaceProps) {
  const [messageText, setMessageText] = useState('');
  const [currentConversationId, setCurrentConversationId] = useState(initialConversationId);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const joinedPropertyRef = useRef<string | null>(null);
  const propertyIdRef = useRef(propertyId); // Track propertyId for cleanup
  const { user } = useMissionControlStore();

  // V2 messaging
  const messaging = useMessaging();

  const socket = messaging.socket;
  const conversations = Object.values(messaging.propertyConversations || {});
  const messages = messaging.messages[propertyId || ''] || [];
  const isConnected = messaging.isConnected;
  const currentUserId = messaging.currentUserId;

  const sendMessage = async (content: string) => {
    if (propertyId && timelineId) {
      try {
        // Direct send - conversation should already exist from initialization
        return messaging.sendMessage(propertyId, content);
      } catch (error) {
        console.error('Failed to send message:', error);
        throw error;
      }
    }
    return Promise.resolve();
  };

  const createConversation = () => {
    if (propertyId && timelineId) {
      return messaging.getOrCreatePropertyConversation(propertyId, timelineId);
    }
    return Promise.resolve(null);
  };

  const setActiveConversation = (propertyId: string) => messaging.setActivePropertyId(propertyId);

  const getUnreadCount = () => {
    if (propertyId) {
      return messaging.getPropertyUnreadCount(propertyId);
    }
    return 0;
  };

  const activeConversation = propertyId ? messaging.propertyConversations[propertyId] : null;

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


  // Update propertyId ref when it changes
  useEffect(() => {
    propertyIdRef.current = propertyId;
  }, [propertyId]);

  // Cleanup: leave conversation ONLY on unmount
  useEffect(() => {
    return () => {
      if (propertyIdRef.current && messaging.leavePropertyConversation) {
        console.log(`🧹 ChatInterface cleanup: Leaving property ${propertyIdRef.current}`);
        messaging.leavePropertyConversation(propertyIdRef.current);
      }
    };
  }, []); // Empty array = only runs on mount/unmount

  // Initialize conversation if we have timelineId but no conversationId
  useEffect(() => {
    if (!currentConversationId && timelineId && isConnected) {
      // Try to find existing conversation for this timeline
      const existingConversation = conversations.find(
        conv => conv.timeline?.id === timelineId
      );

      if (existingConversation) {
        setCurrentConversationId(existingConversation.id);
        setActiveConversation(existingConversation);
      }
    }
  }, [currentConversationId, timelineId, conversations, isConnected]);

  // Join conversation with property context when activeConversation or propertyId changes
  useEffect(() => {
    if (socket && isConnected && propertyId && timelineId) {
      // Prevent duplicate joins for the same property
      if (joinedPropertyRef.current === propertyId) {
        console.log('🔄 Agent chat - Property conversation already joined, skipping duplicate:', propertyId);
        return;
      }

      console.log('🔵 Agent chat - Initializing property conversation:', propertyId);

      // Use getOrCreatePropertyConversation instead of direct socket emit
      // This avoids double-joining the same conversation
      messaging.getOrCreatePropertyConversation(propertyId, timelineId)
        .then(() => {
          console.log('✅ Agent chat - Property conversation ready:', propertyId);
          // Track that we've joined this property
          joinedPropertyRef.current = propertyId;
        })
        .catch(error => {
          console.error('❌ Agent chat - Failed to join property conversation:', error);
        });
    }

    // Cleanup: reset joined property when propertyId changes
    return () => {
      if (joinedPropertyRef.current && joinedPropertyRef.current !== propertyId) {
        joinedPropertyRef.current = null;
      }
    };
  }, [socket, isConnected, propertyId, timelineId]);

  // Get current messages for this property - reversed for flex-col-reverse
  const currentMessages = messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!messageText.trim()) return;

    try {
      if (!propertyId) {
        console.error('No property ID available to send message');
        return;
      }

      // Send message directly - conversation should already exist from initialization
      await sendMessage(messageText.trim());
      setMessageText('');

      // Ensure scroll to bottom after sending message
      setTimeout(() => {
        scrollToBottom(true); // Force scroll after sending
      }, 100);
    } catch (error) {
      console.error('Failed to send message:', error);

      // If sending fails, try to ensure conversation exists and retry once
      if (timelineId) {
        try {
          await createConversation();
          await sendMessage(messageText.trim());
          setMessageText('');
        } catch (retryError) {
          console.error('Failed to send message after retry:', retryError);
        }
      }
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // If no conversation is selected, show conversation list or create new conversation
  if (!currentConversationId && !propertyId) {
    return (
      <div className={`flex flex-col h-full bg-slate-900 ${className}`}>
        <div className="p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white flex items-center">
            <MessageSquare className="w-5 h-5 mr-2" />
            Messages
          </h2>
        </div>

        <div className="flex-1 p-4 flex flex-col items-center justify-center">
          <div className="text-center">
            <MessageSquare className="w-16 h-16 text-slate-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No conversations yet</h3>
            <p className="text-slate-400 mb-4">Start a conversation with your agent or client</p>
            <button
              onClick={() => {
                // For now, let's create a demo conversation
                setCurrentConversationId('demo-conversation');
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Start New Conversation
            </button>
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
          <h2 className="text-lg font-semibold text-white">Conversation</h2>
          <div className="flex items-center text-sm text-slate-400">
            <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            {isConnected ? 'Connected' : 'Disconnected'}
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
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 relative flex flex-col-reverse" onScroll={handleScroll}>
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

            // V1 debug logging removed - deprecated

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
              <div key={(message.id && message.id.trim()) || `temp-message-${index}`} className={`flex ${isRightAligned ? 'justify-end' : 'justify-start'} mb-4`}>
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
                      <p className="text-xs mt-2 opacity-70">
                        {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                      </p>
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
            disabled={!messageText.trim() || !isConnected || !propertyId}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center"
          >
            <Send className="w-4 h-4" />
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
export { ChatInterface };
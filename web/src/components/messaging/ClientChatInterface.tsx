'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, User, Bot, AlertCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderType: 'agent' | 'client';
  createdAt: string;
  isRead: boolean;
}

interface Conversation {
  id: string;
  agentId: string;
  clientId: string;
  timelineId: string;
  messages: Message[];
  agentUnreadCount: number;
  clientUnreadCount: number;
  property?: {
    id: string;
    address: string;
  } | null;
}

interface ClientChatInterfaceProps {
  shareToken: string;
  sessionToken: string | null;
  timelineId: string;
  agentName: string;
  propertyId?: string;
  propertyAddress?: string;
}

export function ClientChatInterface({
  shareToken,
  sessionToken,
  timelineId,
  agentName,
  propertyId,
  propertyAddress
}: ClientChatInterfaceProps) {
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // API base URL
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3010';

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load or create conversation
  useEffect(() => {
    if (!sessionToken) {
      setError('Session token required for messaging. Please refresh the page.');
      setIsLoading(false);
      return;
    }

    loadConversation();
  }, [shareToken, sessionToken, timelineId]);

  const loadConversation = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // First, try to get existing conversations
      const response = await fetch(`${apiUrl}/api/v1/messaging/client/${shareToken}/conversations?sessionToken=${sessionToken}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Load conversations error:', response.status, errorText);
        throw new Error(`Failed to load conversations: ${response.status} - ${errorText}`);
      }

      const conversations = await response.json();

      // Find conversation for this timeline and property (if specified)
      let conv;
      if (propertyId) {
        // Look for property-specific conversation
        conv = conversations.find((c: Conversation) =>
          c.timelineId === timelineId && c.property?.id === propertyId
        );
      } else {
        // Look for general timeline conversation (no property specified)
        conv = conversations.find((c: Conversation) =>
          c.timelineId === timelineId && !c.property
        );
      }

      if (!conv) {
        // Create new conversation if it doesn't exist
        try {
          const createResponse = await fetch(`${apiUrl}/api/v1/messaging/client/${shareToken}/conversations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sessionToken,
              propertyId,
            }),
          });

          if (!createResponse.ok) {
            const errorText = await createResponse.text();
            console.error('Create conversation error:', createResponse.status, errorText);
            throw new Error(`Failed to create conversation: ${createResponse.status} - ${errorText}`);
          }

          conv = await createResponse.json();
        } catch (createError) {
          console.error('Failed to create conversation:', createError);
          const context = propertyId ? `property at ${propertyAddress}` : 'timeline';
          setError(`Failed to create conversation for this ${context}. Please try refreshing the page.`);
          return;
        }
      }

      setConversation(conv);
      setMessages(conv.messages || []);
      setIsConnected(true);
    } catch (error) {
      console.error('Failed to load conversation:', error);
      setError(error instanceof Error ? error.message : 'Failed to load conversation');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!messageText.trim() || !conversation || !sessionToken || isSending) return;

    const textToSend = messageText.trim();

    // Backup message and clear textarea immediately
    setPendingMessage(textToSend);
    setMessageText('');
    setIsSending(true);

    try {
      const response = await fetch(`${apiUrl}/api/v1/messaging/client/${shareToken}/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: textToSend,
          sessionToken,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Send message error:', response.status, errorText);
        throw new Error(`Failed to send message: ${response.status} - ${errorText}`);
      }

      const newMessage = await response.json();

      // Add message to local state
      setMessages(prev => [...prev, newMessage]);

      // Success - clear backup
      setPendingMessage('');
      setError(null); // Clear any previous errors
    } catch (error) {
      console.error('Failed to send message:', error);

      // Restore message text on failure
      setMessageText(textToSend);

      setError(error instanceof Error ? error.message : 'Failed to send message');
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

  // Loading state
  if (isLoading) {
    return (
      <div className="h-[calc(600px-73px)] bg-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading conversation...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="h-[calc(600px-73px)] bg-slate-800 flex items-center justify-center">
        <div className="text-center p-6">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Connection Error</h3>
          <p className="text-slate-400 mb-4">{error}</p>
          <button
            onClick={loadConversation}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(600px-73px)] bg-slate-800 flex flex-col">
      {/* Connection Status */}
      <div className="px-4 py-2 border-b border-slate-700 bg-slate-900">
        <div className="flex items-center text-sm text-slate-400">
          <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-400' : 'bg-yellow-400'}`} />
          {isConnected ? 'Connected' : sessionToken ? 'Disconnected' : 'Demo Mode'}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="w-12 h-12 text-slate-500 mb-3" />
            <p className="text-slate-400">
              No messages yet. Start the conversation with {agentName}
              {propertyAddress && (
                <>
                  <br />
                  <span className="text-xs text-slate-500">about {propertyAddress}</span>
                </>
              )}!
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const isOwnMessage = message.senderType === 'client';
            return (
              <div key={message.id || `temp-message-${index}`} className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                <div className={`
                  max-w-[85%] p-3 rounded-lg
                  ${isOwnMessage
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-white'
                  }
                `}>
                  <div className="flex items-start space-x-2">
                    {!isOwnMessage && (
                      <div className="w-6 h-6 bg-slate-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-3 h-3" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm">{message.content}</p>
                      <p className="text-xs mt-1 opacity-70">
                        {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {isOwnMessage && (
                      <div className="w-6 h-6 bg-blue-700 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-slate-700 bg-slate-900">
        <div className="flex items-end space-x-2">
          <div className="flex-1">
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={propertyAddress
                ? `Ask about this property...`
                : `Type your message...`}
              rows={1}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
              disabled={!isConnected && sessionToken}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!messageText.trim() || (!isConnected && sessionToken) || isSending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        {!isConnected && sessionToken && (
          <p className="text-xs text-red-400 mt-2">
            Disconnected - messages cannot be sent
          </p>
        )}
      </div>
    </div>
  );
}
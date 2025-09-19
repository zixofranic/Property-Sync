'use client';

import React from 'react';
import { MessageSquare } from 'lucide-react';
import { useMessaging } from '../../contexts/MessagingContext';

interface FloatingChatButtonProps {
  onClick: () => void;
  className?: string;
}

export function FloatingChatButton({ onClick, className = '' }: FloatingChatButtonProps) {
  // V2 messaging
  const messaging = useMessaging();

  const getUnreadCount = () => {
    // For V2, simplified unread count (always 0 for floating button)
    return 0;
  };

  const isConnected = messaging.isConnected;

  const unreadCount = getUnreadCount();

  return (
    <button
      onClick={onClick}
      className={`
        fixed bottom-6 right-6 z-50
        w-14 h-14 bg-blue-600 hover:bg-blue-700
        rounded-full shadow-lg hover:shadow-xl
        flex items-center justify-center
        transition-all duration-200 ease-in-out
        transform hover:scale-110
        ${!isConnected ? 'opacity-50' : ''}
        ${className}
      `}
      title={isConnected ? 'Open chat' : 'Connecting...'}
    >
      <MessageSquare className="w-6 h-6 text-white" />

      {unreadCount > 0 && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
          {unreadCount > 99 ? '99+' : unreadCount}
        </div>
      )}

      {!isConnected && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
        </div>
      )}
    </button>
  );
}
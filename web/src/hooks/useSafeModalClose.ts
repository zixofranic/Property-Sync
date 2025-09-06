'use client';

import { useCallback } from 'react';

interface UseSafeModalCloseOptions {
  hasUnsavedChanges: boolean;
  onClose: () => void;
  confirmMessage?: string;
  bypassConfirmation?: boolean;
}

export function useSafeModalClose({
  hasUnsavedChanges,
  onClose,
  confirmMessage = 'You have unsaved changes. Are you sure you want to close without saving?',
  bypassConfirmation = false
}: UseSafeModalCloseOptions) {
  
  const handleSafeClose = useCallback(() => {
    console.log('useSafeModalClose - handleSafeClose called:', {
      hasUnsavedChanges,
      bypassConfirmation,
      confirmMessage
    });
    
    if (bypassConfirmation || !hasUnsavedChanges) {
      console.log('useSafeModalClose - Closing without confirmation');
      onClose();
      return;
    }

    console.log('useSafeModalClose - Showing confirmation dialog');
    const shouldClose = window.confirm(confirmMessage);
    if (shouldClose) {
      console.log('useSafeModalClose - User confirmed close');
      onClose();
    } else {
      console.log('useSafeModalClose - User cancelled close');
    }
  }, [hasUnsavedChanges, onClose, confirmMessage, bypassConfirmation]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    // Only close if clicking the backdrop itself, not child elements
    if (e.target === e.currentTarget) {
      handleSafeClose();
    }
  }, [handleSafeClose]);

  const handleDirectClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return {
    handleBackdropClick,
    handleSafeClose,
    handleDirectClose
  };
}
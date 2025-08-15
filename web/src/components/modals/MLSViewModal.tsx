// apps/web/src/components/modals/MLSViewModal.tsx
'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface MLSViewModalProps {
  isOpen: boolean;
  mlsUrl: string;
  propertyAddress: string;
  onClose: () => void;
}

export function MLSViewModal({ isOpen, mlsUrl, propertyAddress, onClose }: MLSViewModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex flex-col"
          onClick={onClose} // Click outside to close
        >
          {/* Header Bar */}
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="bg-slate-900/90 backdrop-blur-sm border-b border-slate-700 p-4 flex items-center justify-between"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking header
          >
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-white font-medium ml-4">{propertyAddress}</span>
            </div>
            
            <button
              onClick={onClose}
              className="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              <span>Close</span>
            </button>
          </motion.div>

          {/* Iframe Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="flex-1 bg-white"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking iframe area
          >
            <iframe
              src={mlsUrl}
              className="w-full h-full border-0"
              title={`MLS Details - ${propertyAddress}`}
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              loading="lazy"
            />
          </motion.div>

          {/* Loading Overlay */}
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="absolute inset-0 bg-slate-900 flex items-center justify-center pointer-events-none"
          >
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-white">Loading MLS Details...</p>
            </div>
          </motion.div>

          {/* Close Instructions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2 }}
            className="absolute bottom-4 right-4 bg-slate-900/80 backdrop-blur-sm text-white px-3 py-2 rounded-lg text-sm pointer-events-none"
          >
            Press <kbd className="px-1 py-0.5 bg-slate-700 rounded text-xs">ESC</kbd> or click outside to close
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Utility component for keyboard shortcut display
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-slate-700 text-slate-300 border border-slate-600">
      {children}
    </kbd>
  );
}
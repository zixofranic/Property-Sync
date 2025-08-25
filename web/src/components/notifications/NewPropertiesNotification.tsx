'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, X, Eye, Sparkles } from 'lucide-react';

interface NewPropertiesNotificationProps {
  count: number;
  onDismiss: () => void;
  onViewClick: () => void;
  timelineTitle?: string;
}

export function NewPropertiesNotification({
  count,
  onDismiss,
  onViewClick,
  timelineTitle = 'your timeline'
}: NewPropertiesNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Auto-dismiss after 10 seconds if no interaction
  useEffect(() => {
    if (hasInteracted) return;

    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onDismiss(), 300);
    }, 10000);

    return () => clearTimeout(timer);
  }, [hasInteracted, onDismiss]);

  const handleDismiss = () => {
    setHasInteracted(true);
    setIsVisible(false);
    setTimeout(() => onDismiss(), 300);
  };

  const handleViewClick = () => {
    setHasInteracted(true);
    onViewClick();
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -100, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -50, scale: 0.9 }}
        className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4"
      >
        <div className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 border border-emerald-500/30 rounded-2xl p-4 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {/* Animated Icon */}
              <motion.div
                className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center"
                animate={{
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatType: "reverse"
                }}
              >
                <div className="relative">
                  <Home className="w-6 h-6 text-white" />
                  <motion.div
                    className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full flex items-center justify-center"
                    animate={{
                      scale: [1, 1.2, 1],
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      repeatType: "reverse"
                    }}
                  >
                    <Sparkles className="w-2 h-2 text-yellow-800" />
                  </motion.div>
                </div>
              </motion.div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-center space-x-1 mb-1">
                  <span className="text-white font-bold text-lg">
                    {count} New Propert{count === 1 ? 'y' : 'ies'}!
                  </span>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="w-4 h-4 text-yellow-300" />
                  </motion.div>
                </div>
                <p className="text-white/90 text-sm">
                  Your agent added {count === 1 ? 'a new property' : `${count} new properties`} to {timelineTitle}
                </p>
              </div>
            </div>

            {/* Dismiss Button */}
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center text-white/80 hover:text-white transition-all duration-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex space-x-3">
            <motion.button
              onClick={handleViewClick}
              className="flex-1 bg-white/20 hover:bg-white/30 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 backdrop-blur-sm border border-white/20"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center justify-center space-x-2">
                <Eye className="w-4 h-4" />
                <span>View New Properties</span>
              </div>
            </motion.button>

            <motion.button
              onClick={handleDismiss}
              className="px-4 py-3 text-white/80 hover:text-white transition-colors text-sm font-medium"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Later
            </motion.button>
          </div>

          {/* Progress Bar */}
          <motion.div
            className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <motion.div
              className="h-full bg-white/60 rounded-full"
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 10, ease: "linear" }}
            />
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
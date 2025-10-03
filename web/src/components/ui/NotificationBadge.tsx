'use client';

// TASK 8: Reusable NotificationBadge Component
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type BadgeAnimation = 'pulse' | 'bounce' | 'static';
export type BadgeColor = 'message' | 'notification' | 'alert' | 'success' | 'warning';
export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';
export type BadgePosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'inline';

export interface NotificationBadgeProps {
  count: number;
  color?: BadgeColor;
  size?: BadgeSize;
  animation?: BadgeAnimation;
  position?: BadgePosition;
  maxCount?: number;
  className?: string;
  showZero?: boolean;
}

// Preset configurations for common use cases
const BADGE_PRESETS = {
  message: {
    color: 'message' as BadgeColor,
    animation: 'pulse' as BadgeAnimation,
  },
  notification: {
    color: 'notification' as BadgeColor,
    animation: 'bounce' as BadgeAnimation,
  },
  alert: {
    color: 'alert' as BadgeColor,
    animation: 'pulse' as BadgeAnimation,
  },
};

// Color configurations using CSS variables for theming
const COLOR_CONFIGS = {
  message: {
    bg: 'bg-orange-500',
    text: 'text-white',
    shadow: 'shadow-orange-500/50',
  },
  notification: {
    bg: 'bg-blue-500',
    text: 'text-white',
    shadow: 'shadow-blue-500/50',
  },
  alert: {
    bg: 'bg-red-500',
    text: 'text-white',
    shadow: 'shadow-red-500/50',
  },
  success: {
    bg: 'bg-green-500',
    text: 'text-white',
    shadow: 'shadow-green-500/50',
  },
  warning: {
    bg: 'bg-yellow-500',
    text: 'text-slate-900',
    shadow: 'shadow-yellow-500/50',
  },
};

// Size configurations
const SIZE_CONFIGS = {
  xs: {
    container: 'w-4 h-4 text-[10px]',
    padding: 'px-1',
  },
  sm: {
    container: 'w-5 h-5 text-xs',
    padding: 'px-1.5',
  },
  md: {
    container: 'w-6 h-6 text-sm',
    padding: 'px-2',
  },
  lg: {
    container: 'w-8 h-8 text-base',
    padding: 'px-3',
  },
};

// Position configurations
const POSITION_CONFIGS = {
  'top-right': 'absolute -top-2 -right-2',
  'top-left': 'absolute -top-2 -left-2',
  'bottom-right': 'absolute -bottom-2 -right-2',
  'bottom-left': 'absolute -bottom-2 -left-2',
  'inline': 'relative',
};

// ISSUE 4 FIX: Animation variants with conditional repeat based on count
const getAnimationVariants = (count: number, showZero: boolean) => ({
  pulse: {
    initial: { scale: 1 },
    animate: {
      scale: [1, 1.1, 1],
      boxShadow: [
        '0 0 0 0 rgba(251, 146, 60, 0.7)',
        '0 0 0 4px rgba(251, 146, 60, 0)',
        '0 0 0 0 rgba(251, 146, 60, 0)',
      ],
    },
    transition: {
      duration: 1.5,
      repeat: (count > 0 || showZero) ? Infinity : 0, // ISSUE 4: Stop animation when count is 0
      ease: 'easeInOut',
    },
  },
  bounce: {
    initial: { y: 0 },
    animate: {
      y: [-2, 0, -2],
    },
    transition: {
      duration: 0.6,
      repeat: (count > 0 || showZero) ? Infinity : 0, // ISSUE 4: Stop animation when count is 0
      ease: 'easeInOut',
    },
  },
  static: {
    initial: { scale: 1 },
    animate: { scale: 1 },
    transition: {},
  },
});

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count,
  color = 'message',
  size = 'md',
  animation = 'pulse',
  position = 'top-right',
  maxCount = 99,
  className = '',
  showZero = false,
}) => {
  // ISSUE 4 FIX: Early return to prevent animation instances
  if (count <= 0 && !showZero) {
    return null;
  }

  const colorConfig = COLOR_CONFIGS[color];
  const sizeConfig = SIZE_CONFIGS[size];
  const positionConfig = POSITION_CONFIGS[position];
  // ISSUE 4 FIX: Use dynamic animation variants that respect count
  const animationVariants = getAnimationVariants(count, showZero);
  const animationVariant = animationVariants[animation];

  // Format count with max limit
  const displayCount = count > maxCount ? `${maxCount}+` : count.toString();

  return (
    <AnimatePresence>
      <motion.div
        key={`badge-${count}`} // ISSUE 4: Add key to force remount when count changes
        initial={{ scale: 0 }}
        animate={{ scale: 1, ...animationVariant.animate }}
        exit={{ scale: 0 }}
        transition={animationVariant.transition}
        className={`
          ${positionConfig}
          ${colorConfig.bg}
          ${colorConfig.text}
          ${sizeConfig.container}
          ${sizeConfig.padding}
          rounded-full
          flex items-center justify-center
          font-bold
          shadow-lg
          ${colorConfig.shadow}
          border-2 border-white
          z-10
          ${className}
        `}
      >
        {displayCount}
      </motion.div>
    </AnimatePresence>
  );
};

// Preset badge components for convenience
export const MessageBadge: React.FC<Omit<NotificationBadgeProps, 'color' | 'animation'>> = (props) => (
  <NotificationBadge {...props} {...BADGE_PRESETS.message} />
);

export const NotificationCountBadge: React.FC<Omit<NotificationBadgeProps, 'color' | 'animation'>> = (props) => (
  <NotificationBadge {...props} {...BADGE_PRESETS.notification} />
);

export const AlertBadge: React.FC<Omit<NotificationBadgeProps, 'color' | 'animation'>> = (props) => (
  <NotificationBadge {...props} {...BADGE_PRESETS.alert} />
);

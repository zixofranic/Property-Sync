'use client';

import { motion } from 'framer-motion';

interface LoadingSpinnerProps {
  progress?: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ 
  progress = 0, 
  size = 'md', 
  className = '' 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12', 
    lg: 'w-16 h-16'
  };

  const textSize = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const circumference = 2 * Math.PI * 18; // radius = 18
  const progressOffset = circumference - (progress / 100) * circumference;

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      {/* Background Circle */}
      <svg 
        className="absolute inset-0 -rotate-90 w-full h-full"
        viewBox="0 0 40 40"
      >
        <circle
          cx="20"
          cy="20"
          r="18"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          className="text-slate-600"
        />
      </svg>

      {/* Progress Circle */}
      <svg 
        className="absolute inset-0 -rotate-90 w-full h-full"
        viewBox="0 0 40 40"
      >
        <motion.circle
          cx="20"
          cy="20"
          r="18"
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          className="text-blue-500"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: progressOffset,
          }}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: progressOffset }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
      </svg>

      {/* Spinning indicator when no progress */}
      {progress === 0 && (
        <motion.div
          className="absolute inset-0 rounded-full border-3 border-transparent border-t-blue-500"
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "linear"
          }}
        />
      )}

      {/* Progress Text */}
      <div className={`absolute inset-0 flex items-center justify-center ${textSize[size]} font-bold text-white`}>
        {progress > 0 ? `${Math.round(progress)}%` : ''}
      </div>
    </div>
  );
}
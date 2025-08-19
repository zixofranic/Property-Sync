// apps/web/src/components/ui/ImageUrlInput.tsx
'use client';

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link as LinkIcon, Image, AlertCircle, CheckCircle, X } from 'lucide-react';

interface ImageUrlInputProps {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  preview?: boolean;
  previewSize?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ImageUrlInput({
  value,
  onChange,
  disabled = false,
  placeholder = "https://example.com/photo.jpg",
  label = "Image URL",
  preview = true,
  previewSize = 'md',
  className = ""
}: ImageUrlInputProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Validate URL format
  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Check if URL is likely an image
  const isImageUrl = (url: string): boolean => {
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i;
    return imageExtensions.test(url) || url.includes('image') || url.includes('photo') || url.includes('avatar');
  };

  // Handle URL input change
  const handleUrlChange = (newUrl: string) => {
    onChange(newUrl);
    setImageError(false);
    if (newUrl && isValidUrl(newUrl)) {
      setImageLoading(true);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;

    // Try to get URL from drag data
    const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    
    if (url && isValidUrl(url)) {
      handleUrlChange(url.trim());
    }
  };

  // Handle image load/error
  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };

  // Clear URL
  const handleClear = () => {
    onChange('');
    setImageError(false);
    setImageLoading(false);
  };

  // Get preview size classes
  const getPreviewSize = () => {
    switch (previewSize) {
      case 'sm': return 'w-16 h-16';
      case 'md': return 'w-24 h-24';
      case 'lg': return 'w-32 h-32';
      default: return 'w-24 h-24';
    }
  };

  // Get validation status
  const getValidationStatus = () => {
    if (!value) return null;
    if (!isValidUrl(value)) return 'invalid';
    if (imageError) return 'error';
    if (imageLoading) return 'loading';
    if (!isImageUrl(value)) return 'warning';
    return 'valid';
  };

  const validationStatus = getValidationStatus();

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-slate-300">
          {label}
        </label>
      )}

      {/* URL Input Field */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10">
          <LinkIcon className="w-4 h-4 text-slate-400" />
        </div>
        
        <input
          ref={inputRef}
          type="url"
          value={value}
          onChange={(e) => handleUrlChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className={`w-full pl-10 pr-12 py-3 bg-slate-700 border rounded-lg text-white placeholder-slate-400 focus:ring-1 transition-all ${
            disabled 
              ? 'border-slate-600 cursor-not-allowed opacity-50' 
              : isDragOver
                ? 'border-blue-400 ring-1 ring-blue-400 bg-blue-500/5'
                : validationStatus === 'invalid'
                  ? 'border-red-500 focus:border-red-400 focus:ring-red-400'
                  : validationStatus === 'error'
                    ? 'border-yellow-500 focus:border-yellow-400 focus:ring-yellow-400'
                    : 'border-slate-600 focus:border-blue-500 focus:ring-blue-500'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        />

        {/* Status Icon */}
        <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
          {value && (
            <button
              onClick={handleClear}
              disabled={disabled}
              className="p-1 hover:bg-slate-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* Drag & Drop Hint */}
      {!disabled && (
        <p className="text-xs text-slate-400">
          💡 Tip: Drag an image from any website directly into the field above
        </p>
      )}

      {/* Validation Message */}
      {validationStatus && (
        <div className="flex items-center space-x-2">
          {validationStatus === 'loading' && (
            <>
              <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-blue-400">Loading image...</span>
            </>
          )}
          {validationStatus === 'invalid' && (
            <>
              <AlertCircle className="w-3 h-3 text-red-400" />
              <span className="text-xs text-red-400">Please enter a valid URL</span>
            </>
          )}
          {validationStatus === 'error' && (
            <>
              <AlertCircle className="w-3 h-3 text-yellow-400" />
              <span className="text-xs text-yellow-400">Could not load image from this URL</span>
            </>
          )}
          {validationStatus === 'warning' && (
            <>
              <AlertCircle className="w-3 h-3 text-yellow-400" />
              <span className="text-xs text-yellow-400">URL might not be an image</span>
            </>
          )}
          {validationStatus === 'valid' && (
            <>
              <CheckCircle className="w-3 h-3 text-green-400" />
              <span className="text-xs text-green-400">Image loaded successfully</span>
            </>
          )}
        </div>
      )}

      {/* Image Preview */}
      {preview && value && isValidUrl(value) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center space-x-3"
        >
          <div className={`${getPreviewSize()} bg-slate-700 rounded-lg overflow-hidden flex-shrink-0 border border-slate-600`}>
            {imageLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : imageError ? (
              <div className="w-full h-full flex items-center justify-center">
                <Image className="w-8 h-8 text-slate-500" />
              </div>
            ) : (
              <img
                src={value}
                alt="Preview"
                className="w-full h-full object-cover"
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">Image Preview</p>
            <p className="text-xs text-slate-400 truncate">{value}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
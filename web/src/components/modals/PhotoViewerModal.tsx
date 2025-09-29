'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download } from 'lucide-react';

interface PhotoViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: string[];
  initialIndex?: number;
  propertyAddress?: string;
  onDeletePhoto?: (photoUrl: string) => void;
  isClientView?: boolean;
}

export function PhotoViewerModal({ 
  isOpen, 
  onClose, 
  images, 
  initialIndex = 0,
  propertyAddress,
  onDeletePhoto,
  isClientView = false
}: PhotoViewerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex);
      setIsZoomed(false);
    }
  }, [isOpen, initialIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case 'Delete':
          if (!isClientView && onDeletePhoto) {
            handleDelete();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, currentIndex, isClientView, onDeletePhoto]);

  const scrollToThumbnail = (index: number) => {
    if (thumbnailContainerRef.current) {
      const container = thumbnailContainerRef.current;
      const thumbnail = container.children[index] as HTMLElement;
      if (thumbnail) {
        thumbnail.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    }
  };

  const goToNext = () => {
    const newIndex = (currentIndex + 1) % images.length;
    setCurrentIndex(newIndex);
    setIsZoomed(false);
    scrollToThumbnail(newIndex);
  };

  const goToPrevious = () => {
    const newIndex = (currentIndex - 1 + images.length) % images.length;
    setCurrentIndex(newIndex);
    setIsZoomed(false);
    scrollToThumbnail(newIndex);
  };

  const toggleZoom = () => {
    setIsZoomed(!isZoomed);
  };


  const handleDelete = () => {
    if (onDeletePhoto && !isClientView) {
      const confirmDelete = confirm('Are you sure you want to delete this photo?');
      if (confirmDelete) {
        onDeletePhoto(images[currentIndex]);
        // If this was the last image, close the modal
        if (images.length <= 1) {
          onClose();
        } else {
          // Adjust current index if needed
          if (currentIndex >= images.length - 1) {
            setCurrentIndex(Math.max(0, currentIndex - 1));
          }
        }
      }
    }
  };

  const downloadImage = () => {
    const link = document.createElement('a');
    link.href = images[currentIndex];
    link.download = `property-photo-${currentIndex + 1}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen || images.length === 0) {
    console.log('PhotoViewerModal not rendering:', { isOpen, imagesLength: images.length });
    return null;
  }

  console.log('PhotoViewerModal rendering:', { isOpen, imagesLength: images.length, initialIndex });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Header */}
        <div className="fixed top-6 left-6 right-6 z-[70] space-y-3">
          {/* Address line */}
          <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/50 rounded-xl px-4 py-3">
            <h2 className="text-white font-semibold text-lg mb-1">{propertyAddress || 'Property Photos'}</h2>
            <p className="text-slate-300 text-sm">
              Photo {currentIndex + 1} of {images.length}
            </p>
          </div>

          {/* Icons line */}
          <div className="flex items-center justify-end space-x-3">
            {/* Zoom Controls */}
            <button
              onClick={toggleZoom}
              className="p-3 bg-slate-800/80 backdrop-blur-md border border-slate-700/50 hover:bg-slate-700/80 text-white rounded-xl transition-all duration-200"
              title={isZoomed ? "Zoom Out" : "Zoom In"}
            >
              {isZoomed ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
            </button>


            {/* Download */}
            <button
              onClick={downloadImage}
              className="p-3 bg-slate-800/80 backdrop-blur-md border border-slate-700/50 hover:bg-slate-700/80 text-white rounded-xl transition-all duration-200"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </button>

            {/* Delete (Agent only) */}
            {!isClientView && onDeletePhoto && images.length > 1 && (
              <button
                onClick={handleDelete}
                className="p-3 bg-red-600/80 backdrop-blur-md border border-red-500/50 hover:bg-red-500/80 text-white rounded-xl transition-all duration-200"
                title="Delete Photo"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}

            {/* Close */}
            <button
              onClick={onClose}
              className="p-3 bg-slate-800/80 backdrop-blur-md border border-slate-700/50 hover:bg-slate-700/80 text-white rounded-xl transition-all duration-200"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToPrevious();
              }}
              className="absolute left-6 top-1/2 -translate-y-1/2 p-4 bg-slate-800/80 backdrop-blur-md border border-slate-700/50 hover:bg-slate-700/80 text-white rounded-xl transition-all duration-200 z-60"
              title="Previous (←)"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              className="absolute right-6 top-1/2 -translate-y-1/2 p-4 bg-slate-800/80 backdrop-blur-md border border-slate-700/50 hover:bg-slate-700/80 text-white rounded-xl transition-all duration-200 z-60"
              title="Next (→)"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Main Image */}
        <motion.div
          key={currentIndex}
          initial={{ x: 100, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -100, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex items-center justify-center w-full h-full p-8"
        >
          <img
            src={images[currentIndex]}
            alt={`Property photo ${currentIndex + 1}`}
            className={`max-w-full max-h-full object-contain transition-all duration-500 ease-out ${
              isZoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'
            }`}
            onClick={toggleZoom}
            onError={(e) => {
              console.error('Error loading image:', images[currentIndex]);
              e.currentTarget.src = '/api/placeholder/800/600';
            }}
          />
        </motion.div>

        {/* Thumbnail Strip (Bottom) - Hidden scrollbar with fade edges */}
        {images.length > 1 && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-full max-w-4xl px-8">
            <div className="relative">
              {/* Left fade */}
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-gray-900/60 to-transparent z-10 pointer-events-none rounded-l-xl" />
              {/* Right fade */}
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-900/60 to-transparent z-10 pointer-events-none rounded-r-xl" />
              
              {/* Thumbnail container with hidden scrollbar */}
              <div 
                ref={thumbnailContainerRef}
                className="flex space-x-3 overflow-x-auto scrollbar-hide pb-2" 
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none'
                }}
              >
                {images.map((image, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setCurrentIndex(index);
                      setIsZoomed(false);
                      scrollToThumbnail(index);
                    }}
                    className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all duration-300 transform hover:scale-105 bg-gray-400/20 ${
                      index === currentIndex 
                        ? 'border-blue-400 shadow-lg shadow-blue-400/50 scale-105' 
                        : 'border-white/20 hover:border-white/50'
                    }`}
                  >
                    <img
                      src={image}
                      alt={`Thumbnail ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Keyboard Shortcuts Help */}
        <div className="absolute bottom-6 right-4 text-white/60 text-xs">
          <div>← → Navigate • Esc Close • Click Zoom</div>
          {!isClientView && <div>Del Delete Photo</div>}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
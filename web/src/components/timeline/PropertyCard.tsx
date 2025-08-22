'use client';

// apps/web/src/components/timeline/PropertyCard.tsx
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, MessageCircle, X, ExternalLink, MapPin, DollarSign, ChevronLeft, ChevronRight, Bed, Bath, Square } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Property } from '@/stores/missionControlStore';

interface PropertyCardProps {
  property: Property;
  onFeedback?: (propertyId: string, feedback: 'love' | 'like' | 'dislike', notes?: string) => void;
  onViewMLS?: (mlsLink: string) => void;
  onDelete?: (propertyId: string) => void;
  isClientView?: boolean;
  index: number;
  isAlternating?: boolean;
}

export function PropertyCard({ 
  property, 
  onFeedback, 
  onViewMLS, 
  onDelete,
  isClientView = false,
  index,
  isAlternating = false
}: PropertyCardProps) {
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackNotes, setFeedbackNotes] = useState(property.notes || '');
  const [selectedFeedback, setSelectedFeedback] = useState<'love' | 'like' | 'dislike' | null>(
    property.clientFeedback || null
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Get all images (handle both single imageUrl and multiple imageUrls)
  const images = property.imageUrls?.length > 0 
    ? property.imageUrls 
    : property.imageUrl 
    ? [property.imageUrl]
    : ['/api/placeholder/400/300'];

  const hasMultipleImages = images.length > 1;
  
  // Loading state - check if property is still parsing
  const isLoading = property.loadingProgress < 100 || !property.isFullyParsed;

  const handleFeedbackSubmit = (feedback: 'love' | 'like' | 'dislike') => {
    setSelectedFeedback(feedback);
    if (onFeedback) {
      onFeedback(property.id, feedback, feedbackNotes);
    }
    setShowFeedbackForm(false);
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(property.id);
      setShowDeleteConfirm(false);
    }
  };

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) { // 24 hours
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  const getFeedbackColor = (feedback: string) => {
    switch (feedback) {
      case 'love': return 'from-pink-500 to-rose-500';
      case 'like': return 'from-green-500 to-emerald-500';
      case 'dislike': return 'from-red-500 to-rose-500';
      default: return 'from-gray-500 to-slate-500';
    }
  };

  const getFeedbackText = (feedback: string) => {
    switch (feedback) {
      case 'love': return 'Love It! ❤️';
      case 'like': return 'Let\'s Talk 💬';
      case 'dislike': return 'Not for Me ❌';
      default: return '';
    }
  };

  // Calculate position for alternating layout
  const isEven = index % 2 === 0;
  const isLeft = isAlternating && isEven;

  return (
    <motion.div
      initial={{ opacity: 0, x: isAlternating ? (isLeft ? -50 : 50) : -50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`relative ${
        isAlternating 
          ? `flex ${isLeft ? 'flex-row' : 'flex-row-reverse'} items-center justify-center lg:justify-start w-full`
          : 'flex items-start'
      }`}
    >
      {/* Timeline Dot */}
      {isAlternating && (
        <div className="hidden lg:flex absolute left-1/2 top-8 transform -translate-x-1/2 z-20">
          <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full border-4 border-slate-900 flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          </div>
        </div>
      )}

      {/* Regular Timeline Dot for non-alternating */}
      {!isAlternating && (
        <div className="relative z-10 flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full shadow-lg">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
            <div className="w-3 h-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full" />
          </div>
        </div>
      )}

      {/* Property Card */}
      <motion.div
        className={`${isAlternating ? 'w-full lg:w-[calc(50%-2rem)] flex-shrink-0' : 'ml-6 flex-1'} bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden hover:bg-slate-700/50 transition-all duration-300`}
        whileHover={{ scale: 1.02, x: isAlternating ? 0 : 10 }}
      >
        {/* Property Image - BIGGER WITH OVERLAYS */}
        <div className="relative h-80 bg-slate-700">
          <img
            src={images[currentImageIndex]}
            alt={property.address}
            className="w-full h-full object-cover"
          />
          
          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-10">
              <LoadingSpinner progress={property.loadingProgress} />
            </div>
          )}
          
          {/* Image Navigation Arrows */}
          {hasMultipleImages && !isLoading && (
            <>
              <button
                onClick={() => setCurrentImageIndex((prev) => prev === 0 ? images.length - 1 : prev - 1)}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all duration-200 z-20"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentImageIndex((prev) => prev === images.length - 1 ? 0 : prev + 1)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all duration-200 z-20"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              
              {/* Image Dots Indicator */}
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex space-x-2 z-20">
                {images.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all duration-200 ${
                      index === currentImageIndex 
                        ? 'bg-white' 
                        : 'bg-white/50 hover:bg-white/70'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
          
          {/* Dark Gradient Overlay for Text Readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />
          
          {/* Address - Top Left with Google Maps link */}
          <div className="absolute top-4 left-4">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white font-bold text-lg leading-tight drop-shadow-lg hover:text-blue-200 transition-colors inline-block"
            >
              {property.address}
            </a>
          </div>

          {/* Price - Bottom Right */}
          <div className="absolute bottom-4 right-4">
            <p className="text-white text-2xl font-bold drop-shadow-lg">
              ${property.price.toLocaleString()}
            </p>
          </div>

          {/* View Details Button - Bottom Left */}
          {property.mlsLink && (
            <div className="absolute bottom-4 left-4">
              <button
                onClick={() => onViewMLS && onViewMLS(property.mlsLink!)}
                className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg"
              >
                <ExternalLink className="w-4 h-4" />
                <span>View Details</span>
              </button>
            </div>
          )}
        </div>

        {/* Property Details */}
        <div className="p-6">
          {/* Property Stats - Beds/Baths/SqFt */}
          {(property.bedrooms || property.bathrooms || property.squareFootage) && (
            <div className="flex items-center justify-center space-x-6 mb-6 p-4 bg-slate-700/30 rounded-xl border border-slate-600/30">
              {property.bedrooms && (
                <div className="flex items-center space-x-2 text-slate-300">
                  <Bed className="w-5 h-5 text-blue-400" />
                  <span className="font-semibold">{property.bedrooms}</span>
                  <span className="text-sm opacity-80">{property.bedrooms === 1 ? 'bed' : 'beds'}</span>
                </div>
              )}
              {property.bathrooms && (
                <div className="flex items-center space-x-2 text-slate-300">
                  <Bath className="w-5 h-5 text-teal-400" />
                  <span className="font-semibold">{property.bathrooms}</span>
                  <span className="text-sm opacity-80">{property.bathrooms === 1 ? 'bath' : 'baths'}</span>
                </div>
              )}
              {property.squareFootage && (
                <div className="flex items-center space-x-2 text-slate-300">
                  <Square className="w-5 h-5 text-purple-400" />
                  <span className="font-semibold">{property.squareFootage.toLocaleString()}</span>
                  <span className="text-sm opacity-80">sq ft</span>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {property.description && (
            <div className="mb-4">
              <p className="text-slate-300 text-lg leading-relaxed font-medium">
                {property.description}
              </p>
            </div>
          )}

          {/* Client View: Feedback Buttons */}
          {isClientView && (
            <div className="space-y-4">
              <div className="border-t border-slate-600 pt-4">
                <p className="text-slate-300 text-sm mb-3 font-medium">
                  How do you feel about this property?
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <motion.button
                    onClick={() => handleFeedbackSubmit('love')}
                    className={`p-6 rounded-2xl text-base font-bold transition-all duration-300 transform ${
                      selectedFeedback === 'love'
                        ? 'bg-gradient-to-br from-pink-500 via-rose-500 to-red-500 text-white scale-105 shadow-2xl'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-gradient-to-br hover:from-pink-500/20 hover:via-rose-500/20 hover:to-red-500/20 hover:text-pink-400 hover:scale-105 shadow-lg hover:shadow-pink-500/25'
                    }`}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Heart className="w-8 h-8 mx-auto mb-3" fill={selectedFeedback === 'love' ? 'currentColor' : 'none'} />
                    <div className="text-center">
                      <div className="font-bold text-lg">Love It!</div>
                      <div className="text-sm opacity-80">Perfect match</div>
                    </div>
                  </motion.button>

                  <motion.button
                    onClick={() => handleFeedbackSubmit('like')}
                    className={`p-6 rounded-2xl text-base font-bold transition-all duration-300 transform ${
                      selectedFeedback === 'like'
                        ? 'bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 text-white scale-105 shadow-2xl'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-gradient-to-br hover:from-emerald-500/20 hover:via-green-500/20 hover:to-teal-500/20 hover:text-emerald-400 hover:scale-105 shadow-lg hover:shadow-emerald-500/25'
                    }`}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <MessageCircle className="w-8 h-8 mx-auto mb-3" fill={selectedFeedback === 'like' ? 'currentColor' : 'none'} />
                    <div className="text-center">
                      <div className="font-bold text-lg">Let's Talk</div>
                      <div className="text-sm opacity-80">Schedule a visit</div>
                    </div>
                  </motion.button>

                  <motion.button
                    onClick={() => handleFeedbackSubmit('dislike')}
                    className={`p-6 rounded-2xl text-base font-bold transition-all duration-300 transform ${
                      selectedFeedback === 'dislike'
                        ? 'bg-gradient-to-br from-orange-500 via-red-500 to-rose-500 text-white scale-105 shadow-2xl'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-gradient-to-br hover:from-orange-500/20 hover:via-red-500/20 hover:to-rose-500/20 hover:text-orange-400 hover:scale-105 shadow-lg hover:shadow-orange-500/25'
                    }`}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <X className="w-8 h-8 mx-auto mb-3" />
                    <div className="text-center">
                      <div className="font-bold text-lg">Not for Me</div>
                      <div className="text-sm opacity-80">Keep searching</div>
                    </div>
                  </motion.button>
                </div>
              </div>

              {/* Feedback Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Your thoughts (optional):
                </label>
                <textarea
                  value={feedbackNotes}
                  onChange={(e) => setFeedbackNotes(e.target.value)}
                  placeholder="Share your thoughts about this property..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                />
                
                {feedbackNotes && (
                  <motion.button
                    onClick={() => onFeedback && onFeedback(property.id, selectedFeedback || 'like', feedbackNotes)}
                    className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    💾 Save Feedback
                  </motion.button>
                )}
              </div>
            </div>
          )}

          {/* Agent View: Show Client Feedback */}
          {!isClientView && selectedFeedback && (
            <div className="border-t border-slate-600 pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-300">Client Feedback:</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium text-white bg-gradient-to-r ${getFeedbackColor(selectedFeedback)}`}>
                  {getFeedbackText(selectedFeedback)}
                </span>
              </div>
              
              {property.notes && (
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <p className="text-sm text-slate-300 italic">"{property.notes}"</p>
                </div>
              )}
            </div>
          )}

          {/* Property Meta */}
          <div className="mt-4 pt-3 border-t border-slate-600 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center space-x-4">
              <span className="text-blue-400 font-medium">{formatRelativeTime(property.addedAt)}</span>
            </div>
            
            {/* Agent Delete Button - Bottom Right */}
            {!isClientView && onDelete && (
              <div className="relative">
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center space-x-1 px-2 py-1 bg-red-600/50 hover:bg-red-500 text-red-300 hover:text-white rounded text-xs transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Delete</span>
                  </button>
                ) : (
                  <div className="flex items-center space-x-1">
                    <span className="text-red-400 text-xs font-medium">Confirm:</span>
                    <button
                      onClick={handleDelete}
                      className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-2 py-1 bg-slate-600 hover:bg-slate-500 text-white rounded text-xs transition-colors"
                    >
                      No
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
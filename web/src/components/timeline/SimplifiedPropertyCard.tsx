// apps/web/src/components/dashboard/SimplifiedPropertyCard.tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Heart, 
  ThumbsUp, 
  ThumbsDown, 
  ExternalLink, 
  MapPin, 
  DollarSign,
  MessageCircle,
  MoreVertical,
  Edit,
  Trash2
} from 'lucide-react';

interface Property {
  id: string;
  address: string;
  price: number;
  description: string;
  imageUrl: string;
  mlsLink?: string;
  clientFeedback?: 'love' | 'like' | 'dislike';
  notes?: string;
}

interface SimplifiedPropertyCardProps {
  property: Property;
  onFeedback: (propertyId: string, feedback: 'love' | 'like' | 'dislike', notes?: string) => void;
  onViewMLS: (mlsLink: string, address: string) => void;
  onEdit?: (propertyId: string) => void;
  onDelete?: (propertyId: string) => void;
  isClientView?: boolean;
  index: number;
  isAlternating?: boolean;
}

export function SimplifiedPropertyCard({ 
  property, 
  onFeedback, 
  onViewMLS, 
  onEdit,
  onDelete,
  isClientView = false, 
  index,
  isAlternating = false 
}: SimplifiedPropertyCardProps) {
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackNotes, setFeedbackNotes] = useState('');
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  const isEven = index % 2 === 0;
  const isLeft = isAlternating && isEven;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const handleFeedback = (feedback: 'love' | 'like' | 'dislike') => {
    onFeedback(property.id, feedback, feedbackNotes);
    setShowFeedbackForm(false);
    setFeedbackNotes('');
  };

  const handleEdit = () => {
    setShowActionsMenu(false);
    onEdit?.(property.id);
  };

  const handleDelete = () => {
    setShowActionsMenu(false);
    if (window.confirm(`Delete "${property.address}"?\n\nThis action cannot be undone.`)) {
      onDelete?.(property.id);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={`relative ${
        isAlternating 
          ? `flex ${isLeft ? 'flex-row' : 'flex-row-reverse'} items-center space-x-8`
          : 'w-full'
      }`}
    >
      {/* Timeline Dot */}
      {isAlternating && (
        <div className="hidden md:flex absolute left-1/2 top-8 transform -translate-x-1/2 z-10">
          <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full border-4 border-slate-900 flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          </div>
        </div>
      )}

      {/* Property Card */}
      <motion.div
        className={`group relative bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl hover:shadow-3xl transition-all duration-300 ${
          isAlternating 
            ? 'w-full md:w-[calc(50%-2rem)] flex-shrink-0'
            : 'w-full max-w-2xl mx-auto'
        }`}
        whileHover={{ y: -4, scale: 1.02 }}
      >
        {/* Edit/Delete Menu */}
        {!isClientView && (onEdit || onDelete) && (
          <div className="absolute top-4 right-4 z-20">
            <div className="relative">
              <motion.button
                onClick={() => setShowActionsMenu(!showActionsMenu)}
                className="p-2 rounded-lg bg-slate-800/80 backdrop-blur-sm border border-slate-600/50 text-slate-400 hover:text-white hover:bg-slate-700/80 transition-all duration-200 opacity-0 group-hover:opacity-100"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                <MoreVertical className="w-4 h-4" />
              </motion.button>

              <AnimatePresence>
                {showActionsMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden z-30"
                  >
                    {onEdit && (
                      <button
                        onClick={handleEdit}
                        className="w-full px-4 py-3 text-left text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors flex items-center space-x-3"
                      >
                        <Edit className="w-4 h-4" />
                        <span>Edit Property</span>
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={handleDelete}
                        className="w-full px-4 py-3 text-left text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors flex items-center space-x-3 border-t border-slate-600"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Delete Property</span>
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Image Section */}
        <div className="relative h-64 overflow-hidden">
          <img
            src={property.imageUrl}
            alt={property.address}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          
          {/* Price Badge */}
          <div className="absolute bottom-4 left-4">
            <div className="flex items-center space-x-2 bg-white/95 backdrop-blur-sm text-slate-900 px-4 py-2 rounded-xl font-bold shadow-lg">
              <DollarSign className="w-5 h-5" />
              <span className="text-lg">{formatPrice(property.price)}</span>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6">
          {/* Address */}
          <div className="flex items-start space-x-3 mb-4">
            <MapPin className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
            <h3 className="font-bold text-white text-xl leading-tight">
              {property.address}
            </h3>
          </div>

          {/* Description */}
          <p className="text-slate-300 leading-relaxed mb-6">
            {property.description}
          </p>

          {/* MLS Button */}
          {property.mlsLink && (
            <div className="mb-6">
              <motion.button
                onClick={() => onViewMLS(property.mlsLink!, property.address)}
                className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-lg"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <ExternalLink className="w-5 h-5" />
                <span>View Details</span>
              </motion.button>
            </div>
          )}

          {/* Client Feedback Section */}
          {isClientView && (
            <div className="border-t border-slate-700 pt-6">
              {!property.clientFeedback ? (
                <div className="space-y-4">
                  <p className="text-slate-400 font-medium">What do you think about this property?</p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <motion.button
                      onClick={() => handleFeedback('love')}
                      className="flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-400 hover:to-pink-500 text-white rounded-xl transition-all duration-200 font-medium"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Heart className="w-5 h-5" />
                      <span>Love It!</span>
                    </motion.button>
                    
                    <motion.button
                      onClick={() => handleFeedback('like')}
                      className="flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white rounded-xl transition-all duration-200 font-medium"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <ThumbsUp className="w-5 h-5" />
                      <span>Let's Talk</span>
                    </motion.button>
                    
                    <motion.button
                      onClick={() => setShowFeedbackForm(!showFeedbackForm)}
                      className="flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 text-white rounded-xl transition-all duration-200 font-medium"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <ThumbsDown className="w-5 h-5" />
                      <span>Not for Me</span>
                    </motion.button>
                  </div>

                  <AnimatePresence>
                    {showFeedbackForm && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-3 overflow-hidden"
                      >
                        <textarea
                          value={feedbackNotes}
                          onChange={(e) => setFeedbackNotes(e.target.value)}
                          placeholder="Tell us what you're looking for instead..."
                          className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 resize-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          rows={3}
                        />
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => handleFeedback('dislike')}
                            className="px-6 py-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white rounded-lg font-medium transition-colors"
                          >
                            Submit Feedback
                          </button>
                          <button
                            onClick={() => {
                              setShowFeedbackForm(false);
                              setFeedbackNotes('');
                            }}
                            className="px-6 py-2 text-slate-400 hover:text-white transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                /* Existing Feedback Display */
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    {property.clientFeedback === 'love' && (
                      <>
                        <div className="p-2 bg-red-500/20 rounded-full">
                          <Heart className="w-5 h-5 text-red-400" />
                        </div>
                        <span className="text-red-400 font-semibold">Loved this property!</span>
                      </>
                    )}
                    {property.clientFeedback === 'like' && (
                      <>
                        <div className="p-2 bg-green-500/20 rounded-full">
                          <ThumbsUp className="w-5 h-5 text-green-400" />
                        </div>
                        <span className="text-green-400 font-semibold">Interested in talking</span>
                      </>
                    )}
                    {property.clientFeedback === 'dislike' && (
                      <>
                        <div className="p-2 bg-orange-500/20 rounded-full">
                          <ThumbsDown className="w-5 h-5 text-orange-400" />
                        </div>
                        <span className="text-orange-400 font-semibold">Not the right fit</span>
                      </>
                    )}
                  </div>
                  
                  {property.notes && (
                    <div className="bg-slate-700/50 border border-slate-600/50 rounded-xl p-4">
                      <div className="flex items-start space-x-3">
                        <MessageCircle className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                        <p className="text-slate-300 leading-relaxed">{property.notes}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Agent View - Show existing feedback */}
          {!isClientView && property.clientFeedback && (
            <div className="border-t border-slate-700 pt-6">
              <div className="flex items-center space-x-3 mb-3">
                {property.clientFeedback === 'love' && (
                  <>
                    <div className="p-2 bg-red-500/20 rounded-full">
                      <Heart className="w-5 h-5 text-red-400" />
                    </div>
                    <span className="text-red-400 font-semibold">Client loves this!</span>
                  </>
                )}
                {property.clientFeedback === 'like' && (
                  <>
                    <div className="p-2 bg-green-500/20 rounded-full">
                      <ThumbsUp className="w-5 h-5 text-green-400" />
                    </div>
                    <span className="text-green-400 font-semibold">Client is interested</span>
                  </>
                )}
                {property.clientFeedback === 'dislike' && (
                  <>
                    <div className="p-2 bg-orange-500/20 rounded-full">
                      <ThumbsDown className="w-5 h-5 text-orange-400" />
                    </div>
                    <span className="text-orange-400 font-semibold">Not a match</span>
                  </>
                )}
              </div>
              
              {property.notes && (
                <div className="bg-slate-700/30 border border-slate-600/30 rounded-xl p-4">
                  <p className="text-slate-300 leading-relaxed italic">
                    "{property.notes}"
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Close menu when clicking outside */}
      {showActionsMenu && (
        <div 
          className="fixed inset-0 z-10" 
          onClick={() => setShowActionsMenu(false)}
        />
      )}
    </motion.div>
  );
}
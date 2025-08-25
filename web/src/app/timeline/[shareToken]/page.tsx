// apps/web/src/app/timeline/[shareToken]/page.tsx
'use client';

import { use, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Share2, Lock, Heart, MessageSquare, X, Phone, Mail, MapPin, ExternalLink, Eye, Calendar, Clock, Sparkles } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { NewPropertiesNotification } from '@/components/notifications/NewPropertiesNotification';
import { useNotificationStore, createNewPropertiesNotification } from '@/stores/notificationStore';
import { initializePushNotifications } from '@/lib/push-notifications';
import { AgentCard } from '@/components/agent/AgentCard';

// API Response Types
interface ClientTimelineData {
  timeline: {
    id: string;
    title: string;
    description: string;
    shareToken: string;
    totalViews: number;
    lastViewed: string | null;
  };
  client: {
    firstName: string;
    lastName: string;
    email: string;
  };
  agent: {
    name: string;
    company: string;
    phone?: string;
    email: string;
    logo?: string;
    brandColor: string;
  };
  properties: Array<{
    id: string;
    mlsId?: string;
    address: string;
    city?: string;
    state?: string;
    zipCode?: string;
    price: number;
    bedrooms?: number;
    bathrooms?: number;
    squareFootage?: number;
    propertyType?: string;
    description: string;
    imageUrls: string[];
    listingUrl?: string;
    isViewed: boolean;
    viewedAt?: string;
    createdAt: string;
    feedback: Array<{
      id: string;
      feedback: 'love' | 'like' | 'dislike';
      notes?: string;
      createdAt: string;
    }>;
  }>;
  isAuthenticated: boolean;
  authRequired: boolean;
}

interface ClientAuthForm {
  clientName: string;
  phoneLastFour: string;
}

// Property Status Types
type PropertyStatus = 'new' | 'unseen' | 'viewed';

export default function ClientTimelineView({ params }: { params: Promise<{ shareToken: string }> }) {
  // Fix Next.js 15 params Promise issue
  const resolvedParams = use(params);
  const shareToken = resolvedParams.shareToken;

  const [timelineData, setTimelineData] = useState<ClientTimelineData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authForm, setAuthForm] = useState<ClientAuthForm>({ clientName: '', phoneLastFour: '' });
  const [authError, setAuthError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [feedbackNotes, setFeedbackNotes] = useState<Record<string, string>>({});
  const [selectedFeedback, setSelectedFeedback] = useState<Record<string, 'love' | 'like' | 'dislike' | null>>({});
  const [mlsModal, setMlsModal] = useState<{ isOpen: boolean; url: string; address: string }>({
    isOpen: false,
    url: '',
    address: ''
  });
  const [showNotification, setShowNotification] = useState<{ show: boolean; message: string }>({
    show: false,
    message: ''
  });
  
  // Notification store
  const { 
    addNotification, 
    getVisibleNotifications, 
    hasNewPropertiesNotification,
    dismissNotification,
    settings 
  } = useNotificationStore();
  const [previousPropertyCount, setPreviousPropertyCount] = useState<number>(0);
  const [showNewPropertiesBanner, setShowNewPropertiesBanner] = useState(false);

  // Utility: Calculate property status (new/unseen/viewed)
  const getPropertyStatus = (property: any): PropertyStatus => {
    const now = new Date();
    const createdAt = new Date(property.createdAt);
    const hoursOld = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));
    
    // Has feedback = viewed (no icon needed)
    if (property.feedback && property.feedback.length > 0) {
      return 'viewed';
    }
    
    // Less than 12 hours = new
    if (hoursOld < 12) {
      return 'new';
    }
    
    // More than 12 hours but no feedback = unseen
    return 'unseen';
  };

  // Component: Flashing Notification Icon
  const FlashingNotificationIcon = ({ status, className = "" }: { status: PropertyStatus; className?: string }) => {
    if (status === 'viewed') return null;
    
    const isNew = status === 'new';
    
    return (
      <motion.div
        className={`absolute z-30 ${className}`}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", duration: 0.5 }}
      >
        <div className="flex flex-col items-center space-y-1">
          <div className={`relative ${isNew ? 'w-6 h-6' : 'w-5 h-5'}`}>
            {/* Pulsing background */}
            <div 
              className={`absolute inset-0 rounded-full ${
                isNew 
                  ? 'bg-green-400 animate-ping' 
                  : 'bg-yellow-400 animate-pulse'
              }`}
            />
            {/* Solid icon */}
            <div 
              className={`relative w-full h-full rounded-full flex items-center justify-center ${
                isNew 
                  ? 'bg-green-500 text-white' 
                  : 'bg-yellow-500 text-white'
              }`}
            >
              {isNew ? (
                <Sparkles className="w-3 h-3" />
              ) : (
                <Eye className="w-3 h-3" />
              )}
            </div>
          </div>
          
          {/* NEW label for new properties only */}
          {isNew && (
            <div className="bg-green-500 text-white px-1.5 py-0.5 rounded text-xs font-bold tracking-wide">
              NEW
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  // Initialize push notifications
  useEffect(() => {
    if (typeof window !== 'undefined') {
      initializePushNotifications();
    }
  }, []);

  // Fetch timeline data
  useEffect(() => {
    const fetchTimelineData = async () => {
      try {
        setIsLoading(true);
        
        // Extract client code from URL params
        const urlParams = new URLSearchParams(window.location.search);
        const clientCode = urlParams.get('client');
        
        const response = await apiClient.getPublicTimeline(shareToken, clientCode, sessionToken);
        
        if (response.error) {
          throw new Error(response.error);
        }
        
        const newData = response.data;
        
        // Check for new properties if we have previous data
        if (timelineData && newData && isAuthenticated) {
          const newPropertyCount = newData.properties.length;
          const oldPropertyCount = timelineData.properties.length;
          const newPropertiesAdded = newPropertyCount - oldPropertyCount;
          
          if (newPropertiesAdded > 0 && settings.bannerNotifications && settings.newProperties) {
            // Create notification
            addNotification(createNewPropertiesNotification(
              newData.timeline.id,
              newData.timeline.title,
              newData.agent.name,
              newPropertiesAdded,
              newPropertyCount
            ));
            
            setShowNewPropertiesBanner(true);
          }
        }
        
        setTimelineData(newData);
        setIsAuthenticated(newData?.isAuthenticated || false);
        
        // Track timeline view if authenticated
        if (newData?.isAuthenticated) {
          await apiClient.trackTimelineView(shareToken, { source: 'client_access' });
        }
        
      } catch (error) {
        console.error('Failed to fetch timeline data:', error);
        setTimelineData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTimelineData();
  }, [shareToken, sessionToken]);

  // Handle client authentication
  const handleAuthentication = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    try {
      const response = await apiClient.authenticateClientAccess(
        shareToken,
        authForm.clientName,
        authForm.phoneLastFour
      );

      if (response.error) {
        setAuthError(response.error || 'Invalid credentials');
        return;
      }

      setSessionToken(response.data.sessionToken);
      setIsAuthenticated(true);
      
    } catch (error) {
      console.error('Authentication failed:', error);
      setAuthError('Authentication failed. Please try again.');
    }
  };

  // Handle feedback button click
  const handleFeedbackButtonClick = (propertyId: string, feedback: 'love' | 'like' | 'dislike') => {
    setSelectedFeedback(prev => ({ ...prev, [propertyId]: feedback }));
  };

  // Handle property feedback submission
  const handleSubmitFeedback = async (propertyId: string) => {
    if (!timelineData || !isAuthenticated || !selectedFeedback[propertyId]) return;

    try {
      // Extract client code from URL params
      const urlParams = new URLSearchParams(window.location.search);
      const clientCode = urlParams.get('client');
      
      const response = await apiClient.submitPropertyFeedback(
        shareToken,
        propertyId,
        selectedFeedback[propertyId],
        feedbackNotes[propertyId] || '',
        clientCode,
        `${timelineData.client.firstName} ${timelineData.client.lastName}`,
        timelineData.client.email
      );

      if (response.error) {
        throw new Error(response.error);
      }

      // Update local state - this will remove the flashing icon
      setTimelineData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          properties: prev.properties.map(property =>
            property.id === propertyId
              ? {
                  ...property,
                  feedback: [{
                    id: Date.now().toString(),
                    feedback: selectedFeedback[propertyId]!,
                    notes: feedbackNotes[propertyId] || '',
                    createdAt: new Date().toISOString()
                  }]
                }
              : property
          )
        };
      });

      // Clear feedback selections for this property
      setFeedbackNotes(prev => ({ ...prev, [propertyId]: '' }));
      setSelectedFeedback(prev => ({ ...prev, [propertyId]: null }));

    } catch (error) {
      console.error('Failed to submit feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    }
  };

  // Handle MLS button click
  const handleMLSClick = (property: any) => {
    if (property.listingUrl) {
      setMlsModal({
        isOpen: true,
        url: property.listingUrl,
        address: property.address
      });
    }
  };

  // Smart email handling with fallback
  const handleSmartEmail = async () => {
    if (!timelineData?.agent.email) return;

    const mailtoLink = `mailto:${timelineData.agent.email}?subject=Question about properties from ${timelineData.client.firstName}&body=Hi ${timelineData.agent.name},

I have some questions about the properties you shared with me in my timeline.

Best regards,
${timelineData.client.firstName} ${timelineData.client.lastName}`;

    // Check if we're on mobile or if mailto is likely to work
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isEmailAppLikely = isMobile || navigator.userAgent.includes('Mail') || navigator.userAgent.includes('Outlook');

    try {
      if (isEmailAppLikely) {
        // Try mailto on mobile or when email app is detected
        window.location.href = mailtoLink;
        
        // Set a timeout to check if mailto failed (user stayed on page)
        setTimeout(() => {
          // If still on the same page, assume mailto failed and show fallback
          setShowNotification({
            show: true,
            message: `Email app not found. Email copied to clipboard: ${timelineData.agent.email}`
          });
          navigator.clipboard.writeText(timelineData.agent.email);
        }, 1000);
      } else {
        // Desktop fallback: Copy email and show notification
        await navigator.clipboard.writeText(timelineData.agent.email);
        setShowNotification({
          show: true,
          message: `📧 Email copied to clipboard! Open your email app and paste: ${timelineData.agent.email}`
        });
      }
    } catch (error) {
      // Clipboard failed, show email address
      setShowNotification({
        show: true,
        message: `📧 Agent email: ${timelineData.agent.email}`
      });
    }

    // Auto-hide notification after 5 seconds
    setTimeout(() => {
      setShowNotification({ show: false, message: '' });
    }, 5000);
  };

  // Hide notification manually
  const hideNotification = () => {
    setShowNotification({ show: false, message: '' });
  };

  // Format date for timeline
  const formatTimelineDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Format time for timeline
  const formatTimelineTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true
    });
  };

  // Format relative time
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

  // Check if this is the first property of the day
  const isFirstPropertyOfDay = (properties: any[], currentIndex: number) => {
    if (currentIndex === 0) return true;
    
    const currentDate = new Date(properties[currentIndex].createdAt).toDateString();
    const previousDate = new Date(properties[currentIndex - 1].createdAt).toDateString();
    
    return currentDate !== previousDate;
  };

  // Get Google Maps URL
  const getGoogleMapsUrl = (address: string) => {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading your property timeline...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (!timelineData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <Home className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Timeline Not Found</h1>
          <p className="text-slate-400">This timeline may have been removed or the link has expired.</p>
        </div>
      </div>
    );
  }

  // Authentication required
  if (timelineData.authRequired && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 rounded-xl p-8"
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Access Your Timeline</h1>
              <p className="text-slate-400">
                Enter your details to view your personalized property timeline
              </p>
            </div>

            <form onSubmit={handleAuthentication} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Your First Name
                </label>
                <input
                  type="text"
                  value={authForm.clientName}
                  onChange={(e) => setAuthForm(prev => ({ ...prev, clientName: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  placeholder="Enter your first name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Last 4 Digits of Phone
                </label>
                <input
                  type="text"
                  value={authForm.phoneLastFour}
                  onChange={(e) => setAuthForm(prev => ({ ...prev, phoneLastFour: e.target.value.replace(/[^\d]/g, '').slice(0, 4) }))}
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  placeholder="1234"
                  maxLength={4}
                  required
                />
              </div>

              {authError && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                >
                  <p className="text-red-400 text-sm">{authError}</p>
                </motion.div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-medium transition-all duration-200 hover:scale-[1.02] shadow-lg"
              >
                Access Timeline
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-800/50 text-center">
              <p className="text-slate-500 text-sm">
                Having trouble? Contact {timelineData.agent.name} • REALTOR® directly
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Main timeline view - RESPONSIVE DESIGN FIXED
  const sortedProperties = [...timelineData.properties].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Group properties by date like agent dashboard
  const groupPropertiesByDate = (properties: any[]) => {
    const groups: { [key: string]: any[] } = {};
    
    properties.forEach(property => {
      if (!property.createdAt) return;
      
      try {
        const date = new Date(property.createdAt).toDateString();
        if (!groups[date]) {
          groups[date] = [];
        }
        groups[date].push(property);
      } catch (error) {
        console.warn('Invalid date for property:', property.id, property.createdAt);
      }
    });
    
    return groups;
  };

  const groupedProperties = groupPropertiesByDate(sortedProperties);

  // Get current new properties notification
  const visibleNotifications = getVisibleNotifications();
  const newPropertiesNotification = visibleNotifications.find(n => 
    n.type === 'new-properties' && 
    n.timelineId === timelineData?.timeline.id &&
    !n.isRead
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* New Properties Notification Banner */}
      {newPropertiesNotification && (
        <NewPropertiesNotification
          count={newPropertiesNotification.count || 0}
          timelineTitle={newPropertiesNotification.timelineTitle}
          onDismiss={() => {
            dismissNotification(newPropertiesNotification.id);
            setShowNewPropertiesBanner(false);
          }}
          onViewClick={() => {
            dismissNotification(newPropertiesNotification.id);
            setShowNewPropertiesBanner(false);
            // Scroll to the newest properties
            const firstProperty = document.querySelector('[data-property-card]');
            if (firstProperty) {
              firstProperty.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
        />
      )}

      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {timelineData.agent.logo && (
                <img
                  src={timelineData.agent.logo}
                  alt={timelineData.agent.company}
                  className="h-10 w-auto"
                />
              )}
              <div>
                <h1 className="text-xl font-bold text-white">
                  {timelineData.timeline.title}
                </h1>
                <p className="text-sm text-slate-400">
                  Curated just for you by {timelineData.agent.name} • REALTOR®
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <span className="text-sm text-slate-400">
                {timelineData.properties.length} properties
              </span>
              <button
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: `Properties for ${timelineData.client.firstName} ${timelineData.client.lastName}`,
                      url: window.location.href,
                    });
                  } else {
                    navigator.clipboard.writeText(window.location.href);
                    alert('Link copied!');
                  }
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-white rounded-xl transition-all duration-200 border border-slate-700/50 shadow-lg"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - RESPONSIVE TIMELINE FIXED */}
      <div className="pt-28 px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <h1 className="text-4xl font-bold text-white mb-4">
                Welcome, {timelineData.client.firstName}! 👋
              </h1>
              <p className="text-slate-400 max-w-2xl mx-auto text-lg">
                I&apos;ve personally selected these properties based on your preferences. 
                Take your time reviewing each one, add your notes, and share your feedback.
              </p>
            </motion.div>
          </div>

          {sortedProperties.length > 0 ? (
            <div className="relative">
              {/* Center Timeline Line for Large Screens */}
              <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500 transform -translate-x-1/2" />
              
              {/* Left Timeline Line for Mobile - FIXED POSITION */}
              <div className="lg:hidden absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500" />

              {/* Timeline Items - GROUPED BY DATE with proper responsive alignment */}
              <div className="space-y-8 lg:space-y-16 relative">
                {(() => {
                  let globalPropertyIndex = 0; // Track global property index for alternating
                  
                  return Object.entries(groupedProperties).map(([dateString, dayProperties], groupIndex) => (
                    <div key={dateString} className="space-y-8 lg:space-y-16 w-full">
                      {/* Date Header - FIXED MOBILE ALIGNMENT */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: groupIndex * 0.1 }}
                        className="relative mb-6 lg:mb-8"
                      >
                        {/* Mobile: Left-aligned date on timeline - MOVED 50PX LEFT */}
                        <div className="lg:hidden flex items-center">
                          <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full border-2 border-slate-900 absolute left-2.5 z-20" />
                          <div className="ml-8" style={{marginLeft: '22px'}}>
                            <div className="bg-gradient-to-r from-blue-500 via-purple-600 to-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg inline-block">
                              {(() => {
                                try {
                                  return new Date(dateString).toLocaleDateString('en-US', { 
                                    weekday: 'short', 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  });
                                } catch (error) {
                                  return dateString;
                                }
                              })()}
                            </div>
                          </div>
                        </div>
                        
                        {/* Desktop: Centered date */}
                        <div className="hidden lg:flex items-center justify-center">
                          <div className="relative">
                            <div className="bg-gradient-to-r from-blue-500 via-purple-600 to-indigo-600 text-white px-6 py-3 rounded-2xl font-bold text-xl text-center shadow-2xl border border-white/20 backdrop-blur-sm">
                              {(() => {
                                try {
                                  return new Date(dateString).toLocaleDateString('en-US', { 
                                    weekday: 'long', 
                                    year: 'numeric', 
                                    month: 'long', 
                                    day: 'numeric' 
                                  });
                                } catch (error) {
                                  return dateString;
                                }
                              })()}
                            </div>
                            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-purple-600 to-indigo-600 rounded-2xl blur opacity-30" />
                          </div>
                        </div>
                      </motion.div>
                      
                      {/* Properties for this date - FIXED RESPONSIVE LAYOUT */}
                      {dayProperties.map((property, dayIndex) => {
                        if (!property || !property.id) return null;
                        
                        const currentIndex = globalPropertyIndex++;
                        const latestFeedback = property.feedback[0];
                        const isLeft = currentIndex % 2 === 0;
                        const propertyStatus = getPropertyStatus(property);
                        
                        return (
                          <motion.div
                            key={property.id}
                            initial={{ opacity: 0, x: isLeft ? -50 : 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: currentIndex * 0.1 }}
                            className="relative w-full"
                          >
                            {/* Mobile Layout - Single column with timeline dot */}
                            <div className="lg:hidden flex items-start w-full mb-6">
                              {/* Mobile Timeline Dot - FIXED POSITION */}
                              <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full border-2 border-slate-900 relative z-10 mt-4" style={{marginLeft: '-1px'}}>
                                <div className="w-2 h-2 bg-white rounded-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                              </div>

                              {/* Mobile Property Card - FULL WIDTH */}
                              <motion.div
                                data-property-card
                                className="ml-6 w-full bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden hover:bg-slate-700/50 transition-all duration-300"
                                whileHover={{ scale: 1.01 }}
                              >
                                {/* Flashing Icon on Property Card */}
                                <FlashingNotificationIcon 
                                  status={propertyStatus} 
                                  className="top-4 right-4 z-30" 
                                />

                                {/* Property Image */}
                                <div className="relative h-64 bg-slate-700">
                                  <img
                                    src={property.imageUrls[0] || '/api/placeholder/400/300'}
                                    alt={property.address}
                                    className="w-full h-full object-cover"
                                  />
                                  
                                  {/* Dark Gradient Overlay */}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />
                                  
                                  {/* Address - Top Left */}
                                  <div className="absolute top-3 left-3">
                                    <a
                                      href={getGoogleMapsUrl(property.address)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-white font-bold text-base leading-tight drop-shadow-lg hover:text-blue-200 transition-colors inline-block"
                                    >
                                      {property.address}
                                    </a>
                                  </div>

                                  {/* Price - Bottom Right */}
                                  <div className="absolute bottom-3 right-3">
                                    <p className="text-white text-xl font-bold drop-shadow-lg">
                                      ${property.price.toLocaleString()}
                                    </p>
                                  </div>

                                  {/* View Details Button - Bottom Left */}
                                  {property.listingUrl && (
                                    <div className="absolute bottom-3 left-3">
                                      <button
                                        onClick={() => handleMLSClick(property)}
                                        className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg font-medium transition-colors shadow-lg text-sm"
                                      >
                                        <ExternalLink className="w-4 h-4" />
                                        <span>View Details</span>
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {/* Property Details */}
                                <div className="p-4">
                                  {/* Description */}
                                  {property.description && (
                                    <div className="mb-4">
                                      <p className="text-slate-300 text-base leading-relaxed font-medium">
                                        {property.description}
                                      </p>
                                    </div>
                                  )}

                                  {/* Client Feedback Section */}
                                  <div className="space-y-3">
                                    <div className="border-t border-slate-600 pt-3">
                                      <p className="text-slate-300 text-sm mb-2 font-medium">
                                        How do you feel about this property?
                                      </p>
                                      
                                      {/* Show existing feedback or feedback form */}
                                      {latestFeedback ? (
                                        <div className="bg-slate-700/30 rounded-lg p-3">
                                          <div className="flex items-center justify-between mb-2">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${
                                              latestFeedback.feedback === 'love' ? 'bg-gradient-to-r from-pink-500 to-rose-500' :
                                              latestFeedback.feedback === 'like' ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                                              'bg-gradient-to-r from-red-500 to-rose-500'
                                            }`}>
                                              {latestFeedback.feedback === 'love' ? 'Love It! ❤️' :
                                               latestFeedback.feedback === 'like' ? 'Let\'s Talk 💬' : 'Not for Me ❌'}
                                            </span>
                                            <span className="text-xs text-slate-400">
                                              {formatRelativeTime(latestFeedback.createdAt)}
                                            </span>
                                          </div>
                                          {latestFeedback.notes && (
                                            <p className="text-sm text-slate-300 italic">"{latestFeedback.notes}"</p>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="space-y-3">
                                          {/* Mobile-optimized feedback buttons */}
                                          <div className="grid grid-cols-1 gap-3">
                                            <motion.button
                                              onClick={() => handleFeedbackButtonClick(property.id, 'love')}
                                              className={`p-4 rounded-xl text-sm font-bold transition-all duration-300 transform ${
                                                selectedFeedback[property.id] === 'love'
                                                  ? 'bg-gradient-to-br from-pink-500 via-rose-500 to-red-500 text-white scale-105 shadow-xl'
                                                  : 'bg-slate-700/50 text-slate-300 hover:bg-gradient-to-br hover:from-pink-500/20 hover:via-rose-500/20 hover:to-red-500/20 hover:text-pink-400 hover:scale-105 shadow-lg hover:shadow-pink-500/25'
                                              }`}
                                              whileHover={{ scale: 1.02, y: -1 }}
                                              whileTap={{ scale: 0.98 }}
                                            >
                                              <div className="flex items-center justify-center space-x-3">
                                                <Heart className="w-6 h-6" fill={selectedFeedback[property.id] === 'love' ? 'currentColor' : 'none'} />
                                                <div>
                                                  <div className="font-bold text-base">Love It!</div>
                                                  <div className="text-xs opacity-80">Perfect match</div>
                                                </div>
                                              </div>
                                            </motion.button>

                                            <motion.button
                                              onClick={() => handleFeedbackButtonClick(property.id, 'like')}
                                              className={`p-4 rounded-xl text-sm font-bold transition-all duration-300 transform ${
                                                selectedFeedback[property.id] === 'like'
                                                  ? 'bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 text-white scale-105 shadow-xl'
                                                  : 'bg-slate-700/50 text-slate-300 hover:bg-gradient-to-br hover:from-emerald-500/20 hover:via-green-500/20 hover:to-teal-500/20 hover:text-emerald-400 hover:scale-105 shadow-lg hover:shadow-emerald-500/25'
                                              }`}
                                              whileHover={{ scale: 1.02, y: -1 }}
                                              whileTap={{ scale: 0.98 }}
                                            >
                                              <div className="flex items-center justify-center space-x-3">
                                                <MessageSquare className="w-6 h-6" fill={selectedFeedback[property.id] === 'like' ? 'currentColor' : 'none'} />
                                                <div>
                                                  <div className="font-bold text-base">Let's Talk</div>
                                                  <div className="text-xs opacity-80">Schedule a visit</div>
                                                </div>
                                              </div>
                                            </motion.button>

                                            <motion.button
                                              onClick={() => handleFeedbackButtonClick(property.id, 'dislike')}
                                              className={`p-4 rounded-xl text-sm font-bold transition-all duration-300 transform ${
                                                selectedFeedback[property.id] === 'dislike'
                                                  ? 'bg-gradient-to-br from-orange-500 via-red-500 to-rose-500 text-white scale-105 shadow-xl'
                                                  : 'bg-slate-700/50 text-slate-300 hover:bg-gradient-to-br hover:from-orange-500/20 hover:via-red-500/20 hover:to-rose-500/20 hover:text-orange-400 hover:scale-105 shadow-lg hover:shadow-orange-500/25'
                                              }`}
                                              whileHover={{ scale: 1.02, y: -1 }}
                                              whileTap={{ scale: 0.98 }}
                                            >
                                              <div className="flex items-center justify-center space-x-3">
                                                <X className="w-6 h-6" />
                                                <div>
                                                  <div className="font-bold text-base">Not for Me</div>
                                                  <div className="text-xs opacity-80">Keep searching</div>
                                                </div>
                                              </div>
                                            </motion.button>
                                          </div>

                                          {/* Feedback Prompt */}
                                          {selectedFeedback[property.id] && (
                                            <motion.div
                                              initial={{ opacity: 0, y: -10 }}
                                              animate={{ opacity: 1, y: 0 }}
                                              className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg"
                                            >
                                              <p className="text-blue-400 text-sm text-center">
                                                💭 Add a note about this property or submit your feedback now!
                                              </p>
                                            </motion.div>
                                          )}

                                          {/* Notes and submit */}
                                          <div>
                                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                              Your thoughts (optional):
                                            </label>
                                            <textarea
                                              value={feedbackNotes[property.id] || ''}
                                              onChange={(e) => setFeedbackNotes(prev => ({ ...prev, [property.id]: e.target.value }))}
                                              placeholder="Share your thoughts about this property..."
                                              rows={3}
                                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                                            />
                                            
                                            <motion.button
                                              onClick={() => handleSubmitFeedback(property.id)}
                                              disabled={!selectedFeedback[property.id]}
                                              className={`mt-2 px-4 py-2 rounded-lg text-sm transition-colors w-full ${
                                                selectedFeedback[property.id]
                                                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                                  : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                              }`}
                                              whileHover={{ scale: selectedFeedback[property.id] ? 1.02 : 1 }}
                                              whileTap={{ scale: selectedFeedback[property.id] ? 0.98 : 1 }}
                                            >
                                              💾 Share Your Feedback
                                            </motion.button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Property Meta */}
                                  <div className="mt-3 pt-3 border-t border-slate-600 text-xs text-slate-400 text-center">
                                    <span className="text-blue-400 font-medium">{formatRelativeTime(property.createdAt)}</span>
                                  </div>
                                </div>
                              </motion.div>
                            </div>

                            {/* Desktop Layout - Keep existing alternating design */}
                            <div className="hidden lg:flex items-start justify-center w-full">
                              <div className={`
                                flex items-start justify-start w-full
                                ${isLeft ? 'flex-row' : 'flex-row-reverse'}
                              `}>
                                
                                {/* Desktop Timeline Dot */}
                                <div className="absolute left-1/2 top-8 transform -translate-x-1/2 z-20">
                                  <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full border-4 border-slate-900 flex items-center justify-center">
                                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                  </div>
                                </div>

                                {/* Desktop Property Card */}
                                <motion.div
                                  data-property-card
                                  className={`
                                    relative
                                    w-[calc(50%-2rem)] 
                                    flex-shrink-0 
                                    ${isLeft ? 'mr-8' : 'ml-8'}
                                    bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden hover:bg-slate-700/50 transition-all duration-300
                                  `}
                                  whileHover={{ scale: 1.02 }}
                                >
                                  {/* Flashing Icon on Property Card */}
                                  <FlashingNotificationIcon 
                                    status={propertyStatus} 
                                    className="top-5 right-5 z-30" 
                                  />

                                  {/* Property Image - ENHANCED WITH OVERLAYS */}
                                  <div className="relative h-80 bg-slate-700">
                                    <img
                                      src={property.imageUrls[0] || '/api/placeholder/400/300'}
                                      alt={property.address}
                                      className="w-full h-full object-cover"
                                    />
                                    
                                    {/* Dark Gradient Overlay for Text Readability */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />
                                    
                                    {/* Address - Top Left with Google Maps link */}
                                    <div className="absolute top-4 left-4">
                                      <a
                                        href={getGoogleMapsUrl(property.address)}
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
                                    {property.listingUrl && (
                                      <div className="absolute bottom-4 left-4">
                                        <button
                                          onClick={() => handleMLSClick(property)}
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
                                    {/* Description */}
                                    {property.description && (
                                      <div className="mb-4">
                                        <p className="text-slate-300 text-lg leading-relaxed font-medium">
                                          {property.description}
                                        </p>
                                      </div>
                                    )}

                                    {/* CLIENT FEEDBACK SECTION */}
                                    <div className="space-y-4">
                                      <div className="border-t border-slate-600 pt-4">
                                        <p className="text-slate-300 text-sm mb-3 font-medium">
                                          How do you feel about this property?
                                        </p>
                                        
                                        {/* Show existing feedback or feedback form */}
                                        {latestFeedback ? (
                                          <div className="bg-slate-700/30 rounded-lg p-3">
                                            <div className="flex items-center justify-between mb-2">
                                              <span className={`px-3 py-1 rounded-full text-xs font-medium text-white ${
                                                latestFeedback.feedback === 'love' ? 'bg-gradient-to-r from-pink-500 to-rose-500' :
                                                latestFeedback.feedback === 'like' ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                                                'bg-gradient-to-r from-red-500 to-rose-500'
                                              }`}>
                                                {latestFeedback.feedback === 'love' ? 'Love It! ❤️' :
                                                 latestFeedback.feedback === 'like' ? 'Let\'s Talk 💬' : 'Not for Me ❌'}
                                              </span>
                                              <span className="text-xs text-slate-400">
                                                {formatRelativeTime(latestFeedback.createdAt)}
                                              </span>
                                            </div>
                                            {latestFeedback.notes && (
                                              <p className="text-sm text-slate-300 italic">"{latestFeedback.notes}"</p>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="space-y-4">
                                            {/* Feedback Buttons */}
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                              <motion.button
                                                onClick={() => handleFeedbackButtonClick(property.id, 'love')}
                                                className={`p-6 rounded-2xl text-base font-bold transition-all duration-300 transform ${
                                                  selectedFeedback[property.id] === 'love'
                                                    ? 'bg-gradient-to-br from-pink-500 via-rose-500 to-red-500 text-white scale-105 shadow-2xl'
                                                    : 'bg-slate-700/50 text-slate-300 hover:bg-gradient-to-br hover:from-pink-500/20 hover:via-rose-500/20 hover:to-red-500/20 hover:text-pink-400 hover:scale-105 shadow-lg hover:shadow-pink-500/25'
                                                }`}
                                                whileHover={{ scale: 1.05, y: -2 }}
                                                whileTap={{ scale: 0.98 }}
                                              >
                                                <Heart className="w-8 h-8 mx-auto mb-3" fill={selectedFeedback[property.id] === 'love' ? 'currentColor' : 'none'} />
                                                <div className="text-center">
                                                  <div className="font-bold text-lg">Love It!</div>
                                                  <div className="text-sm opacity-80">Perfect match</div>
                                                </div>
                                              </motion.button>

                                              <motion.button
                                                onClick={() => handleFeedbackButtonClick(property.id, 'like')}
                                                className={`p-6 rounded-2xl text-base font-bold transition-all duration-300 transform ${
                                                  selectedFeedback[property.id] === 'like'
                                                    ? 'bg-gradient-to-br from-emerald-500 via-green-500 to-teal-500 text-white scale-105 shadow-2xl'
                                                    : 'bg-slate-700/50 text-slate-300 hover:bg-gradient-to-br hover:from-emerald-500/20 hover:via-green-500/20 hover:to-teal-500/20 hover:text-emerald-400 hover:scale-105 shadow-lg hover:shadow-emerald-500/25'
                                                }`}
                                                whileHover={{ scale: 1.05, y: -2 }}
                                                whileTap={{ scale: 0.98 }}
                                              >
                                                <MessageSquare className="w-8 h-8 mx-auto mb-3" fill={selectedFeedback[property.id] === 'like' ? 'currentColor' : 'none'} />
                                                <div className="text-center">
                                                  <div className="font-bold text-lg">Let's Talk</div>
                                                  <div className="text-sm opacity-80">Schedule a visit</div>
                                                </div>
                                              </motion.button>

                                              <motion.button
                                                onClick={() => handleFeedbackButtonClick(property.id, 'dislike')}
                                                className={`p-6 rounded-2xl text-base font-bold transition-all duration-300 transform ${
                                                  selectedFeedback[property.id] === 'dislike'
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

                                            {/* Feedback Prompt Bubble */}
                                            {selectedFeedback[property.id] && (
                                              <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg"
                                              >
                                                <p className="text-blue-400 text-sm text-center">
                                                  💭 Add a note about this property or submit your feedback now!
                                                </p>
                                              </motion.div>
                                            )}

                                            {/* Feedback Notes */}
                                            <div>
                                              <label className="block text-sm font-medium text-slate-300 mb-2">
                                                Your thoughts (optional):
                                              </label>
                                              <textarea
                                                value={feedbackNotes[property.id] || ''}
                                                onChange={(e) => setFeedbackNotes(prev => ({ ...prev, [property.id]: e.target.value }))}
                                                placeholder="Share your thoughts about this property..."
                                                rows={3}
                                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                                              />
                                              
                                              {/* Submit Feedback Button */}
                                              <motion.button
                                                onClick={() => handleSubmitFeedback(property.id)}
                                                disabled={!selectedFeedback[property.id]}
                                                className={`mt-2 px-4 py-2 rounded-lg text-sm transition-colors w-full ${
                                                  selectedFeedback[property.id]
                                                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                                    : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                                }`}
                                                whileHover={{ scale: selectedFeedback[property.id] ? 1.02 : 1 }}
                                                whileTap={{ scale: selectedFeedback[property.id] ? 0.98 : 1 }}
                                              >
                                                💾 Share Your Feedback
                                              </motion.button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Property Meta */}
                                    <div className="mt-4 pt-3 border-t border-slate-600 flex items-center justify-between text-xs text-slate-400">
                                      <div className="flex items-center space-x-4">
                                        <span className="text-blue-400 font-medium">{formatRelativeTime(property.createdAt)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ));
                })()}
              </div>
            </div>
          ) : (
            /* Empty State */
            <div className="text-center py-20">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-lg mx-auto"
              >
                <div className="relative mb-8">
                  <div className="w-32 h-32 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full flex items-center justify-center mx-auto">
                    <Home className="w-16 h-16 text-slate-400" />
                  </div>
                  <div className="absolute -inset-4 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full blur opacity-20" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">No Properties Yet</h3>
                <p className="text-slate-400 mb-8 text-lg leading-relaxed">
                  {timelineData.agent.name} • REALTOR® hasn't added any properties to your timeline yet. 
                  Check back soon!
                </p>
              </motion.div>
            </div>
          )}
        </div>
      </div>

      {/* Contact Agent Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-16 max-w-4xl mx-auto px-6 pb-16"
      >
        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800/50 rounded-xl p-8 text-center">
          <div className="flex items-center justify-center space-x-4 mb-6">
            {timelineData.agent.logo && (
              <img
                src={timelineData.agent.logo}
                alt={timelineData.agent.name}
                className="w-16 h-16 rounded-full object-cover"
              />
            )}
            <div>
              <h3 className="text-xl font-bold text-white">{timelineData.agent.name} • REALTOR®</h3>
              <p className="text-slate-400">{timelineData.agent.company}</p>
            </div>
          </div>
          
          <p className="text-slate-300 mb-6">
            Ready to schedule a viewing or have questions about any properties? 
            Send me an email or give me a call.
          </p>
          
          <div className="flex items-center justify-center space-x-4">
            <button
              onClick={handleSmartEmail}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl transition-all duration-200 shadow-lg"
            >
              <Mail className="w-4 h-4" />
              <span>Email {timelineData.agent.name.split(' ')[0]}</span>
            </button>
            {timelineData.agent.phone && (
              <a
                href={`tel:${timelineData.agent.phone}`}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-white rounded-xl transition-all duration-200 border border-slate-700/50 shadow-lg"
              >
                <Phone className="w-4 h-4" />
                <span>Call Now</span>
              </a>
            )}
          </div>
        </div>
      </motion.div>

      {/* MLS Modal */}
      {mlsModal.isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setMlsModal({ isOpen: false, url: '', address: '' })}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-slate-900 border border-slate-800 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="text-lg font-semibold text-white">{mlsModal.address}</h3>
              <button
                onClick={() => setMlsModal({ isOpen: false, url: '', address: '' })}
                className="w-10 h-10 bg-red-600 hover:bg-red-700 rounded-lg flex items-center justify-center text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* iFrame */}
            <div className="relative h-[70vh]">
              <iframe
                src={mlsModal.url}
                className="w-full h-full"
                title={`MLS Details for ${mlsModal.address}`}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            </div>
          </motion.div>
        </div>
      )}

      {/* Smart Notification Toast */}
      {showNotification.show && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4"
        >
          <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-xl p-4 shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-3">
                <p className="text-white text-sm leading-relaxed">
                  {showNotification.message}
                </p>
              </div>
              <button
                onClick={hideNotification}
                className="flex-shrink-0 w-6 h-6 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Sticky Agent Card */}
      {timelineData && timelineData.agent && (
        <AgentCard
          agent={{
            name: timelineData.agent.name || 'Your Agent',
            company: timelineData.agent.company || 'Real Estate Company',
            phone: timelineData.agent.phone || undefined,
            email: timelineData.agent.email || '',
            logo: timelineData.agent.logo || undefined,
            brandColor: timelineData.agent.brandColor || '#3b82f6',
            firstName: timelineData.agent.firstName || timelineData.agent.name?.split(' ')[0] || '',
            lastName: timelineData.agent.lastName || timelineData.agent.name?.split(' ')[1] || '',
            // Add extended profile data when available
            yearsExperience: 5, // This should come from agent profile
            specialties: ['First-Time Buyers', 'Investment Properties', 'Luxury Homes'],
            bio: `${timelineData.agent.name || 'Your agent'} is a dedicated real estate professional committed to helping clients find their perfect home. With years of experience in the industry, they provide personalized service and expert guidance throughout the entire buying or selling process.`,
            title: 'Senior Real Estate Agent',
            license: 'RE License #123456',
          }}
          isSticky={true}
        />
      )}
    </div>
  );
}
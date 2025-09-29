// apps/web/src/app/timeline/[shareToken]/page.tsx
'use client';

import { use, useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Lock, Heart, MessageSquare, X, Phone, Mail, MapPin, ExternalLink, Eye, Calendar, Clock, Sparkles, Bell, Building, ChevronLeft, ChevronRight, Palette } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { NewPropertiesNotification } from '@/components/notifications/NewPropertiesNotification';
import { useNotificationStore, createNewPropertiesNotification } from '@/stores/notificationStore';
import { initializePushNotifications } from '@/lib/push-notifications';
import { AgentCard } from '@/components/agent/AgentCard';
import { PhotoViewerModal } from '@/components/modals/PhotoViewerModal';
import ChatInterface from '@/components/messaging/ChatInterface';
import { useMessaging } from '@/contexts/MessagingContext';

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
    conversationId?: string;
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
  const [unreadMessageCount, setUnreadMessageCount] = useState<number>(0);

  // V2 Messaging context for real-time notifications
  const messaging = useMessaging();
  const [newPropertyCount, setNewPropertyCount] = useState<number>(0);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState<boolean>(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [clientMessages, setClientMessages] = useState<any[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState<Record<string, number>>({});
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [photoViewerData, setPhotoViewerData] = useState<{ images: string[]; initialIndex: number; address: string } | null>(null);
  const [propertyChats, setPropertyChats] = useState<Record<string, boolean>>({});
  const [activePropertyChat, setActivePropertyChat] = useState<{propertyId: string, address: string} | null>(null);

  // Color picker state
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [currentHue, setCurrentHue] = useState(220);

  // Theme update function for color picker
  const updateTheme = (newHue: number) => {
    setCurrentHue(newHue);
    document.documentElement.style.setProperty('--theme-hue', newHue.toString());
  };

  // Helper function to manage dismissed notifications in localStorage
  const getDismissedNotifications = () => {
    try {
      return JSON.parse(localStorage.getItem(`dismissed-notifications-${shareToken}`) || '[]');
    } catch {
      return [];
    }
  };

  const addDismissedNotification = (notificationId: number | string) => {
    try {
      const dismissed = getDismissedNotifications();
      dismissed.push(notificationId);
      localStorage.setItem(`dismissed-notifications-${shareToken}`, JSON.stringify(dismissed));
    } catch (error) {
      console.warn('Failed to save dismissed notification:', error);
    }
  };

  // Utility function to format relative time
  const formatRelativeTime = (timestamp: string | Date): string => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMs = now.getTime() - time.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    if (diffInDays < 7) return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    return time.toLocaleDateString();
  };

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
                  ? 'bg-success animate-ping' 
                  : 'bg-warning animate-pulse'
              }`}
            />
            {/* Solid icon */}
            <div 
              className={`relative w-full h-full rounded-full flex items-center justify-center ${
                isNew 
                  ? 'bg-success text-white' 
                  : 'bg-warning text-white'
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
            <div className="bg-success text-white px-1.5 py-0.5 rounded text-xs font-bold tracking-wide">
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

  // Apply agent's brand color as theme hue
  useEffect(() => {
    if (timelineData?.agent?.brandColor) {
      // Convert hex to HSL hue
      const hexToHue = (hex: string): number => {
        // Remove # if present
        const cleanHex = hex.replace('#', '');
        
        // Convert to RGB
        const r = parseInt(cleanHex.substr(0, 2), 16) / 255;
        const g = parseInt(cleanHex.substr(2, 2), 16) / 255;
        const b = parseInt(cleanHex.substr(4, 2), 16) / 255;
        
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const diff = max - min;
        
        let hue = 0;
        if (diff !== 0) {
          if (max === r) {
            hue = 60 * (((g - b) / diff) % 6);
          } else if (max === g) {
            hue = 60 * ((b - r) / diff + 2);
          } else {
            hue = 60 * ((r - g) / diff + 4);
          }
        }
        
        return Math.round(hue < 0 ? hue + 360 : hue);
      };

      const hue = hexToHue(timelineData.agent.brandColor);
      setCurrentHue(hue);
      document.documentElement.style.setProperty('--theme-hue', hue.toString());
    }
  }, [timelineData?.agent?.brandColor]);

  // Handle click outside dropdown elements
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setShowNotificationDropdown(false);
      }

      if (showColorPicker && !target.closest('[data-color-picker]')) {
        setShowColorPicker(false);
      }
    };

    if (showNotificationDropdown || showColorPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotificationDropdown, showColorPicker]);

  // Fetch timeline data function (extracted for reuse)
  const fetchTimelineData = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) setIsLoading(true);
      
      // Extract client code from URL params
      const urlParams = new URLSearchParams(window.location.search);
      const clientCode = urlParams.get('client');
      
      const response = await apiClient.getPublicTimeline(shareToken, clientCode, sessionToken || undefined);
      
      if (response.error) {
        throw new Error(response.error);
      }
      
      if (!response.data) {
        throw new Error('No timeline data received');
      }
      
      const newData = response.data;
      
      // Check for new properties if we have previous data
      if (timelineData && newData && isAuthenticated) {
        const newPropertyCount = newData.properties.length;
        const oldPropertyCount = timelineData.properties.length;
        const newPropertiesAdded = newPropertyCount - oldPropertyCount;
        
        if (newPropertiesAdded > 0 && settings.bannerNotifications && settings.newProperties) {
          // Check if we already have a recent notification for this timeline
          const existingNotification = getVisibleNotifications().find(n => 
            n.type === 'new-properties' && 
            n.timelineId === newData.timeline.id &&
            n.isVisible &&
            !n.isRead
          );
          
          // Only create notification if no existing unread notification exists
          if (!existingNotification) {
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
      }
      
      setTimelineData(newData);
      setIsAuthenticated(newData?.isAuthenticated || false);
      
      // Calculate new properties count (properties added in last 24 hours WITHOUT feedback)
      if (newData?.properties) {
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        
        const newPropertiesWithoutFeedback = newData.properties.filter((property: any) => {
          const createdAt = new Date(property.createdAt);
          const hasNoFeedback = !property.feedback || property.feedback.length === 0;
          return createdAt > twentyFourHoursAgo && hasNoFeedback;
        });
        
        setNewPropertyCount(newPropertiesWithoutFeedback.length);
      }
      
      // Fetch client notifications
      try {
        const notificationsResponse = await apiClient.getClientNotifications(shareToken);
        if (notificationsResponse.data && Array.isArray(notificationsResponse.data)) {
          // Filter out dismissed notifications using localStorage
          const dismissedNotifications = getDismissedNotifications();
          const filteredNotifications = notificationsResponse.data.filter((msg: any) => 
            !dismissedNotifications.includes(msg.id)
          );
          
          setClientMessages(filteredNotifications);
          const unreadCount = filteredNotifications.filter((msg: any) => !msg.isRead).length;
          setUnreadMessageCount(unreadCount);
        } else {
          // No notifications found
          setClientMessages([]);
          setUnreadMessageCount(0);
        }
      } catch (error) {
        console.warn('Failed to fetch notifications:', error);
        // Set empty notifications if API fails
        setClientMessages([]);
        setUnreadMessageCount(0);
      }
      
      // Track timeline view if authenticated
      if (newData?.isAuthenticated) {
        await apiClient.trackTimelineView(shareToken, { source: 'client_access' });
      }
      
    } catch (error) {
      console.error('Failed to fetch timeline data:', error);
      if (isInitialLoad) setTimelineData(null);
    } finally {
      if (isInitialLoad) setIsLoading(false);
    }
  };

  // Initial fetch timeline data
  useEffect(() => {
    fetchTimelineData(true);
  }, [shareToken, sessionToken]);
  
  // Auto-refresh timeline data every 60 seconds when authenticated
  useEffect(() => {
    if (!isAuthenticated || !shareToken) return;
    
    const interval = setInterval(async () => {
      console.log('🔄 Auto-refreshing client timeline data...');
      await fetchTimelineData(false);
    }, 60000); // 60 seconds
    
    console.log('✅ Client timeline auto-refresh enabled (60s)');
    
    return () => {
      clearInterval(interval);
      console.log('🛑 Client timeline auto-refresh disabled');
    };
  }, [isAuthenticated, shareToken, sessionToken]);
  

  // Handle ESC key for MLS modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mlsModal.isOpen) {
        setMlsModal({ isOpen: false, url: '', address: '' });
      }
    };

    if (mlsModal.isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [mlsModal.isOpen]);

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
      // Store session token for MessagingContext
      localStorage.setItem('clientSessionToken', response.data.sessionToken);
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
        clientCode || undefined,
        `${timelineData.client.firstName} ${timelineData.client.lastName}`,
        timelineData.client.email
      );

      if (response.error) {
        throw new Error(response.error);
      }

      // Reduce new property counter if this was a new property
      const property = timelineData.properties.find(p => p.id === propertyId);
      const isNewProperty = property && getPropertyStatus(property, timelineData.properties, timelineData.properties.indexOf(property)) === 'new';
      
      if (isNewProperty && newPropertyCount > 0) {
        setNewPropertyCount(prev => Math.max(0, prev - 1));
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

  // Handle property chat click
  const handlePropertyChatClick = (property: any) => {
    setActivePropertyChat({
      propertyId: property.id,
      address: property.address
    });
    setPropertyChats(prev => ({
      ...prev,
      [property.id]: true
    }));

    // Clear property-specific notifications when opening chat
    messaging.clearPropertyNotifications(property.id);
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

  // Photo viewer handlers
  const handleImageClick = (property: any, imageIndex: number = 0) => {
    const images = property.imageUrls?.length > 0 ? property.imageUrls : [property.imageUrls?.[0] || '/api/placeholder/400/300'];
    setPhotoViewerData({
      images,
      initialIndex: imageIndex,
      address: property.address
    });
    setShowPhotoViewer(true);
  };

  const handlePreviousImage = (propertyId: string, images: string[]) => {
    setCurrentImageIndex(prev => {
      const current = prev[propertyId] || 0;
      return { ...prev, [propertyId]: current === 0 ? images.length - 1 : current - 1 };
    });
  };

  const handleNextImage = (propertyId: string, images: string[]) => {
    setCurrentImageIndex(prev => {
      const current = prev[propertyId] || 0;
      return { ...prev, [propertyId]: current === images.length - 1 ? 0 : current + 1 };
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin mx-auto mb-4"></div>
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
              <div className="w-16 h-16 bg-brand-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-brand-primary" />
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
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary/50"
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
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary/50"
                  placeholder="1234"
                  maxLength={4}
                  required
                />
              </div>

              {authError && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-error/10 border border-error/20 rounded-lg"
                >
                  <p className="text-error text-sm">{authError}</p>
                </motion.div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-brand-primary to-brand-primary-dark hover:from-brand-primary-dark hover:to-brand-primary text-white rounded-xl font-medium transition-all duration-200 hover:scale-[1.02] shadow-lg"
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
            {/* Left side: Agent info - 70% width on mobile */}
            <div className="flex items-center space-x-4 w-full sm:w-auto">
              {/* Agent Company Logo - Desktop only */}
              <div className="hidden sm:flex flex-shrink-0 w-20 h-20 items-center justify-center">
                {timelineData.agent.logo ? (
                  <img
                    src={timelineData.agent.logo}
                    alt={timelineData.agent.company}
                    className="w-full h-full object-contain"
                  />
                ) : timelineData.agent.company ? (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-700 rounded-lg border border-slate-600 text-xs font-bold text-white text-center leading-tight px-1">
                    {timelineData.agent.company.split(' ').map(word => word[0]).join('').slice(0, 3).toUpperCase()}
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-700 rounded-lg border border-slate-600">
                    <Building className="w-8 h-8 text-slate-400" />
                  </div>
                )}
              </div>

              {/* Agent name and text - 70% on mobile */}
              <div className="min-h-16 flex flex-col justify-center flex-1 sm:flex-initial" style={{ width: 'calc(70% - 1rem)' }}>
                <h1 className="text-xl font-bold text-white leading-tight">
                  {timelineData.timeline.title}
                </h1>
                <p className="text-sm text-slate-400 leading-tight">
                  Curated just for you by {timelineData.agent.name} • REALTOR®
                </p>
              </div>
            </div>

            {/* Right side: Bell and properties count - 30% width on mobile */}
            <div className="flex flex-col items-end space-y-1 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4" style={{ width: '30%' }}>
              {/* Top row: Notification bell and new properties badge */}
              <div className="flex items-center space-x-2">
                {/* New Properties Counter Badge */}
                {newPropertyCount > 0 && (
                  <div className="relative">
                    <div className="w-6 h-6 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-xs font-bold">
                        +{newPropertyCount}
                      </span>
                    </div>
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                  </div>
                )}

                {/* Notification Bell */}
                <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                  className="relative p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <Bell className="w-4 h-4 text-slate-300" />
                  {/* Timeline page doesn't need total unread count - simplified for V2 */}
                </button>
                
                {/* Notification Dropdown */}
                {showNotificationDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-slate-800/95 backdrop-blur-sm border border-slate-700/50 rounded-xl shadow-2xl z-50">
                    <div className="p-4 border-b border-slate-700/50">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white flex items-center">
                          <Bell className="w-5 h-5 mr-2 text-brand-primary" />
                          Notifications
                        </h3>
                        <div className="flex items-center gap-2">
                          {clientMessages.length > 0 && clientMessages.filter(msg => !msg.isRead).length > 0 && (
                            <motion.button
                              onClick={() => {
                                // Mark all messages as read
                                const updatedMessages = clientMessages.map(msg => ({
                                  ...msg,
                                  isRead: true
                                }));
                                setClientMessages(updatedMessages);
                                setUnreadMessageCount(0);
                                setShowNotificationDropdown(false);
                              }}
                              className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded border border-slate-600 hover:border-slate-400"
                              initial={{ scale: 1 }}
                              animate={{ 
                                scale: showNotificationDropdown && clientMessages.filter(msg => !msg.isRead).length > 0 ? [1, 1.05, 1] : 1,
                                boxShadow: showNotificationDropdown && clientMessages.filter(msg => !msg.isRead).length > 0 
                                  ? ['0 0 0 rgba(59,130,246,0)', '0 0 8px rgba(59,130,246,0.4)', '0 0 0 rgba(59,130,246,0)'] 
                                  : '0 0 0 rgba(59,130,246,0)'
                              }}
                              transition={{ 
                                repeat: showNotificationDropdown && clientMessages.filter(msg => !msg.isRead).length > 0 ? Infinity : 0,
                                duration: 1.5,
                                ease: "easeInOut"
                              }}
                            >
                              Clear All
                            </motion.button>
                          )}
                          <button
                            onClick={() => setShowNotificationDropdown(false)}
                            className="p-1 hover:bg-slate-700/50 rounded-lg transition-colors"
                          >
                            <X className="w-4 h-4 text-slate-400 hover:text-white" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {clientMessages.length > 0 ? (
                        clientMessages.map((msg, index) => (
                          <div 
                            key={msg.id || `msg-${Date.now()}-${Math.random()}`}
                            className={`p-4 hover:bg-slate-700/30 transition-colors relative group ${
                              !msg.isRead ? 'bg-brand-primary/20 border-l-2 border-brand-primary' : ''
                            } ${index < clientMessages.length - 1 ? 'border-b border-slate-700/30' : ''}`}
                          >
                            <div className="flex items-start space-x-3 pr-8">
                              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                                msg.type === 'property' ? 'bg-green-400' :
                                msg.type === 'message' ? 'bg-brand-primary' : 'bg-warning'
                              }`} />
                              <div className="flex-1">
                                <p className="text-white text-sm leading-relaxed">{msg.message}</p>
                                <p className="text-slate-400 text-xs mt-1">{formatRelativeTime(msg.timestamp)}</p>
                              </div>
                              {!msg.isRead && (
                                <div className="w-2 h-2 bg-red-400 rounded-full flex-shrink-0 mt-2" />
                              )}
                            </div>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                
                                // Save dismissed notification to localStorage
                                addDismissedNotification(msg.id);
                                
                                // Remove from local state
                                setClientMessages(prev => prev.filter(m => m.id !== msg.id));
                              }}
                              className="absolute top-3 right-3 p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-600/50 rounded transition-all duration-200"
                            >
                              <X className="w-3 h-3 text-slate-400 hover:text-white" />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="p-6 text-center">
                          <div className="text-slate-400 mb-2">
                            <Bell className="w-8 h-8 mx-auto opacity-50" />
                          </div>
                          <p className="text-slate-400 text-sm">No notifications</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                </div>
              </div>

              {/* Bottom row: Properties Count */}
              <span className="text-xs text-slate-400 font-medium sm:hidden">
                {timelineData.properties.length} properties
              </span>

              {/* Desktop: Properties count inline */}
              <span className="hidden sm:inline text-xs text-slate-400 font-medium">
                {timelineData.properties.length} properties
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - RESPONSIVE TIMELINE FIXED */}
      <div className="pt-28 px-6 pb-32">
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
              <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-brand-primary via-brand-secondary to-brand-accent transform -translate-x-1/2" />
              
              {/* Left Timeline Line for Mobile - FIXED POSITION */}
              <div className="lg:hidden absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-brand-primary via-brand-secondary to-brand-accent" />

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
                          <div className="hidden xl:block w-3 h-3 bg-gradient-to-r from-brand-primary to-brand-secondary rounded-full border-2 border-slate-900 absolute left-2.5 z-20" />
                          <div className="ml-8" style={{marginLeft: '22px'}}>
                            <div className="bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-accent text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg inline-block">
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
                            <div className="bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-accent text-white px-6 py-3 rounded-2xl font-bold text-xl text-center shadow-2xl border border-white/20 backdrop-blur-sm">
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
                            <div className="absolute -inset-1 bg-gradient-to-r from-brand-primary via-brand-secondary to-brand-accent rounded-2xl blur opacity-30" />
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
                              {/* Mobile Timeline Dot - HIDDEN on tablets and phones */}
                              <div className="hidden xl:flex flex-shrink-0 w-6 h-6 bg-gradient-to-r from-brand-primary to-brand-secondary rounded-full border-2 border-slate-900 relative z-10 mt-4" style={{marginLeft: '-1px'}}>
                                <div className="w-2 h-2 bg-white rounded-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                              </div>

                              {/* Mobile Property Card - FULL WIDTH */}
                              <motion.div
                                data-property-card
                                className="xl:ml-6 w-full bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl overflow-hidden hover:bg-slate-700/50 transition-all duration-300"
                                whileHover={{ scale: 1.01 }}
                              >
                                {/* Flashing Icon on Property Card */}
                                <FlashingNotificationIcon 
                                  status={propertyStatus} 
                                  className="top-4 right-4 z-30" 
                                />

                                {/* Property Image */}
                                <div className="relative h-64 bg-slate-700 group">
                                  {(() => {
                                    const images = property.imageUrls?.length > 0 ? property.imageUrls : ['/api/placeholder/400/300'];
                                    const hasMultipleImages = images.length > 1;
                                    const currentIndex = currentImageIndex[property.id] || 0;
                                    
                                    return (
                                      <>
                                        {/* Clickable overlay for photo viewer - only in empty areas */}
                                        <div 
                                          className="absolute inset-0 z-10 cursor-pointer"
                                          onClick={(e) => {
                                            // Only open photo viewer if clicking on image background, not on buttons/links
                                            if (e.target === e.currentTarget) {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              handleImageClick(property, currentIndex);
                                            }
                                          }}
                                          title="Click on image background to view in full size"
                                        />
                                        
                                        <img
                                          src={images[currentIndex]}
                                          alt={property.address}
                                          className="w-full h-full object-cover"
                                        />
                                        
                                        {/* Image Navigation Arrows */}
                                        {hasMultipleImages && (
                                          <>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handlePreviousImage(property.id, images);
                                              }}
                                              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all duration-200 z-30"
                                            >
                                              <ChevronLeft className="w-5 h-5" />
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleNextImage(property.id, images);
                                              }}
                                              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all duration-200 z-30"
                                            >
                                              <ChevronRight className="w-5 h-5" />
                                            </button>
                                            
                                            {/* Image Count Indicator */}
                                            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20">
                                              {images.length <= 8 ? (
                                                // Simple dots for 8 or fewer images
                                                <div className="flex space-x-2">
                                                  {images.map((_, index) => (
                                                    <button
                                                      key={index}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setCurrentImageIndex(prev => ({ ...prev, [property.id]: index }));
                                                      }}
                                                      className={`w-2 h-2 rounded-full transition-all duration-200 ${
                                                        index === currentIndex 
                                                          ? 'bg-white' 
                                                          : 'bg-white/50 hover:bg-white/70'
                                                      }`}
                                                    />
                                                  ))}
                                                </div>
                                              ) : (
                                                // Compact indicator for many images
                                                <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-sm font-medium shadow-lg">
                                                  {currentIndex + 1} / {images.length}
                                                </div>
                                              )}
                                            </div>
                                          </>
                                        )}
                                      </>
                                    );
                                  })()} 
                                  
                                  {/* Dark Gradient Overlay */}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />
                                  
                                  {/* Address - Top Left */}
                                  <div className="absolute top-3 left-3 z-20">
                                    <a
                                      href={getGoogleMapsUrl(property.address)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-white font-bold text-base leading-tight drop-shadow-lg hover:text-brand-primary-light transition-colors inline-block"
                                    >
                                      {property.address}
                                    </a>
                                  </div>

                                  {/* Price - Bottom Right */}
                                  <div className="absolute bottom-3 right-3 z-20">
                                    <p className="text-white text-xl font-bold drop-shadow-lg">
                                      ${property.price.toLocaleString()}
                                    </p>
                                  </div>

                                  {/* View Details Button - Bottom Left */}
                                  {property.listingUrl && (
                                    <div className="absolute bottom-3 left-3 z-20">
                                      <button
                                        onClick={() => handleMLSClick(property)}
                                        className="inline-flex items-center space-x-2 bg-brand-primary hover:bg-brand-primary-dark text-white px-3 py-2 rounded-lg font-medium transition-colors shadow-lg text-sm"
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
                                              {latestFeedback.feedback === 'love' ? 'Love it, Let\'s schedule a showing' :
                                               latestFeedback.feedback === 'like' ? 'I like it, let\'s talk' : 'Not for Me, please keep searching'}
                                            </span>
                                            <span className="text-xs text-slate-400">
                                              {formatRelativeTime(latestFeedback.createdAt)}
                                            </span>
                                          </div>
                                          {latestFeedback.notes && (
                                            <p className="text-sm text-slate-300 italic">"{latestFeedback.notes}"</p>
                                          )}

                                          {/* Chat Button - Only shown after feedback */}
                                          <div className="mt-3 pt-3 border-t border-slate-600/50">
                                            <motion.button
                                              onClick={() => handlePropertyChatClick(property)}
                                              className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition-colors flex items-center justify-center space-x-2 relative"
                                              whileHover={{ scale: 1.02 }}
                                              whileTap={{ scale: 0.98 }}
                                            >
                                              <MessageSquare className="w-4 h-4" />
                                              <span>Chat about this property</span>
                                              {messaging.getPropertyNotificationCount(property.id) > 0 && (
                                                <motion.span
                                                  initial={{ scale: 0 }}
                                                  animate={{ scale: 1 }}
                                                  className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse"
                                                >
                                                  {messaging.getPropertyNotificationCount(property.id)}
                                                </motion.span>
                                              )}
                                            </motion.button>
                                          </div>
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
                                              className="p-3 bg-brand-primary/10 border border-brand-primary/20 rounded-lg"
                                            >
                                              <p className="text-brand-primary text-sm text-center">
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
                                              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary text-sm"
                                            />
                                            
                                            <div className="flex space-x-2">
                                              <motion.button
                                                onClick={() => handleSubmitFeedback(property.id)}
                                                disabled={!selectedFeedback[property.id]}
                                                className={`mt-2 px-4 py-2 rounded-lg text-sm transition-colors flex-1 ${
                                                  selectedFeedback[property.id]
                                                    ? 'bg-brand-primary hover:bg-brand-primary-dark text-white'
                                                    : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                                }`}
                                                whileHover={{ scale: selectedFeedback[property.id] ? 1.02 : 1 }}
                                                whileTap={{ scale: selectedFeedback[property.id] ? 0.98 : 1 }}
                                              >
                                                💾 Share Feedback
                                              </motion.button>

                                              <motion.button
                                                onClick={() => handlePropertyChatClick(property)}
                                                className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition-colors flex items-center space-x-1 relative"
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                              >
                                                <MessageSquare className="w-3 h-3" />
                                                <span>Chat</span>
                                                {messaging.getPropertyNotificationCount(property.id) > 0 && (
                                                  <motion.span
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center animate-pulse"
                                                  >
                                                    {messaging.getPropertyNotificationCount(property.id)}
                                                  </motion.span>
                                                )}
                                              </motion.button>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Property Meta */}
                                  <div className="mt-3 pt-3 border-t border-slate-600 text-xs text-slate-400 text-center">
                                    <span className="text-brand-primary font-medium">{formatRelativeTime(property.createdAt)}</span>
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
                                  <div className="w-6 h-6 bg-gradient-to-r from-brand-primary to-brand-secondary rounded-full border-4 border-slate-900 flex items-center justify-center">
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
                                  <div className="relative h-80 bg-slate-700 group">
                                    {(() => {
                                      const images = property.imageUrls?.length > 0 ? property.imageUrls : ['/api/placeholder/400/300'];
                                      const hasMultipleImages = images.length > 1;
                                      const currentIndex = currentImageIndex[property.id] || 0;
                                      
                                      return (
                                        <>
                                          {/* Clickable overlay for photo viewer - only in empty areas */}
                                          <div 
                                            className="absolute inset-0 z-10 cursor-pointer"
                                            onClick={(e) => {
                                              // Only open photo viewer if clicking on image background, not on buttons/links
                                              if (e.target === e.currentTarget) {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                handleImageClick(property, currentIndex);
                                              }
                                            }}
                                            title="Click on image background to view in full size"
                                          />
                                          
                                          <img
                                            src={images[currentIndex]}
                                            alt={property.address}
                                            className="w-full h-full object-cover"
                                          />
                                          
                                          {/* Image Navigation Arrows */}
                                          {hasMultipleImages && (
                                            <>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handlePreviousImage(property.id, images);
                                                }}
                                                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all duration-200 z-30"
                                              >
                                                <ChevronLeft className="w-5 h-5" />
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleNextImage(property.id, images);
                                                }}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-all duration-200 z-30"
                                              >
                                                <ChevronRight className="w-5 h-5" />
                                              </button>
                                              
                                              {/* Image Count Indicator */}
                                              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20">
                                                {images.length <= 8 ? (
                                                  // Simple dots for 8 or fewer images
                                                  <div className="flex space-x-2">
                                                    {images.map((_, index) => (
                                                      <button
                                                        key={index}
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setCurrentImageIndex(prev => ({ ...prev, [property.id]: index }));
                                                        }}
                                                        className={`w-2 h-2 rounded-full transition-all duration-200 ${
                                                          index === currentIndex 
                                                            ? 'bg-white' 
                                                            : 'bg-white/50 hover:bg-white/70'
                                                        }`}
                                                      />
                                                    ))}
                                                  </div>
                                                ) : (
                                                  // Compact indicator for many images
                                                  <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-sm font-medium shadow-lg">
                                                    {currentIndex + 1} / {images.length}
                                                  </div>
                                                )}
                                              </div>
                                            </>
                                          )}
                                        </>
                                      );
                                    })()}
                                    
                                    {/* Dark Gradient Overlay for Text Readability */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />
                                    
                                    {/* Address - Top Left with Google Maps link */}
                                    <div className="absolute top-4 left-4 z-20">
                                      <a
                                        href={getGoogleMapsUrl(property.address)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-white font-bold text-lg leading-tight drop-shadow-lg hover:text-brand-primary-light transition-colors inline-block"
                                      >
                                        {property.address}
                                      </a>
                                    </div>

                                    {/* Price - Bottom Right */}
                                    <div className="absolute bottom-4 right-4 z-20">
                                      <p className="text-white text-2xl font-bold drop-shadow-lg">
                                        ${property.price.toLocaleString()}
                                      </p>
                                    </div>

                                    {/* View Details Button - Bottom Left */}
                                    {property.listingUrl && (
                                      <div className="absolute bottom-4 left-4 z-20">
                                        <button
                                          onClick={() => handleMLSClick(property)}
                                          className="inline-flex items-center space-x-2 bg-brand-primary hover:bg-brand-primary-dark text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-lg"
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
                                                {latestFeedback.feedback === 'love' ? 'Love it, Let\'s schedule a showing' :
                                                 latestFeedback.feedback === 'like' ? 'I like it, let\'s talk' : 'Not for Me, please keep searching'}
                                              </span>
                                              <span className="text-xs text-slate-400">
                                                {formatRelativeTime(latestFeedback.createdAt)}
                                              </span>
                                            </div>
                                            {latestFeedback.notes && (
                                              <p className="text-sm text-slate-300 italic">"{latestFeedback.notes}"</p>
                                            )}

                                            {/* Chat Button - Only shown after feedback */}
                                            <div className="mt-3 pt-3 border-t border-slate-600/50">
                                              <motion.button
                                                onClick={() => handlePropertyChatClick(property)}
                                                className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition-colors flex items-center justify-center space-x-2 relative"
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                              >
                                                <MessageSquare className="w-4 h-4" />
                                                <span>Chat about this property</span>
                                                {messaging.getPropertyNotificationCount(property.id) > 0 && (
                                                  <motion.span
                                                    initial={{ scale: 0 }}
                                                    animate={{ scale: 1 }}
                                                    className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse"
                                                  >
                                                    {messaging.getPropertyNotificationCount(property.id)}
                                                  </motion.span>
                                                )}
                                              </motion.button>
                                            </div>
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
                                                  <div className="font-bold text-lg">Love it</div>
                                                  <div className="text-sm opacity-80">Let's schedule a showing</div>
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
                                                  <div className="font-bold text-lg">I like it</div>
                                                  <div className="text-sm opacity-80">let's talk</div>
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
                                                  <div className="text-sm opacity-80">please keep searching</div>
                                                </div>
                                              </motion.button>
                                            </div>

                                            {/* Feedback Prompt Bubble */}
                                            {selectedFeedback[property.id] && (
                                              <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="p-3 bg-brand-primary/10 border border-brand-primary/20 rounded-lg"
                                              >
                                                <p className="text-brand-primary text-sm text-center">
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
                                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary text-sm"
                                              />
                                              
                                              {/* Submit Feedback and Chat Buttons */}
                                              <div className="flex space-x-2">
                                                <motion.button
                                                  onClick={() => handleSubmitFeedback(property.id)}
                                                  disabled={!selectedFeedback[property.id]}
                                                  className={`mt-2 px-4 py-2 rounded-lg text-sm transition-colors flex-1 ${
                                                    selectedFeedback[property.id]
                                                      ? 'bg-brand-primary hover:bg-brand-primary-dark text-white'
                                                      : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                                  }`}
                                                  whileHover={{ scale: selectedFeedback[property.id] ? 1.02 : 1 }}
                                                  whileTap={{ scale: selectedFeedback[property.id] ? 0.98 : 1 }}
                                                >
                                                  💾 Share Feedback
                                                </motion.button>

                                                <motion.button
                                                  onClick={() => handlePropertyChatClick(property)}
                                                  className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition-colors flex items-center space-x-1 relative"
                                                  whileHover={{ scale: 1.02 }}
                                                  whileTap={{ scale: 0.98 }}
                                                >
                                                  <MessageSquare className="w-3 h-3" />
                                                  <span>Chat</span>
                                                  {messaging.getPropertyNotificationCount(property.id) > 0 && (
                                                    <motion.span
                                                      initial={{ scale: 0 }}
                                                      animate={{ scale: 1 }}
                                                      className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center animate-pulse"
                                                    >
                                                      {messaging.getPropertyNotificationCount(property.id)}
                                                    </motion.span>
                                                  )}
                                                </motion.button>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Property Meta */}
                                    <div className="mt-4 pt-3 border-t border-slate-600 flex items-center justify-between text-xs text-slate-400">
                                      <div className="flex items-center space-x-4">
                                        <span className="text-brand-primary font-medium">{formatRelativeTime(property.createdAt)}</span>
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


      {/* MLS Modal - Fullscreen like Agent Timeline */}
      {mlsModal.isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex flex-col"
          onClick={() => setMlsModal({ isOpen: false, url: '', address: '' })}
        >
          {/* Header Bar */}
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="bg-slate-900/90 backdrop-blur-sm border-b border-slate-700 p-4 flex items-center justify-between"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-white font-medium ml-4">{mlsModal.address}</span>
            </div>
            
            <button
              onClick={() => setMlsModal({ isOpen: false, url: '', address: '' })}
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
            onClick={(e) => e.stopPropagation()}
          >
            <iframe
              src={mlsModal.url}
              className="w-full h-full border-0"
              title={`MLS Details - ${mlsModal.address}`}
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

      {/* Photo Viewer Modal */}
      {photoViewerData && (
        <PhotoViewerModal
          isOpen={showPhotoViewer}
          onClose={() => {
            setShowPhotoViewer(false);
            setPhotoViewerData(null);
          }}
          images={photoViewerData.images}
          initialIndex={photoViewerData.initialIndex}
          propertyAddress={photoViewerData.address}
          isClientView={true}
        />
      )}

      {/* Sticky Agent Card */}
      {timelineData && timelineData.agent && (
        <AgentCard
          shareToken={shareToken}
          agent={{
            name: `${timelineData.agent.firstName || ''} ${timelineData.agent.lastName || ''}`.trim(),
            company: timelineData.agent.company,
            phone: timelineData.agent.phone || undefined,
            email: timelineData.agent.email || '',
            logo: timelineData.agent.avatar,
            brandColor: timelineData.agent.brandColor,
            firstName: timelineData.agent.firstName || '',
            lastName: timelineData.agent.lastName || '',
            // Add extended profile data when available
            yearsExperience: timelineData.agent.yearsExperience,
            specialties: timelineData.agent.specialties,
            bio: timelineData.agent.bio,
            license: timelineData.agent.license || undefined,
            website: timelineData.agent.website || undefined,
          }}
          isSticky={true}
        />
      )}


      {/* Property-Specific Chat Interface Modal */}
      {activePropertyChat && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setActivePropertyChat(null)} />
          <div className="relative bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md h-[600px] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div>
                <h3 className="text-white font-semibold">Property Chat</h3>
                <p className="text-slate-400 text-sm">{activePropertyChat.address}</p>
                {timelineData?.agent?.firstName && (
                  <p className="text-slate-400 text-xs">with {timelineData.agent.firstName}</p>
                )}
              </div>
              <button
                onClick={() => setActivePropertyChat(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatInterface
                timelineId={timelineData?.timeline.id || ''}
                propertyId={activePropertyChat.propertyId}
              />
            </div>
          </div>
        </div>
      )}

      {/* Color Picker Button - Bottom Right Above Footer */}
      <div className="fixed bottom-20 right-4 z-50" data-color-picker>
        <motion.button
          onClick={() => setShowColorPicker(!showColorPicker)}
          className="w-14 h-14 bg-brand-primary hover:bg-brand-primary-dark text-white rounded-xl shadow-lg transition-all duration-200 flex items-center justify-center"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title="Theme Color Picker"
          style={{
            background: `hsl(${currentHue}, 70%, 55%)`
          }}
        >
          <Palette className="w-6 h-6" />
        </motion.button>
      </div>

      {/* Color Picker Panel */}
      <AnimatePresence>
        {showColorPicker && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: -20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: 20, x: -20 }}
            className="fixed bottom-36 right-4 z-50 bg-slate-800/95 backdrop-blur-md border border-slate-700/50 rounded-xl p-6 shadow-2xl max-w-sm"
            data-color-picker
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Theme Color
              </h3>
              <button
                onClick={() => setShowColorPicker(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Hue Slider */}
            <div className="mb-6">
              <label className="block text-slate-300 text-sm mb-2">
                Hue: {currentHue}°
              </label>
              <input
                type="range"
                min="0"
                max="360"
                value={currentHue}
                onChange={(e) => updateTheme(parseInt(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right,
                    hsl(0, 70%, 55%),
                    hsl(60, 70%, 55%),
                    hsl(120, 70%, 55%),
                    hsl(180, 70%, 55%),
                    hsl(240, 70%, 55%),
                    hsl(300, 70%, 55%),
                    hsl(360, 70%, 55%))`
                }}
              />
            </div>

            {/* Color Presets */}
            <div className="mb-6">
              <label className="block text-slate-300 text-sm mb-2">Quick Presets:</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { name: 'Ocean Blue', hue: 220 },
                  { name: 'Forest Green', hue: 120 },
                  { name: 'Sunset Orange', hue: 30 },
                  { name: 'Royal Purple', hue: 270 },
                  { name: 'Rose Pink', hue: 330 },
                  { name: 'Cyan Blue', hue: 180 },
                ].map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => updateTheme(preset.hue)}
                    className="p-2 rounded-lg border border-slate-600 hover:border-brand-primary transition-all duration-200 text-xs text-center"
                    style={{
                      backgroundColor: `hsl(${preset.hue}, 15%, 12%)`,
                      color: 'var(--text-light)'
                    }}
                  >
                    <div
                      className="w-3 h-3 rounded-full mb-1 mx-auto"
                      style={{ backgroundColor: `hsl(${preset.hue}, 70%, 55%)` }}
                    />
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Preview */}
            <div className="space-y-3">
              <div className="text-slate-300 text-sm">Live Preview:</div>

              {/* Preview Elements */}
              <div className="flex gap-2">
                <div className="flex-1 h-8 rounded bg-brand-primary flex items-center justify-center text-xs text-white font-medium">
                  Primary
                </div>
                <div className="flex-1 h-8 rounded bg-brand-secondary flex items-center justify-center text-xs text-slate-900 font-medium">
                  Secondary
                </div>
              </div>

              <div className="text-xs text-slate-400 text-center">
                Changes apply instantly to the timeline theme
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
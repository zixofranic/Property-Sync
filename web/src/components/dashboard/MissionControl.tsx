// apps/web/src/components/dashboard/MissionControl.tsx - ADDED: Loading animations for data retrieval
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Plus, 
  Settings, 
  BarChart3, 
  CreditCard,
  Search,
  Bell,
  ChevronDown,
  Zap,
  Target,
  Clock,
  TrendingUp,
  Send,
  Calendar,
  Wifi,
  WifiOff,
  Shield,
  Loader2,
  User,
  Share2
} from 'lucide-react';
import { useMissionControlStore, Property } from '@/stores/missionControlStore';
import { BatchPropertyModal } from '../modals/BatchPropertyModal';
import { MLSViewModal } from '../modals/MLSViewModal';
import { PropertyCard } from '../timeline/PropertyCard';
import { Notifications } from '../ui/Notifications';
import { ClientsModal } from './modals/ClientsModal';
import { apiClient } from '@/lib/api-client';
import { ProfileModal } from '@/components/profile/ProfileModal';
import { SettingsModal } from '@/components/modals/settings/SettingsModal';
import { ShareTimelineModal } from '@/components/modals/email/ShareTimelineModal';
import { AnalyticsModal } from '@/components/modals/AnalyticsModal';


export function MissionControl() {
  const { 
    selectedClient, 
    clients, 
    selectClient, 
    getClientTimeline,
    activeModal,
    setActiveModal,
    updatePropertyFeedback,
    setEditingProperty,
    addNotification,
    notifications,
    removeNotification,
    markNotificationAsRead,
    clearAllNotifications,
    deleteProperty,
    getPropertyById,
    bulkMode,
    sendBulkProperties,
    isAuthenticated,
    user,
    logout,
    clientsLoading,
    timelineLoading,
    analyticsLoading,
    userPreferences,
    updateEmailTemplate,
    updateUserPreferences,
  } = useMissionControlStore();
  
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [mlsModal, setMlsModal] = useState<{ isOpen: boolean; url: string; address: string }>({
    isOpen: false,
    url: '',
    address: ''
  });

  const handleSavePreferences = async (preferences: any) => {
  try {
    await updateUserPreferences(preferences);
    // Success notification is handled in the store
  } catch (error) {
    // Error notification is handled in the store
    throw error; // Re-throw so SettingsModal can handle UI state
  }
};

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [emailState, setEmailState] = useState<any>(null);
  const [emailStateLoading, setEmailStateLoading] = useState(false);

  // âœ… SIMPLIFIED: Basic online/offline detection only
  const [isOnline, setIsOnline] = useState(true);


  // âœ… SIMPLIFIED: Basic online/offline monitoring (no session management)
  useEffect(() => {
    // Only handle online/offline detection
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Check initial online status
    setIsOnline(navigator.onLine);

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []); // âœ… FIXED: Empty dependency array, no auth dependencies

  // Close notifications dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showNotificationsDropdown && !target.closest('[data-notifications-dropdown]')) {
        setShowNotificationsDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotificationsDropdown]);

  // Get current timeline and properties
  const currentTimeline = selectedClient ? getClientTimeline(selectedClient.id) : null;
  const properties = currentTimeline?.properties || [];

  // Fetch email state for timeline - moved before useEffect
  const fetchEmailState = useCallback(async (timelineId: string) => {
    setEmailStateLoading(true);
    try {
      const response = await apiClient.get(`/timelines/${timelineId}/email-state`);
      setEmailState(response.data);
    } catch (error) {
      console.error('Failed to fetch email state:', error);
      setEmailState(null);
    } finally {
      setEmailStateLoading(false);
    }
  }, []);

  // Fetch email state when timeline changes or share modal opens
  useEffect(() => {
    if (showShareModal && currentTimeline) {
      fetchEmailState(currentTimeline.id);
    }
  }, [showShareModal, currentTimeline?.id, fetchEmailState]);

  // Check if there are properties queued for bulk sending
  const bulkQueueCount = properties.filter(p => !p.clientFeedback).length;

  // âœ… FIXED: Date grouping function with null safety
  const groupPropertiesByDate = (properties: Property[]) => {
    const groups: { [key: string]: Property[] } = {};
    
    properties.forEach(property => {
      if (!property.addedAt) return; // Skip properties without dates
      
      try {
        const date = new Date(property.addedAt).toDateString();
        if (!groups[date]) {
          groups[date] = [];
        }
        groups[date].push(property);
      } catch (error) {
        console.warn('Invalid date for property:', property.id, property.addedAt);
      }
    });
    
    return groups;
  };

  // âœ… FIXED: Format relative time with null safety
  const getRelativeTime = (dateString: string | undefined) => {
    if (!dateString) return 'Unknown';
    
    try {
      const now = new Date();
      const date = new Date(dateString);
      
      // Check for invalid date
      if (isNaN(date.getTime())) return 'Unknown';
      
      const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
      
      if (diffInHours < 1) return 'Just now';
      if (diffInHours < 24) return `${diffInHours}h ago`;
      if (diffInHours < 48) return 'Yesterday';
      return date.toLocaleDateString();
    } catch (error) {
      return 'Unknown';
    }
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-400/20';
      case 'warm': return 'text-yellow-400 bg-yellow-400/20';
      case 'cold': return 'text-blue-400 bg-blue-400/20';
      default: return 'text-gray-400 bg-gray-400/20';
    }
  };

  const handleDeleteProperty = (propertyId: string) => {
    const property = getPropertyById(propertyId);
    if (property && confirm(`Delete "${property.address || 'this property'}"?\n\nThis action cannot be undone.`)) {
      deleteProperty(propertyId);
    }
  };

  const handleViewMLS = (mlsLink: string, address: string) => {
    if (!mlsLink) {
      addNotification({
        type: 'warning',
        title: 'No MLS Link',
        message: 'This property does not have an MLS link configured.'
      });
      return;
    }

    setMlsModal({
      isOpen: true,
      url: mlsLink,
      address: address || 'Property Details'
    });
  };

  const handlePropertyFeedback = (propertyId: string, feedback: 'love' | 'like' | 'dislike', notes?: string) => {
    updatePropertyFeedback(propertyId, feedback, notes);
    
    addNotification({
      type: 'info',
      title: 'Feedback Received',
      message: `Client feedback: ${feedback.charAt(0).toUpperCase() + feedback.slice(1)}`
    });
  };

  const handleEditProperty = (propertyId: string) => {
    const property = getPropertyById(propertyId);
    
    if (property) {
      setEditingProperty(property);
      setActiveModal('add-property');
      
      addNotification({
        type: 'info',
        title: 'Edit Mode',
        message: `Editing ${property.address || 'property'}`
      });
    }
  };

  const handleSendBulkProperties = () => {
    if (selectedClient && bulkQueueCount > 0) {
      sendBulkProperties(selectedClient.id);
    }
  };

  const handleSendTimelineEmail = async (templateOverride?: 'modern' | 'classical', emailType?: 'initial' | 'reminder') => {
    if (!selectedClient || !currentTimeline) {
      addNotification({
        type: 'error',
        title: 'Cannot Send Email',
        message: 'No client or timeline selected',
        read: false,
      });
      return;
    }

    try {
      // Use API client directly to avoid potential store initialization issues
      const response = await apiClient.sendTimelineEmail(currentTimeline.id, templateOverride, emailType);
      
      if (response.error) {
        addNotification({
          type: 'error',
          title: 'Email Failed',
          message: response.error,
          read: false,
        });
        throw new Error(response.error);
      }

      // Success notification
      addNotification({
        type: 'success',
        title: 'Email Sent!',
        message: `Timeline email sent successfully to ${selectedClient.name}`,
        read: false,
      });

      // Refresh email state after successful send
      await fetchEmailState(currentTimeline.id);
    } catch (error) {
      throw error; // Re-throw for modal handling
    }
  };
  // âœ… FIXED: Enhanced client selector with search - NULL SAFETY APPLIED
  const [clientSearch, setClientSearch] = useState('');
  const filteredClients = clients.filter(client => {
    if (!client) return false; // Skip null/undefined clients
    
    const searchTerm = clientSearch.toLowerCase();
    const name = client.name?.toLowerCase() || '';
    const email = client.email?.toLowerCase() || '';
    
    return name.includes(searchTerm) || email.includes(searchTerm);
  });
  // Add this after your existing useState declarations
const testProfileAPI = async () => {
  try {
    const response = await apiClient.getProfile();
    console.log('Profile response:', response);
    addNotification({
      type: 'success',
      title: 'Profile API Test',
      message: 'Check browser console for profile data'
    });
  } catch (error) {
    console.error('Profile API error:', error);
    addNotification({
      type: 'error', 
      title: 'Profile API Error',
      message: 'Check browser console for details'
    });
  }
};

  // âœ… ADDED: Shimmer loading component for client list
  const ClientShimmer = () => (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-4 border-b border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="h-4 bg-gradient-to-r from-slate-600 via-slate-500 to-slate-600 rounded animate-pulse mb-2"></div>
              <div className="h-3 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 rounded animate-pulse w-3/4 mb-1"></div>
              <div className="h-2 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 rounded animate-pulse w-1/2"></div>
            </div>
            <div className="text-right ml-4">
              <div className="h-6 w-16 bg-gradient-to-r from-slate-600 via-slate-500 to-slate-600 rounded-full animate-pulse mb-1"></div>
              <div className="h-2 w-12 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // âœ… ADDED: Loading overlay component
  const LoadingOverlay = ({ message = "Loading..." }: { message?: string }) => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center"
    >
      <div className="bg-slate-800/90 rounded-2xl p-8 border border-slate-700/50 shadow-2xl">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <div className="absolute inset-0 w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"
                 style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}>
            </div>
          </div>
          <div>
            <p className="text-white font-semibold">{message}</p>
            <p className="text-slate-400 text-sm">Please wait...</p>
          </div>
        </div>
      </div>
    </motion.div>
  );

  // âœ… ADDED: Timeline loading skeleton
  const TimelineLoadingSkeleton = () => (
    <div className="space-y-12">
      {[1, 2].map((i) => (
        <div key={i} className="space-y-8">
          {/* Date header skeleton */}
          <div className="flex items-center justify-center">
            <div className="h-16 w-64 bg-gradient-to-r from-slate-600 via-slate-500 to-slate-600 rounded-2xl animate-pulse"></div>
          </div>
          
          {/* Property cards skeleton */}
          {[1, 2].map((j) => (
            <div key={j} className={`flex ${j % 2 === 0 ? 'lg:flex-row-reverse' : ''} items-center space-x-8 lg:space-x-16`}>
              <div className="flex-1 max-w-2xl">
                <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
                  <div className="space-y-4">
                    <div className="h-6 bg-gradient-to-r from-slate-600 via-slate-500 to-slate-600 rounded animate-pulse"></div>
                    <div className="h-32 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 rounded-lg animate-pulse"></div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 rounded animate-pulse"></div>
                      <div className="h-4 bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 rounded animate-pulse w-3/4"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* âœ… ADDED: Show loading overlay for initial data loading */}
      <AnimatePresence>
        {clientsLoading && clients.length === 0 && (
          <LoadingOverlay message="Loading your clients..." />
        )}
      </AnimatePresence>

      {/* âœ… SIMPLIFIED: Basic offline status bar only */}
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm font-medium bg-red-600 text-white"
        >
          <div className="flex items-center justify-center space-x-2">
            <WifiOff className="w-4 h-4" />
            <span>You are offline. Some features may not work properly.</span>
          </div>
        </motion.div>
      )}

      {/* Mission Control HUD */}
      <div className={`fixed ${!isOnline ? 'top-10' : 'top-0'} left-0 right-0 z-20 bg-slate-900/90 backdrop-blur-md border-b border-slate-700/50`}>
        <div className="flex items-center justify-between p-2 sm:p-4">
          {/* Enhanced Client Selector */}
          <div className="relative">
            <motion.button
              onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
              className="flex items-center space-x-2 sm:space-x-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl shadow-lg transition-all duration-200"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Target className="w-4 h-4 sm:w-5 sm:h-5" />
              <div className="text-left min-w-0">
                <div className="font-semibold text-xs sm:text-sm truncate">
                  {selectedClient?.name || 'Select Client'}
                </div>
                <div className="text-xs opacity-75 hidden sm:block">
                  {selectedClient ? `${properties.length} properties` : 'Active Mission'}
                </div>
              </div>
              <ChevronDown className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform ${isClientDropdownOpen ? 'rotate-180' : ''}`} />
            </motion.button>

            <AnimatePresence>
              {isClientDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="fixed sm:absolute top-16 sm:top-full left-4 right-4 sm:left-0 sm:right-auto mt-2 sm:w-96 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-[60]"
                >
                  {/* Search Bar */}
                  <div className="p-4 border-b border-slate-700">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search clients..."
                        value={clientSearch}
                        onChange={(e) => setClientSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* âœ… ADDED: Client List with loading state */}
                  <div className="max-h-80 overflow-y-auto">
                    {clientsLoading && clients.length === 0 ? (
                      <ClientShimmer />
                           ) : filteredClients.length > 0 ? (
                      filteredClients.map((client) => (
                        <motion.button
                          key={client.id}
                          onClick={() => {
                            selectClient(client);
                            setIsClientDropdownOpen(false);
                            setClientSearch('');
                          }}
                          className="w-full p-4 text-left hover:bg-slate-700/50 transition-colors border-b border-slate-700/50 last:border-b-0"
                          whileHover={{ x: 4 }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-white">{client.name || 'Unnamed Client'}</div>
                              <div className="text-sm text-slate-400 truncate">{client.email || 'No email'}</div>
                              <div className="text-xs text-slate-500 mt-1">
                                {client.propertiesViewed || 0} properties Last active {getRelativeTime(client.lastActive)}
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(client.status)}`}>
                                {client.status || 'active'}
                              </div>
                              <div className="text-xs text-slate-400 mt-1">
                                {client.engagementScore || 0}% engagement
                              </div>
                            </div>
                          </div>
                        </motion.button>
                      ))
                    ) : (
                    <div className="p-8 text-center text-slate-400">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No clients found</p>
                      </div>
                    )}
                  </div>

                  {/* Add Client Button */}
                  <div className="p-4 border-t border-slate-700">
                    <button
                      onClick={() => {
                        setActiveModal('clients');
                        setIsClientDropdownOpen(false);
                        setClientSearch('');
                      }}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add New Client</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Enhanced Client Stats HUD with Basic Connection Status */}
          <div className="flex items-center space-x-2 sm:space-x-6">
            {selectedClient && (
              <>
                {/* Desktop Analytics */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="hidden sm:flex items-center space-x-4 bg-slate-800/50 backdrop-blur-sm px-4 py-2 rounded-lg border border-slate-700/50"
                >
                  <div className="flex items-center space-x-2">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-slate-300">Engagement</span>
                    <span className="font-bold text-yellow-400">{selectedClient.engagementScore || 0}%</span>
                  </div>
                  <div className="w-px h-4 bg-slate-600" />
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-slate-300">Properties</span>
                    <span className="font-bold text-green-400">{properties.length}</span>
                  </div>
                  <div className="w-px h-4 bg-slate-600" />
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-slate-300">Last Active</span>
                    <span className="font-bold text-blue-400">{getRelativeTime(selectedClient.lastActive)}</span>
                  </div>
                </motion.div>

                {/* Mobile Analytics - Condensed */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex sm:hidden items-center space-x-2 bg-slate-800/50 backdrop-blur-sm px-2 py-1 rounded-lg border border-slate-700/50"
                >
                  <div className="flex items-center space-x-1">
                    <span className="font-bold text-green-400 text-xs">{properties.length}</span>
                    <span className="text-xs text-slate-400">props</span>
                  </div>
                  <div className="w-px h-3 bg-slate-600" />
                  <div className="flex items-center space-x-1">
                    <span className="font-bold text-yellow-400 text-xs">{selectedClient.engagementScore || 0}%</span>
                    <span className="text-xs text-slate-400">eng</span>
                  </div>
                </motion.div>
              </>
            )}

            <div className="flex items-center space-x-2">
              {/* âœ… ADDED: Loading indicator for data operations */}
              {(clientsLoading || timelineLoading || analyticsLoading) && (
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              )}
              
              {/* Basic Connection Status Indicator */}
              <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-400' : 'bg-red-400'}`} />
              
              <div className="relative" data-notifications-dropdown>
                <button
                  onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                  className="relative p-1"
                >
                  <Bell className="w-5 h-5 text-slate-400 hover:text-white cursor-pointer transition-colors" />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-xs flex items-center justify-center text-white font-bold">
                      {notifications.filter(n => !n.read).length}
                    </span>
                  )}
                </button>
                
                {/* Notifications Dropdown */}
                {showNotificationsDropdown && (
                  <div 
                    data-notifications-dropdown
                    className="absolute right-0 top-8 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50"
                  >
                    <div className="p-3 border-b border-slate-700 flex items-center justify-between">
                      <h3 className="text-white font-semibold">Notifications</h3>
                      {notifications.length > 0 && (
                        <button
                          onClick={() => {
                            clearAllNotifications();
                            setShowNotificationsDropdown(false);
                          }}
                          className="text-xs text-slate-400 hover:text-white transition-colors"
                        >
                          Clear All
                        </button>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-slate-400">
                          <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>No notifications</p>
                        </div>
                      ) : (
                        notifications.slice(0, 10).map((notification) => (
                          <div
                            key={notification.id}
                            className={`p-3 border-b border-slate-700 last:border-b-0 hover:bg-slate-700/30 transition-colors ${
                              !notification.read ? 'bg-blue-500/5 border-l-4 border-l-blue-500' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-white text-sm font-medium">{notification.title}</p>
                                <p className="text-slate-300 text-xs mt-1">{notification.message}</p>
                                <p className="text-slate-500 text-xs mt-1">
                                  {new Date(notification.timestamp).toLocaleString()}
                                </p>
                              </div>
                              <div className="flex items-center space-x-1 ml-2">
                                {!notification.read && (
                                  <button
                                    onClick={() => markNotificationAsRead(notification.id)}
                                    className="w-6 h-6 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center transition-colors"
                                    title="Mark as read"
                                  >
                                    <span className="text-xs text-white">✓</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => removeNotification(notification.id)}
                                  className="w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors"
                                  title="Remove"
                                >
                                  <span className="text-xs text-white">×</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* <Search className="w-5 h-5 text-slate-400 hover:text-white cursor-pointer transition-colors" /> */}
            </div>
          </div>
        </div>
        {/* Settings Modal */}
<SettingsModal
  isOpen={showSettingsModal}
  onClose={() => setShowSettingsModal(false)}
  user={user || { id: '', email: '', firstName: '', lastName: '', plan: 'FREE' }}
  preferences={userPreferences || {
    emailTemplateStyle: 'modern',
    notifications: { email: true, desktop: true, feedback: true, newProperties: true },
    theme: 'dark',
    soundEnabled: true
  }}
  onSavePreferences={updateUserPreferences}
/>
      </div>
      {/* Share Timeline Modal */}
{selectedClient && (
  <ShareTimelineModal
    isOpen={showShareModal}
    onClose={() => setShowShareModal(false)}
    client={{
      id: selectedClient.id,
      name: selectedClient.name,
      email: selectedClient.email,
      phone: selectedClient.phone,
    }}
    timeline={{
      id: currentTimeline?.id || '',
      shareToken: currentTimeline?.shareToken || '',
      shareUrl: `${window.location.origin}/timeline/${currentTimeline?.shareToken}`,
      propertyCount: properties.length,
    }}
    agentName={`${user?.firstName || ''} ${user?.lastName || ''}`.trim()}
    onSendEmail={handleSendTimelineEmail}
    initialTemplate={userPreferences?.emailTemplateStyle || 'modern'}
    emailState={emailState}
  />
)}

      {/* Enhanced Bulk Send Notification Bar */}
      {selectedClient && bulkMode && bulkQueueCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`fixed ${!isOnline ? 'top-32' : 'top-24'} right-6 z-30 bg-gradient-to-r from-purple-600 to-purple-700 text-white px-6 py-3 rounded-xl shadow-lg border border-purple-500/30`}
        >
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Send className="w-4 h-4" />
              <span className="font-medium">{bulkQueueCount} properties ready to send</span>
            </div>
            <button
              onClick={handleSendBulkProperties}
              className="px-4 py-1 bg-white/20 hover:bg-white/30 rounded-md text-sm transition-colors font-medium"
            >
              Send Bulk Email
            </button>
          </div>
        </motion.div>
      )}

      {/* Main Timeline Canvas */}
      <div className={`${!isOnline ? 'pt-40' : 'pt-28'} px-6 pb-24`}>
        <div className="max-w-6xl mx-auto">
          {selectedClient ? (
            <>
              {/* Enhanced Timeline Header */}
              <div className="mb-12">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center"
                >
                  <h1 className="text-4xl font-bold text-white mb-4">
                    {selectedClient.name || 'Client'}'s Property Journey
                  </h1>
                  
                  {/* âœ… SIMPLIFIED: Basic user and connection info */}
                  <div className="flex items-center justify-center space-x-4 text-sm text-slate-400">
                    <span>Welcome back, {user?.firstName || 'Agent'}</span>
                    <span className={`flex items-center space-x-1 ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
                      {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                      <span>{isOnline ? 'Online' : 'Offline'}</span>
                    </span>
                  </div>
                </motion.div>
              </div>

              {/* âœ… ADDED: Conditional rendering with loading states */}
              {timelineLoading ? (
                <TimelineLoadingSkeleton />
              ) : properties.length > 0 ? (
                /* âœ… ENHANCED: Timeline with Date Grouping */
                <div className="relative">
                  {/* Center Timeline Line for Large Screens */}
                  <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500 transform -translate-x-1/2" />
                  
                  {/* Left Timeline Line for Mobile */}
                  <div className="lg:hidden absolute left-8 top-0 bottom-0 w-0.5 bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500" />

                  {/* âœ… FIXED: Timeline Items - GROUPED BY DATE with null safety */}
                  <div className="space-y-12 lg:space-y-16">
                    {(() => {
                      const sortedProperties = properties
                        .filter(p => p && p.addedAt) // Filter out invalid properties
                        .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
                      const groupedProperties = groupPropertiesByDate(sortedProperties);
                      let globalIndex = 0;

                      return Object.entries(groupedProperties).map(([dateString, dayProperties]) => (
                        <div key={dateString} className="space-y-12 lg:space-y-16">
                          {/* âœ… FIXED: Modern Date Header with error handling */}
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: globalIndex * 0.1 }}
                            className="flex items-center justify-center mb-8"
                          >
                            <div className="relative">
                              <div className="bg-gradient-to-r from-blue-500 via-purple-600 to-indigo-600 text-white px-8 py-4 rounded-2xl font-bold text-xl shadow-2xl border border-white/20 backdrop-blur-sm">
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
                          </motion.div>
                          
                          {/* Properties for this date */}
                          {dayProperties.map((property) => {
                            if (!property || !property.id) return null; // Skip invalid properties
                            
                            const currentIndex = globalIndex++;
                            return (
                              <PropertyCard
                                key={property.id}
                                property={property}
                                onFeedback={handlePropertyFeedback}
                                onViewMLS={(mlsLink) => handleViewMLS(mlsLink, property.address)}
                                onEdit={handleEditProperty}
                                onDelete={handleDeleteProperty}
                                isClientView={false}
                                index={currentIndex}
                                isAlternating={true}
                              />
                            );
                          })}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              ) : (
                /* Enhanced Empty State */
                <div className="text-center py-20">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-lg mx-auto"
                  >
                    <div className="relative mb-8">
                      <motion.button
                        onClick={() => setActiveModal('add-property')}
                        className="w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 rounded-full flex items-center justify-center mx-auto shadow-2xl transition-all duration-300 cursor-pointer"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Plus className="w-16 h-16 text-white" />
                      </motion.button>
                      <div className="absolute -inset-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full blur opacity-20 pointer-events-none" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4">Start Building the Timeline</h3>
                    <p className="text-slate-400 mb-8 text-lg leading-relaxed">
                      Add the first property to {selectedClient.name || 'this client'}'s journey and watch their engagement grow. 
                      Create a personalized experience that converts browsers into buyers.
                    </p>
                    <motion.button
                      onClick={() => setActiveModal('add-property')}
                      className="px-10 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Add First Property
                    </motion.button>
                  </motion.div>
                </div>
              )}
            </>
          ) : (
            /* Enhanced No Client Selected */
            <div className="text-center py-20">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-lg mx-auto"
              >
                <div className="relative mb-8">
                  <div className="w-32 h-32 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full flex items-center justify-center mx-auto">
                    <Target className="w-16 h-16 text-slate-400" />
                  </div>
                  <div className="absolute -inset-4 bg-gradient-to-br from-slate-600 to-slate-700 rounded-full blur opacity-20" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">Select Your Client</h3>
                <p className="text-slate-400 mb-8 text-lg leading-relaxed">
                  Choose a client from the dropdown above to view their property timeline and start building their personalized journey.
                </p>
                <motion.button
                  onClick={() => setActiveModal('clients')}
                  className="px-10 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-xl font-semibold text-lg transition-all duration-200 shadow-lg"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Manage Clients
                </motion.button>
              </motion.div>
            </div>
          )}
        </div>
      </div>

      {/* Prominent Add Property Button - Only show when there are properties */}
      {selectedClient && properties.length > 0 && (
        <div className="fixed bottom-32 right-20">
          <motion.button
            onClick={() => setActiveModal('add-property')}
            disabled={!isOnline}
            className={`w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 ${
              isOnline
                ? 'hover:scale-110 cursor-pointer' 
                : 'opacity-50 cursor-not-allowed'
            }`}
            whileHover={{ scale: isOnline ? 1.1 : 1 }}
            whileTap={{ scale: isOnline ? 0.95 : 1 }}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ delay: 0.2 }}
          >
            <Plus className="w-8 h-8 text-white" />
          </motion.button>
        </div>
      )}

     <div className="fixed bottom-6 right-6">
  <motion.div
    initial={{ opacity: 0, y: 50 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex items-center space-x-3 bg-slate-800/90 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-3 shadow-2xl"
  >
    {[
      { 
        icon: Users, 
        label: 'Clients', 
        action: () => setActiveModal('clients'), 
        color: 'from-blue-500 to-cyan-600',
        disabled: false 
      },
      { 
        icon: Share2,
        label: 'Share Timeline', 
        action: () => setShowShareModal(true),
        color: 'from-purple-500 to-pink-600',
        disabled: !selectedClient 
      },
      { 
        icon: BarChart3, 
        label: 'Analytics', 
        action: () => setShowAnalyticsModal(true), 
        color: 'from-purple-500 to-violet-600',
        disabled: false 
      },
      { 
        icon: User, 
        label: 'Profile', 
        action: () => setShowProfileModal(true), 
        color: 'from-green-500 to-emerald-600',
        disabled: false 
      },
      { 
        icon: Settings, 
        label: 'Settings', 
        action: () => setShowSettingsModal(true),
        color: 'from-gray-500 to-slate-600',
        disabled: false 
      }
    ].map(({ icon: Icon, label, action, color, disabled }) => (
      <motion.button
        key={label}
        onClick={() => !disabled && action()}
        disabled={disabled}
        className={`p-3 bg-gradient-to-br ${color} hover:scale-110 transition-all duration-200 rounded-xl shadow-lg group relative ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        whileHover={{ scale: disabled ? 1 : 1.1 }}
        whileTap={{ scale: disabled ? 1 : 0.95 }}
      >
        <Icon className="w-5 h-5 text-white" />
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1 bg-slate-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          {label}
        </div>
      </motion.button>
    ))}
  </motion.div>
</div>

      {/* Modals */}
      <BatchPropertyModal 
        isOpen={activeModal === 'add-property'} 
        onClose={() => {
          setActiveModal(null);
        }} 
      />

      <ClientsModal 
        isOpen={activeModal === 'clients'} 
        onClose={() => setActiveModal(null)} 
        />




{/* NEW: Settings Modal Integration */}
{user && (
  <SettingsModal
    isOpen={activeModal === 'settings'}
    onClose={() => setActiveModal(null)}
    user={user}
    preferences={userPreferences}
    onSavePreferences={handleSavePreferences}
  />
)}
 {/* Settings Modal - Fixed Integration */}
{showSettingsModal && (
  <SettingsModal
    isOpen={showSettingsModal}
    onClose={() => setShowSettingsModal(false)}
    user={user || { id: '', email: '', firstName: '', lastName: '', plan: 'FREE' }}
    preferences={userPreferences || {
      emailTemplateStyle: 'modern' as const,
      notifications: { email: true, desktop: true, feedback: true, newProperties: true },
      theme: 'dark' as const,
      soundEnabled: true,
      timezone: 'America/New_York',
      brandColor: '#3b82f6',
      logo: ''
    }}
    onSavePreferences={updateUserPreferences}
  />
)}

      {/* Analytics Modal */}
      {showAnalyticsModal && (
        <AnalyticsModal
          isOpen={showAnalyticsModal}
          onClose={() => setShowAnalyticsModal(false)}
        />
      )}

      <MLSViewModal
        isOpen={mlsModal.isOpen}
        mlsUrl={mlsModal.url}
        propertyAddress={mlsModal.address}
        onClose={() => setMlsModal({ isOpen: false, url: '', address: '' })}
      />

      {/* Notifications */}
      <Notifications />

      {/* Click outside to close dropdown */}
      {isClientDropdownOpen && (
        <div 
          className="fixed inset-0 z-45" 
          onClick={() => {
            setIsClientDropdownOpen(false);
            setClientSearch('');
          }}
        />
      )}
      <ProfileModal 
  isOpen={showProfileModal} 
  onClose={() => setShowProfileModal(false)} 
/>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, BellOff, Eye, MessageSquare, Heart, Volume2, VolumeX } from 'lucide-react';
import { useNotificationStore } from '@/stores/notificationStore';
import { requestNotificationPermission } from '@/lib/push-notifications';

export function NotificationSettings() {
  const { 
    settings, 
    updateSettings, 
    permissionStatus, 
    setPermissionStatus,
    getUnreadCount 
  } = useNotificationStore();
  
  const [isRequesting, setIsRequesting] = useState(false);
  const unreadCount = getUnreadCount();

  // Update permission status on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, [setPermissionStatus]);

  const handleBrowserNotificationToggle = async () => {
    if (!settings.browserNotifications) {
      // User wants to enable browser notifications
      setIsRequesting(true);
      
      try {
        const permission = await requestNotificationPermission();
        setPermissionStatus(permission);
        
        if (permission === 'granted') {
          updateSettings({ browserNotifications: true });
        }
      } catch (error) {
        console.error('Failed to request notification permission:', error);
      } finally {
        setIsRequesting(false);
      }
    } else {
      // User wants to disable browser notifications
      updateSettings({ browserNotifications: false });
    }
  };

  const handleSettingToggle = (setting: keyof typeof settings) => {
    updateSettings({ [setting]: !settings[setting] });
  };

  const getPermissionStatusText = () => {
    switch (permissionStatus) {
      case 'granted':
        return { text: 'Enabled', color: 'text-green-400', bgColor: 'bg-green-500/10' };
      case 'denied':
        return { text: 'Blocked by browser', color: 'text-red-400', bgColor: 'bg-red-500/10' };
      case 'default':
        return { text: 'Not requested', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' };
      default:
        return { text: 'Unknown', color: 'text-gray-400', bgColor: 'bg-gray-500/10' };
    }
  };

  const permissionStatus_ = getPermissionStatusText();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
            <Bell className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Notifications</h3>
            <p className="text-sm text-slate-400">
              Manage how you receive property updates
            </p>
          </div>
        </div>
        
        {unreadCount > 0 && (
          <div className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] text-center">
            {unreadCount}
          </div>
        )}
      </div>

      {/* Browser Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <Bell className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h4 className="text-white font-medium">Browser Push Notifications</h4>
              <p className="text-xs text-slate-400">Get notified even when the app is closed</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className={`px-2 py-1 rounded-lg text-xs font-medium ${permissionStatus_.bgColor} ${permissionStatus_.color}`}>
              {permissionStatus_.text}
            </div>
            
            <motion.button
              onClick={handleBrowserNotificationToggle}
              disabled={isRequesting || permissionStatus === 'denied'}
              className={`
                w-12 h-6 rounded-full transition-all duration-200 relative
                ${settings.browserNotifications 
                  ? 'bg-blue-500' 
                  : 'bg-slate-600'
                }
                ${isRequesting ? 'opacity-50 cursor-not-allowed' : ''}
                ${permissionStatus === 'denied' ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              whileTap={{ scale: isRequesting ? 1 : 0.95 }}
            >
              <motion.div
                className="w-4 h-4 bg-white rounded-full absolute top-1"
                initial={false}
                animate={{
                  x: settings.browserNotifications ? 26 : 2
                }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </motion.button>
          </div>
        </div>
        
        {permissionStatus === 'denied' && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            Browser notifications are blocked. Enable them in your browser settings to receive push notifications.
          </div>
        )}
      </motion.div>

      {/* Banner Notifications */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <Eye className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h4 className="text-white font-medium">In-App Banners</h4>
              <p className="text-xs text-slate-400">Show notification banners at the top of timeline</p>
            </div>
          </div>
          
          <motion.button
            onClick={() => handleSettingToggle('bannerNotifications')}
            className={`
              w-12 h-6 rounded-full transition-colors duration-200 relative
              ${settings.bannerNotifications ? 'bg-emerald-500' : 'bg-slate-600'}
            `}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              className="w-4 h-4 bg-white rounded-full absolute top-1"
              initial={false}
              animate={{
                x: settings.bannerNotifications ? 26 : 2
              }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </motion.button>
        </div>
      </motion.div>

      {/* Notification Types */}
      <div className="space-y-3">
        <h4 className="text-white font-medium text-sm">Notification Types</h4>
        
        {/* New Properties */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-between bg-slate-800/20 rounded-lg p-3"
        >
          <div className="flex items-center space-x-3">
            <Heart className="w-4 h-4 text-pink-400" />
            <span className="text-white text-sm">New Properties</span>
          </div>
          
          <motion.button
            onClick={() => handleSettingToggle('newProperties')}
            className={`
              w-10 h-5 rounded-full transition-colors duration-200 relative
              ${settings.newProperties ? 'bg-pink-500' : 'bg-slate-600'}
            `}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              className="w-3 h-3 bg-white rounded-full absolute top-1"
              initial={false}
              animate={{
                x: settings.newProperties ? 22 : 2
              }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </motion.button>
        </motion.div>

        {/* Timeline Updates */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-between bg-slate-800/20 rounded-lg p-3"
        >
          <div className="flex items-center space-x-3">
            <MessageSquare className="w-4 h-4 text-blue-400" />
            <span className="text-white text-sm">Timeline Updates</span>
          </div>
          
          <motion.button
            onClick={() => handleSettingToggle('timelineUpdates')}
            className={`
              w-10 h-5 rounded-full transition-colors duration-200 relative
              ${settings.timelineUpdates ? 'bg-blue-500' : 'bg-slate-600'}
            `}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              className="w-3 h-3 bg-white rounded-full absolute top-1"
              initial={false}
              animate={{
                x: settings.timelineUpdates ? 22 : 2
              }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </motion.button>
        </motion.div>

        {/* Feedback Requests */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex items-center justify-between bg-slate-800/20 rounded-lg p-3"
        >
          <div className="flex items-center space-x-3">
            <Heart className="w-4 h-4 text-yellow-400" />
            <span className="text-white text-sm">Feedback Requests</span>
          </div>
          
          <motion.button
            onClick={() => handleSettingToggle('feedbackRequests')}
            className={`
              w-10 h-5 rounded-full transition-colors duration-200 relative
              ${settings.feedbackRequests ? 'bg-yellow-500' : 'bg-slate-600'}
            `}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              className="w-3 h-3 bg-white rounded-full absolute top-1"
              initial={false}
              animate={{
                x: settings.feedbackRequests ? 22 : 2
              }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </motion.button>
        </motion.div>

        {/* Sound */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex items-center justify-between bg-slate-800/20 rounded-lg p-3"
        >
          <div className="flex items-center space-x-3">
            {settings.soundEnabled ? (
              <Volume2 className="w-4 h-4 text-green-400" />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-400" />
            )}
            <span className="text-white text-sm">Sound Effects</span>
          </div>
          
          <motion.button
            onClick={() => handleSettingToggle('soundEnabled')}
            className={`
              w-10 h-5 rounded-full transition-colors duration-200 relative
              ${settings.soundEnabled ? 'bg-green-500' : 'bg-slate-600'}
            `}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              className="w-3 h-3 bg-white rounded-full absolute top-1"
              initial={false}
              animate={{
                x: settings.soundEnabled ? 22 : 2
              }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </motion.button>
        </motion.div>
      </div>

      {/* Info */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <p className="text-blue-400 text-xs leading-relaxed">
          💡 <strong>Tip:</strong> Enable browser notifications to get real-time updates about new properties 
          even when you're not actively viewing the timeline. You can always change these settings later.
        </p>
      </div>
    </div>
  );
}
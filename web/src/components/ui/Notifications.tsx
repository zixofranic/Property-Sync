'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info, Activity, Heart } from 'lucide-react';
import { useMissionControlStore } from '@/stores/missionControlStore';

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  activity: Activity,
  feedback: Heart,
};

const colors = {
  success: 'from-green-500 to-emerald-600 border-green-500/20',
  error: 'from-red-500 to-rose-600 border-red-500/20',
  warning: 'from-yellow-500 to-amber-600 border-yellow-500/20',
  info: 'from-blue-500 to-cyan-600 border-blue-500/20',
  activity: 'from-purple-500 to-violet-600 border-purple-500/20',
  feedback: 'from-purple-600 to-pink-600 border-purple-500/20',
};

export function Notifications() {
  console.log('🔔 Notifications component rendered');
  const { notifications } = useMissionControlStore();
  const [hiddenToasts, setHiddenToasts] = useState<Set<string>>(new Set());
  const timersRef = useRef<{ [key: string]: NodeJS.Timeout }>({});

  // Create a dependency that changes when notifications change
  const notificationKey = notifications?.map(n => `${n.id}-${n.read}`).join(',') || '';

  // Auto-hide toasts after 5 seconds with proper timer management
  const hideNotification = useCallback((notificationId: string) => {
    console.log('🔔 Hiding notification:', notificationId);
    setHiddenToasts(prev => new Set(prev).add(notificationId));
    
    // Clean up timer
    if (timersRef.current[notificationId]) {
      clearTimeout(timersRef.current[notificationId]);
      delete timersRef.current[notificationId];
    }
  }, []);

  useEffect(() => {
    if (!notifications) return;

    console.log('🔔 Processing notifications:', notifications.length);
    console.log('🔔 Current timers:', Object.keys(timersRef.current));
    
    // Only handle new notifications that don't have timers yet
    notifications.forEach(notification => {
      const hasTimer = !!timersRef.current[notification.id];
      const isHidden = hiddenToasts.has(notification.id);
      
      if (!notification.read && !hasTimer && !isHidden) {
        console.log('🔔 Setting timer for new notification:', notification.id, notification.title);
        
        timersRef.current[notification.id] = setTimeout(() => {
          console.log('🔔 Auto-hiding notification:', notification.id);
          hideNotification(notification.id);
        }, 5000); // Increased to 5 seconds for better UX
      }
    });

    // Clean up timers for removed or read notifications
    Object.keys(timersRef.current).forEach(notificationId => {
      const notification = notifications.find(n => n.id === notificationId);
      if (!notification || notification.read) {
        console.log('🔔 Cleaning up timer for:', notificationId);
        clearTimeout(timersRef.current[notificationId]);
        delete timersRef.current[notificationId];
      }
    });

  }, [notifications, hiddenToasts, hideNotification]);

  // Show only unread notifications that haven't been hidden yet
  const toastNotifications = (notifications || [])
    .filter(n => {
      const shouldShow = !n.read && !hiddenToasts.has(n.id);
      if (!shouldShow && hiddenToasts.has(n.id)) {
        console.log('🔔 Filtering out hidden notification:', n.id, n.title);
      }
      return shouldShow;
    })
    .slice(0, 5);

  console.log('🔔 Current notifications:', notifications?.length || 0);
  console.log('🔔 Hidden toasts:', Array.from(hiddenToasts));
  console.log('🔔 Showing toasts:', toastNotifications.length);

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
      <AnimatePresence>
        {toastNotifications.map((notification) => {
          const Icon = icons[notification.type];
          const colorClass = colors[notification.type];

          return (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, x: 300, scale: 0.3 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 300, scale: 0.5, transition: { duration: 0.2 } }}
              className={`
                relative overflow-hidden rounded-xl border backdrop-blur-sm shadow-2xl
                bg-gradient-to-r ${colorClass}
                max-w-md w-96 pointer-events-auto
              `}
              // ✅ CHANGED: max-w-sm w-full → max-w-md w-96 (wider notifications)
            >
              <div className="p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="ml-3 w-0 flex-1">
                    <p className="text-sm font-medium text-white">
                      {notification.title}
                    </p>
                    <p className="mt-1 text-sm text-white/80">
                      {notification.message}
                    </p>
                    {/* Enhanced details for feedback notifications */}
                    {(notification.type === 'feedback' || notification.feedbackType) && (
                      <div className="mt-2 p-2 bg-white/10 rounded-md">
                        {notification.clientName && (
                          <p className="text-xs text-white/90 font-medium">
                            Client: {notification.clientName}
                          </p>
                        )}
                        {notification.propertyAddress && (
                          <p className="text-xs text-white/70 mt-1">
                            Property: {notification.propertyAddress}
                          </p>
                        )}
                        {notification.feedbackType && (
                          <p className="text-xs text-white/70 mt-1">
                            Feedback: {notification.feedbackType.charAt(0).toUpperCase() + notification.feedbackType.slice(1)}
                          </p>
                        )}
                      </div>
                    )}
                    {/* Enhanced details for activity notifications with client/property info */}
                    {notification.type === 'activity' && (notification.clientName || notification.propertyAddress) && (
                      <div className="mt-2 p-2 bg-white/10 rounded-md">
                        {notification.clientName && (
                          <p className="text-xs text-white/90 font-medium">
                            Client: {notification.clientName}
                          </p>
                        )}
                        {notification.propertyAddress && (
                          <p className="text-xs text-white/70 mt-1">
                            Property: {notification.propertyAddress}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex-shrink-0 flex">
                    <button
                      className="inline-flex text-white hover:text-white/80 focus:outline-none"
                      onClick={() => {
                        console.log('🔔 Manual close clicked for:', notification.id, notification.title);
                        hideNotification(notification.id);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              
              <motion.div
                className="absolute bottom-0 left-0 h-1 bg-white/30"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 5, ease: 'linear' }}
                // ✅ CHANGED: duration: 2 → duration: 5 (matches the 5s auto-dismiss)
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
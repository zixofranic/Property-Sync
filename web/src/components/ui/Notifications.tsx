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

  // Auto-hide toasts after 2 seconds
  useEffect(() => {
    console.log('🔔 useEffect triggered with notifications:', notifications?.length || 0, 'key:', notificationKey);
    if (!notifications) {
      console.log('🔔 No notifications, returning');
      return;
    }

    console.log('🔔 Processing notifications:', notifications.length);
    console.log('🔔 Current timers:', Object.keys(timersRef.current));
    console.log('🔔 Current hiddenToasts:', Array.from(hiddenToasts));
    
    notifications.forEach(notification => {
      console.log('🔔 Checking notification:', notification.id, {
        title: notification.title,
        read: notification.read,
        hasTimer: !!timersRef.current[notification.id],
        isHidden: hiddenToasts.has(notification.id)
      });
      
      if (!notification.read && !timersRef.current[notification.id]) {
        console.log('🔔 Setting timer for:', notification.id, notification.title);
        // Set timer to hide this toast after 2 seconds
        timersRef.current[notification.id] = setTimeout(() => {
          console.log('🔔 Timer fired! Hiding notification:', notification.id, notification.title);
          setHiddenToasts(prev => {
            const newHidden = new Set(prev).add(notification.id);
            console.log('🔔 Hidden toasts updated:', Array.from(newHidden));
            return newHidden;
          });
          delete timersRef.current[notification.id];
        }, 2000);
      } else {
        console.log('🔔 Skipping notification:', notification.id, 'read:', notification.read, 'hasTimer:', !!timersRef.current[notification.id]);
      }
    });

    // Cleanup timers for notifications that no longer exist or are read
    Object.keys(timersRef.current).forEach(notificationId => {
      const notification = notifications.find(n => n.id === notificationId);
      if (!notification || notification.read) {
        console.log('🔔 Cleaning up timer for:', notificationId, !notification ? 'missing' : 'read');
        clearTimeout(timersRef.current[notificationId]);
        delete timersRef.current[notificationId];
      }
    });

    return () => {
      Object.values(timersRef.current).forEach(timer => clearTimeout(timer));
    };
  }, [notificationKey]); // Re-run when notification IDs or read states change

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
                        // Hide toast immediately and clear timer
                        console.log('🔔 Manual close clicked for:', notification.id, notification.title);
                        setHiddenToasts(prev => {
                          const newHidden = new Set(prev).add(notification.id);
                          console.log('🔔 Hidden toasts now:', Array.from(newHidden));
                          return newHidden;
                        });
                        if (timersRef.current[notification.id]) {
                          clearTimeout(timersRef.current[notification.id]);
                          delete timersRef.current[notification.id];
                        }
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
                transition={{ duration: 2, ease: 'linear' }}
                // ✅ CHANGED: duration: 4 → duration: 2 (matches the 2s auto-dismiss)
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
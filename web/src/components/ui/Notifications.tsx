'use client';

import { useEffect } from 'react';
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
  const { notifications, removeNotification, markNotificationAsRead } = useMissionControlStore();

  useEffect(() => {
    const timers = (notifications || []).map(notification => {
      if (!notification.read) {
        return setTimeout(() => {
          // Mark as read instead of removing completely
          // This keeps them in the bell dropdown but removes the toast
          markNotificationAsRead(notification.id);
        }, 2000); // ✅ CHANGED: 4000ms → 2000ms (2 seconds)
      }
      return null;
    });

    return () => {
      timers.forEach(timer => {
        if (timer) clearTimeout(timer);
      });
    };
  }, [notifications, markNotificationAsRead]);

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
      <AnimatePresence>
        {(notifications || []).filter(n => !n.read).slice(0, 5).map((notification) => {
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
                      onClick={() => removeNotification(notification.id)}
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
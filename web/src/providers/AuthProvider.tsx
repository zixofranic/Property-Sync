// apps/web/src/providers/AuthProvider.tsx - FIXED: Simplified initialization without race conditions
'use client';

import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { useMissionControlStore, initializeApiClientIntegration } from '@/stores/missionControlStore';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  isInitialized: boolean;
  isLoading: boolean;
  retryDataLoading: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isInitialized: false,
  isLoading: true,
  retryDataLoading: () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  console.log('🟡 AUTH: Provider starting...');
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const initRef = useRef(false);
  
  const { 
    isAuthenticated, 
    checkAuthStatus,
    refreshAuth,
    logout,
    loadClients,
    loadDashboardAnalytics,
    addNotification,
  } = useMissionControlStore();

  // 🔄 Retry data loading function
  const retryDataLoading = async () => {
    if (!isAuthenticated) return;
    
    console.log('🔄 Retrying data loading...');
    try {
      await Promise.allSettled([
        loadClients(),
        loadDashboardAnalytics()
      ]);
      
      addNotification({
        type: 'success',
        title: 'Data Refreshed',
        message: 'Successfully reloaded your data.',
        read: false,
      });
    } catch (error) {
      console.error('❌ Retry failed:', error);
      addNotification({
        type: 'warning',
        title: 'Retry Failed',
        message: 'Unable to reload data. Please refresh the page.',
        read: false,
      });
    }
  };

  // 🚀 Single initialization effect
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const initializeAuth = async () => {
      try {
        console.log('🚀 AUTH: Starting initialization...');
        
        // Step 1: Setup API client integration
        console.log('🔧 AUTH: Setting up API client...');
        initializeApiClientIntegration();

        // Step 2: Check stored auth status (synchronous)
        console.log('🔍 AUTH: Checking stored auth...');
        checkAuthStatus();
        
        // Step 3: If we think we're authenticated, verify with server
        if (useMissionControlStore.getState().isAuthenticated) {
          console.log('🔄 AUTH: Verifying stored auth...');
          
          const isValid = await refreshAuth();
          
          if (isValid) {
            console.log('✅ AUTH: Valid session found');
            
            // Load initial data in background (don't await)
            setTimeout(() => {
              console.log('📊 AUTH: Loading initial data...');
              Promise.allSettled([
                loadClients(),
                loadDashboardAnalytics()
              ]).then(() => {
                console.log('📊 AUTH: Initial data loading complete');
              }).catch((error) => {
                console.warn('⚠️ AUTH: Some data failed to load:', error);
              });
            }, 100);
          } else {
            console.log('❌ AUTH: Session invalid, clearing state');
            logout();
          }
        } else {
          console.log('ℹ️ AUTH: No stored session found');
        }

      } catch (error) {
        console.error('❌ AUTH: Initialization error:', error);
        
        // Don't logout on init errors, just notify
        addNotification({
          type: 'warning',
          title: 'Initialization Warning',
          message: 'Session validation encountered an issue.',
          read: false,
        });
      } finally {
        console.log('🏁 AUTH: Initialization complete');
        setIsInitialized(true);
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []); // Empty deps - only run once

  // 🎨 Loading screen
  if (isLoading || !isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="relative mb-8">
            <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-purple-500/20 border-b-purple-500 rounded-full animate-spin mx-auto" 
                 style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}>
            </div>
          </div>
          
          <div className="space-y-3">
            <p className="text-white text-lg font-semibold">Loading Mission Control...</p>
            <p className="text-slate-400 text-sm">Setting up secure session</p>
          </div>
          
          <div className="mt-8 w-64 mx-auto">
            <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ 
      isInitialized, 
      isLoading, 
      retryDataLoading 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// 🛡️ Simplified route protection
export function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function AuthenticatedComponent(props: P) {
    const router = useRouter();
    const { isAuthenticated, isLoading } = useMissionControlStore();
    
    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        console.log('🛡️ AUTH: Not authenticated, redirecting to login');
        router.push('/login');
      }
    }, [isAuthenticated, isLoading, router]);

    // Show loading while checking auth
    if (isLoading) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white">Checking authentication...</p>
          </div>
        </div>
      );
    }

    // Don't render if not authenticated (will redirect)
    if (!isAuthenticated) {
      return null;
    }

    return <Component {...props} />;
  };
}
// apps/web/src/providers/AuthProvider.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useMissionControlStore } from '@/stores/missionControlStore';
import { apiClient } from '@/lib/api-client';

interface AuthContextType {
  isInitialized: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  isInitialized: false,
  isLoading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const { 
  isAuthenticated, 
  logout,
  loadClients,
  loadAnalytics,
  checkAuthStatus
  } = useMissionControlStore();

  useEffect(() => {
  const initializeAuth = async () => {
    try {
      // Check initial auth status
      checkAuthStatus();
      
      // If authenticated, load initial data
      if (isAuthenticated) {
        await Promise.all([
          loadClients(),
          loadAnalytics()
        ]);
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      logout();
    } finally {
      setIsInitialized(true);
      setIsLoading(false);
    }
  };

  initializeAuth();
}, []); // Remove the cleanup function since polling doesn't exist

  // Handle tab focus - refresh data when user returns
  useEffect(() => {
  if (!isAuthenticated) return;

  const handleFocus = () => {
    loadAnalytics();  // ✅ Correct function name
  };

  window.addEventListener('focus', handleFocus);
  return () => window.removeEventListener('focus', handleFocus);
}, [isAuthenticated, loadAnalytics]); 

  return (
    <AuthContext.Provider value={{ isInitialized, isLoading }}>
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

// HOC for protecting routes
export function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function AuthenticatedComponent(props: P) {
    const { isInitialized, isLoading } = useAuth();
    const { isAuthenticated } = useMissionControlStore();

    if (isLoading || !isInitialized) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white text-lg">Loading Mission Control...</p>
          </div>
        </div>
      );
    }

    if (!isAuthenticated) {
      // Redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return null;
    }

    return <Component {...props} />;
  };
}
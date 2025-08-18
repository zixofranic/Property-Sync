// apps/web/src/components/dashboard/DashboardProvider.tsx - FIXED
'use client';

import { useEffect } from 'react';
import { useMissionControlStore } from '@/stores/missionControlStore';

interface DashboardProviderProps {
  children: React.ReactNode;
  user?: any; // User data from server-side auth
}

export function DashboardProvider({ children, user }: DashboardProviderProps) {
  const { setUser } = useMissionControlStore();

  useEffect(() => {
    // Only set user if provided from server-side
    if (user) {
      setUser(user);
    }
    
    // Remove ALL data loading - let the store handle it via checkAuthStatus
    // This provider should only be a wrapper, not a data loader
  }, [user, setUser]);

  return <>{children}</>;
}
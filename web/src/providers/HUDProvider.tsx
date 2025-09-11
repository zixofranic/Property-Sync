'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { PropertyHUD } from '@/components/hud/PropertyHUD';

interface HUDContextType {
  showPropertyHUD: boolean;
  setShowPropertyHUD: (show: boolean) => void;
}

const HUDContext = createContext<HUDContextType | undefined>(undefined);

export function useHUD() {
  const context = useContext(HUDContext);
  if (context === undefined) {
    throw new Error('useHUD must be used within a HUDProvider');
  }
  return context;
}

interface HUDProviderProps {
  children: ReactNode;
}

export function HUDProvider({ children }: HUDProviderProps) {
  const [showPropertyHUD, setShowPropertyHUD] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Ensure client-side rendering
  useEffect(() => {
    setIsClient(true);
    console.log('🛒 HUDProvider: Client-side rendering initialized');
  }, []);

  // Load initial state from localStorage
  useEffect(() => {
    if (!isClient) return;
    
    const stored = localStorage.getItem('property-hud-visibility');
    console.log('🛒 HUDProvider: Initial localStorage check', { stored, isClient });
    if (stored === 'true') {
      setShowPropertyHUD(true);
      console.log('🛒 HUDProvider: Setting showPropertyHUD to true from localStorage');
    } else {
      console.log('🛒 HUDProvider: showPropertyHUD remains false, basket button should be visible');
    }
  }, [isClient]);

  // Save state to localStorage and sync across tabs
  const setShowPropertyHUDSynced = (show: boolean) => {
    setShowPropertyHUD(show);
    localStorage.setItem('property-hud-visibility', show.toString());
    console.log('HUD visibility changed:', show);
    
    // Trigger a storage event for same-tab awareness
    window.dispatchEvent(new StorageEvent('storage', {
      key: 'property-hud-visibility',
      newValue: show.toString(),
      storageArea: localStorage
    }));
  };

  // Listen for storage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'property-hud-visibility' && e.newValue !== null) {
        const newVisibility = e.newValue === 'true';
        setShowPropertyHUD(newVisibility);
        console.log('Cross-tab sync: HUD visibility updated from storage event', newVisibility);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  console.log('🛒 HUDProvider render:', { showPropertyHUD, shouldShowButton: !showPropertyHUD, isClient });

  return (
    <HUDContext.Provider value={{ showPropertyHUD, setShowPropertyHUD: setShowPropertyHUDSynced }}>
      {children}
      
      
      {/* Global Property HUD - persists across all pages */}
      {isClient && (
        <PropertyHUD 
          isVisible={showPropertyHUD}
          onClose={() => setShowPropertyHUDSynced(false)}
        />
      )}
    </HUDContext.Provider>
  );
}
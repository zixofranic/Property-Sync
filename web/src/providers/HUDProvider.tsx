'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { PropertyHUD } from '@/components/hud/PropertyHUD';
import { ShoppingBasket } from 'lucide-react';
import { motion } from 'framer-motion';

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
      
      {/* Global floating toggle button - always visible */}
      {!showPropertyHUD && (
        <>
          {console.log('🟠 RENDERING BASKET BUTTON - should be visible!', { isClient, showPropertyHUD })}
          <motion.button
            onClick={() => {
              console.log('🛒 Basket button clicked - opening HUD');
              setShowPropertyHUDSynced(true);
              }}
            className="fixed bottom-4 left-4 z-[100] w-14 h-14 bg-gradient-to-br from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 border-2 border-orange-300/50"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 1, scale: 1 }}
            animate={{ opacity: 1, scale: 1 }}
            title="Open Property Collector"
            style={{ zIndex: 100 }}
        >
          <ShoppingBasket className="w-6 h-6" />
          </motion.button>
        </>
      )}
      
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
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ISSUE 2 FIX: Badge State Persistence - Moved to separate file to prevent circular dependency
export interface HierarchicalUnreadCounts {
  totalUnread: number;
  clients: Array<{
    clientId: string;
    clientName: string;
    unreadCount: number;
    properties: Array<{
      propertyId: string;
      address: string;
      unreadCount: number;
    }>;
  }>;
}

// PHASE 2: Client badge counts (flat map of propertyId -> unreadCount)
export type ClientUnreadCounts = Record<string, number>;

interface CachedBadgeState {
  hierarchicalCounts: HierarchicalUnreadCounts | null;
  timestamp: number;
}

// PHASE 2: Client badge cache state
interface CachedClientBadgeState {
  clientCounts: ClientUnreadCounts | null;
  timestamp: number;
}

const CACHE_EXPIRATION_MS = 5 * 60 * 1000; // 5 minutes

// Create a separate store for badge persistence
interface BadgePersistenceStore {
  // Agent badge state
  cachedBadgeState: CachedBadgeState | null;
  setCachedBadgeState: (counts: HierarchicalUnreadCounts) => void;
  getCachedBadgeState: () => { counts: HierarchicalUnreadCounts; isFresh: boolean } | null;
  isCacheValid: () => boolean;
  clearCache: () => void;

  // PHASE 2: Client badge state
  cachedClientBadgeState: CachedClientBadgeState | null;
  setCachedClientBadgeState: (counts: ClientUnreadCounts) => void;
  getCachedClientBadgeState: () => { counts: ClientUnreadCounts; isFresh: boolean } | null;
  isClientCacheValid: () => boolean;
  clearClientCache: () => void;
}

export const useBadgePersistenceStore = create<BadgePersistenceStore>()(
  persist(
    (set, get) => ({
      // Agent badge state
      cachedBadgeState: null,

      // Set cached badge state with timestamp
      setCachedBadgeState: (counts: HierarchicalUnreadCounts) => {
        set({
          cachedBadgeState: {
            hierarchicalCounts: counts,
            timestamp: Date.now(),
          },
        });
      },

      // Get cached badge state with freshness check
      getCachedBadgeState: () => {
        const state = get().cachedBadgeState;
        if (!state || !state.hierarchicalCounts) return null;

        const age = Date.now() - state.timestamp;
        const isFresh = age < CACHE_EXPIRATION_MS;

        return {
          counts: state.hierarchicalCounts,
          isFresh,
        };
      },

      // Check if cache is valid (not expired)
      isCacheValid: () => {
        const state = get().cachedBadgeState;
        if (!state) return false;

        const age = Date.now() - state.timestamp;
        return age < CACHE_EXPIRATION_MS;
      },

      // Clear cache
      clearCache: () => {
        set({ cachedBadgeState: null });
      },

      // PHASE 2: Client badge state
      cachedClientBadgeState: null,

      // Set cached client badge state with timestamp
      setCachedClientBadgeState: (counts: ClientUnreadCounts) => {
        set({
          cachedClientBadgeState: {
            clientCounts: counts,
            timestamp: Date.now(),
          },
        });
      },

      // Get cached client badge state with freshness check
      getCachedClientBadgeState: () => {
        const state = get().cachedClientBadgeState;
        if (!state || !state.clientCounts) return null;

        const age = Date.now() - state.timestamp;
        const isFresh = age < CACHE_EXPIRATION_MS;

        return {
          counts: state.clientCounts,
          isFresh,
        };
      },

      // Check if client cache is valid (not expired)
      isClientCacheValid: () => {
        const state = get().cachedClientBadgeState;
        if (!state) return false;

        const age = Date.now() - state.timestamp;
        return age < CACHE_EXPIRATION_MS;
      },

      // Clear client cache
      clearClientCache: () => {
        set({ cachedClientBadgeState: null });
      },
    }),
    {
      name: 'badge-persistence-storage', // localStorage key
      partialize: (state) => ({
        cachedBadgeState: state.cachedBadgeState,
        cachedClientBadgeState: state.cachedClientBadgeState,
      }),
    }
  )
);

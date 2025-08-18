// apps/web/src/hooks/useUserData.ts - Unified User Data Access
'use client';

import { useMissionControlStore } from '@/stores/missionControlStore';
import { useProfileStore } from '@/stores/profileStore';

// Combined user data interface
export interface CombinedUserData {
  // Authentication fields (from missionControlStore)
  id: string;
  email: string;
  emailVerified: boolean;
  
  // Profile fields (from profileStore)
  firstName: string;
  lastName: string;
  company: string;
  phone: string;
  website: string;
  licenseNumber: string;
  bio: string;
  specialties: string[];
  yearsExperience: number;
  avatar: string;
  logo: string;
  brandColor: string;
  plan: string;
  
  // Computed properties
  fullName: string;
  displayName: string;
  initials: string;
}

// Authentication-only data interface
export interface UserAuthData {
  id: string;
  email: string;
  emailVerified: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
}

// Profile-only data interface  
export interface UserProfileData {
  firstName: string;
  lastName: string;
  company: string;
  phone: string;
  website: string;
  licenseNumber: string;
  bio: string;
  specialties: string[];
  yearsExperience: number;
  avatar: string;
  logo: string;
  brandColor: string;
  plan: string;
  isLoading: boolean;
  error: string | null;
}

/**
 * Main hook: Returns complete user object (auth + profile combined)
 * Returns null if not fully authenticated/loaded
 */
export function useUserData(): CombinedUserData | null {
  const { user, isAuthenticated } = useMissionControlStore();
  const { profile, isLoading: profileLoading } = useProfileStore();
  
  // Return null if not authenticated or profile still loading
  if (!isAuthenticated || !user || profileLoading || !profile) {
    return null;
  }
  
  // Combine auth and profile data
  const fullName = `${profile.firstName} ${profile.lastName}`.trim();
  const displayName = fullName || profile.firstName || user.email.split('@')[0];
  const initials = `${profile.firstName?.[0] || ''}${profile.lastName?.[0] || ''}`.toUpperCase() || user.email[0].toUpperCase();
  
  return {
    // Auth fields
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    
    // Profile fields
    firstName: profile.firstName,
    lastName: profile.lastName,
    company: profile.company,
    phone: profile.phone,
    website: profile.website,
    licenseNumber: profile.licenseNumber,
    bio: profile.bio,
    specialties: profile.specialties,
    yearsExperience: profile.yearsExperience,
    avatar: profile.avatar,
    logo: profile.logo,
    brandColor: profile.brandColor,
    plan: profile.plan,
    
    // Computed properties
    fullName,
    displayName,
    initials,
  };
}

/**
 * Auth-only hook: Returns only authentication-related data/methods
 */
export function useUserAuth(): UserAuthData & {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshAuth: () => Promise<boolean>;
} {
  const { 
    user, 
    isAuthenticated, 
    isLoading, 
    authError, 
    login, 
    logout, 
    refreshAuth 
  } = useMissionControlStore();
  
  return {
    id: user?.id || '',
    email: user?.email || '',
    emailVerified: user?.emailVerified || false,
    isAuthenticated,
    isLoading,
    authError,
    login,
    logout,
    refreshAuth,
  };
}

/**
 * Profile-only hook: Returns only profile-related data/methods
 */
export function useUserProfile(): UserProfileData & {
  updateProfile: (updates: Partial<UserProfileData>) => Promise<void>;
  loadProfile: () => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  uploadLogo: (file: File) => Promise<void>;
} {
  const { 
    profile, 
    isLoading, 
    error, 
    updateProfile, 
    loadProfile,
    uploadAvatar,
    uploadLogo 
  } = useProfileStore();
  
  return {
    firstName: profile?.firstName || '',
    lastName: profile?.lastName || '',
    company: profile?.company || '',
    phone: profile?.phone || '',
    website: profile?.website || '',
    licenseNumber: profile?.licenseNumber || '',
    bio: profile?.bio || '',
    specialties: profile?.specialties || [],
    yearsExperience: profile?.yearsExperience || 0,
    avatar: profile?.avatar || '',
    logo: profile?.logo || '',
    brandColor: profile?.brandColor || '#3b82f6',
    plan: profile?.plan || 'FREE',
    isLoading,
    error,
    updateProfile,
    loadProfile,
    uploadAvatar,
    uploadLogo,
  };
}

/**
 * Loading state hook: Returns combined loading states
 */
export function useUserLoadingState(): {
  isAuthLoading: boolean;
  isProfileLoading: boolean;
  isAnyLoading: boolean;
  isFullyLoaded: boolean;
} {
  const { isLoading: authLoading, isAuthenticated } = useMissionControlStore();
  const { isLoading: profileLoading, profile } = useProfileStore();
  
  return {
    isAuthLoading: authLoading,
    isProfileLoading: profileLoading,
    isAnyLoading: authLoading || profileLoading,
    isFullyLoaded: isAuthenticated && !profileLoading && !!profile,
  };
}

/**
 * Error state hook: Returns combined error states
 */
export function useUserErrors(): {
  authError: string | null;
  profileError: string | null;
  hasAnyError: boolean;
  clearAllErrors: () => void;
} {
  const { authError, clearErrors: clearAuthErrors } = useMissionControlStore();
  const { error: profileError, clearError: clearProfileError } = useProfileStore();
  
  const clearAllErrors = () => {
    clearAuthErrors();
    clearProfileError();
  };
  
  return {
    authError,
    profileError,
    hasAnyError: !!(authError || profileError),
    clearAllErrors,
  };
}

/**
 * Utility hook for display purposes
 */
export function useUserDisplay(): {
  displayName: string;
  initials: string;
  avatar: string;
  brandColor: string;
  isReady: boolean;
} {
  const userData = useUserData();
  
  if (!userData) {
    return {
      displayName: 'User',
      initials: 'U',
      avatar: '',
      brandColor: '#3b82f6',
      isReady: false,
    };
  }
  
  return {
    displayName: userData.displayName,
    initials: userData.initials,
    avatar: userData.avatar,
    brandColor: userData.brandColor,
    isReady: true,
  };
}
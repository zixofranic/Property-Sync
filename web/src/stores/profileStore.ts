// apps/web/src/stores/profileStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { apiClient } from '@/lib/api-client';

// Profile types matching your backend DTOs
export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company?: string;
  phone?: string;
  website?: string;
  licenseNumber?: string;
  avatar?: string;
  bio?: string;
  timezone?: string;
  specialties: string[];
  yearsExperience?: number;
  notifications?: {
    emailNewProperties: boolean;
    emailClientFeedback: boolean;
    emailWeeklyReport: boolean;
    smsUrgentOnly: boolean;
    smsClientActivity: boolean;
  };
  onboardingComplete: boolean;
  logo?: string;
  brandColor: string;
  plan: string;
  emailVerified: boolean;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
  website?: string;
  licenseNumber?: string;
  avatar?: string;
  bio?: string;
  timezone?: string;
  specialties?: string[];
  yearsExperience?: number;
  notifications?: {
    emailNewProperties?: boolean;
    emailClientFeedback?: boolean;
    emailWeeklyReport?: boolean;
    smsUrgentOnly?: boolean;
    smsClientActivity?: boolean;
  };
  logo?: string;
  brandColor?: string;
}

export interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface ProfileState {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  isUpdating: boolean;
  updateError: string | null;
}

interface ProfileActions {
  loadProfile: () => Promise<void>;
  updateProfile: (data: UpdateProfileData) => Promise<boolean>;
  changePassword: (data: ChangePasswordData) => Promise<boolean>;
  clearErrors: () => void;
  setProfile: (profile: UserProfile) => void;
}

export const useProfileStore = create<ProfileState & ProfileActions>()(
  devtools(
    (set, get) => ({
      // State
      profile: null,
      isLoading: false,
      error: null,
      isUpdating: false,
      updateError: null,

      // Actions
      loadProfile: async () => {
        set({ isLoading: true, error: null });

        try {
          const response = await apiClient.request('/api/v1/users/profile');

          if (response.error) {
            set({ error: response.error, isLoading: false });
            return;
          }

          if (response.data) {
            set({
              profile: response.data,
              isLoading: false,
              error: null,
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load profile';
          set({ error: errorMessage, isLoading: false });
        }
      },

      updateProfile: async (data: UpdateProfileData): Promise<boolean> => {
        set({ isUpdating: true, updateError: null });

        try {
          const response = await apiClient.request('/api/v1/users/profile', {
            method: 'PATCH',
            body: JSON.stringify(data),
          });

          if (response.error) {
            set({ updateError: response.error, isUpdating: false });
            return false;
          }

          if (response.data) {
            set({
              profile: response.data,
              isUpdating: false,
              updateError: null,
            });
            return true;
          }

          return false;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
          set({ updateError: errorMessage, isUpdating: false });
          return false;
        }
      },

      changePassword: async (data: ChangePasswordData): Promise<boolean> => {
        set({ isUpdating: true, updateError: null });

        try {
          const response = await apiClient.request('/api/v1/users/change-password', {
            method: 'POST',
            body: JSON.stringify({
              currentPassword: data.currentPassword,
              newPassword: data.newPassword,
            }),
          });

          if (response.error) {
            set({ updateError: response.error, isUpdating: false });
            return false;
          }

          set({ isUpdating: false, updateError: null });
          return true;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to change password';
          set({ updateError: errorMessage, isUpdating: false });
          return false;
        }
      },

      clearErrors: () => set({ error: null, updateError: null }),

      setProfile: (profile: UserProfile) => set({ profile }),
    }),
    { name: 'Profile Store' }
  )
);

// Convenience hooks for components
export const useProfile = () => {
  const {
    profile,
    isLoading,
    error,
    loadProfile,
    clearErrors
  } = useProfileStore();

  return {
    profile,
    isLoading,
    error,
    loadProfile,
    clearErrors
  };
};

export const useProfileActions = () => {
  const {
    updateProfile,
    changePassword,
    isUpdating,
    updateError,
    clearErrors
  } = useProfileStore();

  return {
    updateProfile,
    changePassword,
    isUpdating,
    updateError,
    clearErrors
  };
};
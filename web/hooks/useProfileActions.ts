// apps/web/src/hooks/useProfileActions.ts
import { useState, useCallback } from 'react';
import { useMissionControlStore } from '@/stores/missionControlStore';
import { apiClient } from '@/lib/api-client';

interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface ProfileUpdateData {
  firstName?: string;
  lastName?: string;
  company?: string;
  phone?: string;
  website?: string;
  licenseNumber?: string;
  bio?: string;
  yearsExperience?: number;
  specialties?: string[];
  brandColor?: string;
  logo?: string;
}

export function useProfileActions() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  
  const { setUser, addNotification } = useMissionControlStore();

  const changePassword = useCallback(async (passwordData: PasswordChangeData): Promise<boolean> => {
    // Validate passwords match
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setUpdateError('Passwords do not match');
      return false;
    }

    setIsUpdating(true);
    setUpdateError(null);

    try {
      const response = await apiClient.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      
      if (response.error) {
        setUpdateError(response.error);
        addNotification({
          type: 'error',
          title: 'Password Change Failed',
          message: response.error,
          read: false,
        });
        return false;
      }

      addNotification({
        type: 'success',
        title: 'Password Changed',
        message: 'Your password has been updated successfully',
        read: false,
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to change password';
      setUpdateError(errorMessage);
      addNotification({
        type: 'error',
        title: 'Password Change Error',
        message: errorMessage,
        read: false,
      });
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [addNotification]);

  const updateProfile = useCallback(async (profileData: ProfileUpdateData): Promise<boolean> => {
    setIsUpdating(true);
    setUpdateError(null);

    try {
      const response = await apiClient.updateUserProfile(profileData);
      
      if (response.error) {
        setUpdateError(response.error);
        addNotification({
          type: 'error',
          title: 'Profile Update Failed',
          message: response.error,
          read: false,
        });
        return false;
      }

      if (response.data) {
        // Update user in store
        setUser({
          id: response.data.id,
          email: response.data.email,
          firstName: response.data.firstName || '',
          lastName: response.data.lastName || '',
          plan: response.data.plan || 'FREE',
          emailVerified: response.data.emailVerified || false,
        });

        addNotification({
          type: 'success',
          title: 'Profile Updated',
          message: 'Your profile has been updated successfully',
          read: false,
        });

        return true;
      }

      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update profile';
      setUpdateError(errorMessage);
      addNotification({
        type: 'error',
        title: 'Profile Update Error',
        message: errorMessage,
        read: false,
      });
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [setUser, addNotification]);

  const clearErrors = useCallback(() => {
    setUpdateError(null);
  }, []);

  return {
    changePassword,
    updateProfile,
    isUpdating,
    updateError,
    clearErrors,
  };
}
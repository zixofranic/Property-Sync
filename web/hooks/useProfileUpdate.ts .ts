// apps/web/src/hooks/useProfileUpdate.ts - Debounced profile updates
import { useState, useCallback, useRef } from 'react';
import { useMissionControlStore } from '@/stores/missionControlStore';
import { apiClient } from '@/lib/api-client';

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

export function useProfileUpdate() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const updateInProgressRef = useRef(false);
  const lastUpdateRef = useRef<number>(0);
  
  const { setUser, addNotification } = useMissionControlStore();

  const updateProfile = useCallback(async (data: ProfileUpdateData) => {
    // Prevent multiple simultaneous updates
    if (updateInProgressRef.current) {
      console.log('Profile update already in progress, skipping');
      addNotification({
        type: 'warning',
        title: 'Please Wait',
        message: 'Previous update is still processing',
        read: false,
      });
      return false;
    }

    // Debounce - prevent updates within 1 second of each other
    const now = Date.now();
    if (now - lastUpdateRef.current < 1000) {
      console.log('Profile update too soon after last update, skipping');
      return false;
    }

    updateInProgressRef.current = true;
    lastUpdateRef.current = now;
    setIsUpdating(true);
    setUpdateError(null);

    try {
      console.log('Updating profile with data:', data);
      
      const response = await apiClient.updateUserProfile(data);
      
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
        // Update the user in the store
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
        title: 'Update Error',
        message: errorMessage,
        read: false,
      });
      return false;
    } finally {
      setIsUpdating(false);
      updateInProgressRef.current = false;
    }
  }, [setUser, addNotification]);

  return {
    updateProfile,
    isUpdating,
    updateError,
    clearError: () => setUpdateError(null),
  };
}
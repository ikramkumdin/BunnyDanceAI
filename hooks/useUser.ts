'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { User } from '@/types';
import { getUser, createUser, updateUser as updateUserInFirestore } from '@/lib/firestore';

export function useUser() {
  const { user, setUser } = useStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeUser();
  }, []);

  const initializeUser = async () => {
    try {
      // Try to get user ID from localStorage (for persistence across sessions)
      let userId = localStorage.getItem('bunnyDance_userId');
      
      if (userId) {
        // Fetch user from Firestore
        const firestoreUser = await getUser(userId);
        if (firestoreUser) {
          setUser(firestoreUser);
          setIsLoading(false);
          return;
        }
      }

      // Create new user if none exists
      await createDefaultUser();
    } catch (error) {
      console.error('Error initializing user:', error);
      await createDefaultUser();
    } finally {
      setIsLoading(false);
    }
  };

  const createDefaultUser = async () => {
    try {
      const defaultUserData: Omit<User, 'id'> = {
        tier: 'free',
        credits: 0,
        dailyVideoCount: 0,
        lastVideoDate: new Date().toISOString(),
        isAgeVerified: false,
        createdAt: new Date().toISOString(),
      };

      const userId = await createUser(defaultUserData);
      const newUser: User = {
        id: userId,
        ...defaultUserData,
      };

      setUser(newUser);
      localStorage.setItem('bunnyDance_userId', userId);
    } catch (error) {
      console.error('Error creating user:', error);
      // Fallback to localStorage if Firestore fails
      const fallbackUser: User = {
        id: `user_${Date.now()}`,
        tier: 'free',
        credits: 0,
        dailyVideoCount: 0,
        lastVideoDate: new Date().toISOString(),
        isAgeVerified: false,
        createdAt: new Date().toISOString(),
      };
      setUser(fallbackUser);
      localStorage.setItem('bunnyDance_user', JSON.stringify(fallbackUser));
    }
  };

  const updateUser = async (updates: Partial<User>) => {
    if (user) {
      try {
        // Update in Firestore
        await updateUserInFirestore(user.id, updates);
        
        // Update local state
        const updatedUser = { ...user, ...updates };
        setUser(updatedUser);
      } catch (error) {
        console.error('Error updating user:', error);
        // Fallback to local state update
        const updatedUser = { ...user, ...updates };
        setUser(updatedUser);
      }
    }
  };

  const resetDailyCount = () => {
    if (user) {
      const today = new Date().toISOString().split('T')[0];
      const lastDate = user.lastVideoDate.split('T')[0];
      
      if (today !== lastDate) {
        updateUser({
          dailyVideoCount: 0,
          lastVideoDate: new Date().toISOString(),
        });
      }
    }
  };

  return { user, updateUser, resetDailyCount, isLoading };
}


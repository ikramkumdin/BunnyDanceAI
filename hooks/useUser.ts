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
      // Try to get user ID from localStorage
      const storedUserId = localStorage.getItem('bunnyDance_userId');

      if (storedUserId) {
        // Fetch user from Firestore with retry
        let firestoreUser = null;
        let retries = 0;
        while (!firestoreUser && retries < 2) {
          firestoreUser = await getUser(storedUserId);
          if (!firestoreUser) await new Promise(r => setTimeout(r, 1000));
          retries++;
        }

        if (firestoreUser) {
          setUser(firestoreUser);
          setIsLoading(false);
          return;
        } else {
          // If Firestore is still unreachable but we have a stored ID,
          // assume the user is valid and continue with the stored ID to avoid losing assets.
          console.warn('⚠️ Firestore unreachable, using stored user ID');
          setUser({
            id: storedUserId,
            tier: 'free',
            credits: 0,
            dailyVideoCount: 0,
            lastVideoDate: new Date().toISOString(),
            isAgeVerified: false,
            createdAt: new Date().toISOString(),
          } as User);
          setIsLoading(false);
          return;
        }
      }

      // Create new user if no ID exists in localStorage
      await createDefaultUser();
    } catch (error) {
      console.error('Error initializing user:', error);
      // Only create a totally new user if we really have no choice
      if (!localStorage.getItem('bunnyDance_userId')) {
        await createDefaultUser();
      }
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


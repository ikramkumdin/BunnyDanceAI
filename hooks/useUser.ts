'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { User } from '@/types';
import { getUser, updateUser as updateUserInFirestore } from '@/lib/firestore';
import { onAuthChange, getCurrentFirebaseUser } from '@/lib/auth';

export function useUser() {
  const { user, setUser } = useStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeUser();

    // Listen for auth state changes
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        // User is signed in, load their Firestore data
        try {
          const firestoreUser = await getUser(firebaseUser.uid);
          if (firestoreUser) {
            setUser(firestoreUser);
          } else {
            // Create Firestore user if doesn't exist
            const { doc, setDoc, Timestamp } = await import('firebase/firestore');
            const { db } = await import('@/lib/firebase');
            const userRef = doc(db, 'users', firebaseUser.uid);
            const userData: Omit<User, 'id'> = {
              email: firebaseUser.email || undefined,
              tier: 'free',
              credits: 0,
              dailyVideoCount: 0,
              lastVideoDate: new Date().toISOString(),
              isAgeVerified: false,
              createdAt: new Date().toISOString(),
            };
            await setDoc(userRef, {
              ...userData,
              createdAt: Timestamp.now(),
            });
            setUser({
              id: firebaseUser.uid,
              ...userData,
            });
          }
          localStorage.setItem('bunnyDance_userId', firebaseUser.uid);
        } catch (error) {
          console.error('Error loading user after auth change:', error);
        }
      } else {
        // User is signed out, check for anonymous user
        try {
          const storedUserId = localStorage.getItem('bunnyDance_userId');
          if (storedUserId) {
            // Try to load anonymous user
            const firestoreUser = await getUser(storedUserId);
            if (firestoreUser && !firestoreUser.email) {
              // Anonymous user, keep them signed in
              setUser(firestoreUser);
            } else {
              // No anonymous user, clear state
              setUser(null);
              localStorage.removeItem('bunnyDance_userId');
              // Clear assets from store on sign out
              const { useStore } = await import('@/store/useStore');
              const store = useStore.getState();
              store.setVideos([]);
              store.setImages([]);
            }
          } else {
            setUser(null);
            // Clear assets from store
            const { useStore } = await import('@/store/useStore');
            const store = useStore.getState();
            store.setVideos([]);
            store.setImages([]);
          }
        } catch (error) {
          console.error('Error checking anonymous user:', error);
          setUser(null);
          // Clear assets from store on error
          const { useStore } = await import('@/store/useStore');
          const store = useStore.getState();
          store.setVideos([]);
          store.setImages([]);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const initializeUser = async () => {
    try {
      // First check Firebase Auth
      const firebaseUser = getCurrentFirebaseUser();
      
      if (firebaseUser) {
        // User is authenticated, load from Firestore
        const firestoreUser = await getUser(firebaseUser.uid);
        if (firestoreUser) {
          setUser(firestoreUser);
          localStorage.setItem('bunnyDance_userId', firebaseUser.uid);
          setIsLoading(false);
          return;
        }
      }

      // Try to get user ID from localStorage (for anonymous users)
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

      // Create new anonymous user if no ID exists
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

      // Create anonymous user with random ID
      const { doc, setDoc, Timestamp, collection } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      const userRef = doc(collection(db, 'users'));
      const userId = userRef.id;
      
      await setDoc(userRef, {
        ...defaultUserData,
        createdAt: Timestamp.now(),
      });

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
      localStorage.setItem('bunnyDance_userId', fallbackUser.id);
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


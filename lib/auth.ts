'use client';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';
import { auth } from './firebase';
import { getUser, getUserByEmail, updateUser } from './firestore';
import { User } from '@/types';

export async function signUp(email: string, password: string, displayName?: string): Promise<{ user: User; firebaseUser: FirebaseUser }> {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized. Please enable Authentication in Firebase Console and ensure your environment variables are set correctly.');
  }

  // Check if user already exists in Firestore by email
  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    throw new Error('An account with this email already exists');
  }

  // Create Firebase Auth user
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const firebaseUser = userCredential.user;

  // Update display name if provided
  if (displayName) {
    await updateProfile(firebaseUser, { displayName });
  }

  // Create or get Firestore user
  let user: User;
  const firestoreUser = await getUser(firebaseUser.uid);
  
  if (firestoreUser) {
    // Update existing user with email
    await updateUser(firebaseUser.uid, { email });
    user = { ...firestoreUser, email };
  } else {
    // Create new user in Firestore with Firebase UID
    const userData: Omit<User, 'id'> = {
      email,
      tier: 'free',
      credits: 0, // Legacy field, kept for backward compatibility
      imageCredits: 3, // Free tier: 3 image credits
      videoCredits: 3, // Free tier: 3 video credits
      dailyVideoCount: 0,
      lastVideoDate: new Date().toISOString(),
      isAgeVerified: false,
      createdAt: new Date().toISOString(),
    };
    // Use Firebase UID as the document ID
    const { db } = await import('./firebase');
    const { doc, setDoc, Timestamp } = await import('firebase/firestore');
    const userRef = doc(db, 'users', firebaseUser.uid);
    await setDoc(userRef, {
      ...userData,
      createdAt: Timestamp.now(),
    });
    user = {
      id: firebaseUser.uid,
      ...userData,
    };
  }

  // Store user ID in localStorage
  localStorage.setItem('bunnyDance_userId', firebaseUser.uid);

  return { user, firebaseUser };
}

export async function signIn(email: string, password: string): Promise<{ user: User; firebaseUser: FirebaseUser }> {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized. Please enable Authentication in Firebase Console and ensure your environment variables are set correctly.');
  }

  // Sign in with Firebase Auth
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const firebaseUser = userCredential.user;

  // Get or create Firestore user
  let user = await getUser(firebaseUser.uid);
  
  if (!user) {
    // Create new user in Firestore if doesn't exist with Firebase UID
    const userData: Omit<User, 'id'> = {
      email: firebaseUser.email || email,
      tier: 'free',
      credits: 0, // Legacy field, kept for backward compatibility
      imageCredits: 3, // Free tier: 3 image credits
      videoCredits: 3, // Free tier: 3 video credits
      dailyVideoCount: 0,
      lastVideoDate: new Date().toISOString(),
      isAgeVerified: false,
      createdAt: new Date().toISOString(),
    };
    // Use Firebase UID as the document ID
    const { db } = await import('./firebase');
    const { doc, setDoc, Timestamp } = await import('firebase/firestore');
    const userRef = doc(db, 'users', firebaseUser.uid);
    await setDoc(userRef, {
      ...userData,
      createdAt: Timestamp.now(),
    });
    user = {
      id: firebaseUser.uid,
      ...userData,
    };
  } else if (!user.email) {
    // Update user with email if missing
    await updateUser(firebaseUser.uid, { email: firebaseUser.email || email });
    user = { ...user, email: firebaseUser.email || email };
  }

  // Store user ID in localStorage
  localStorage.setItem('bunnyDance_userId', firebaseUser.uid);

  return { user, firebaseUser };
}

export async function signOut(): Promise<void> {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized. Please enable Authentication in Firebase Console.');
  }

  await firebaseSignOut(auth);
  localStorage.removeItem('bunnyDance_userId');
  
  // Clear assets from store (they're stored in Firestore, not localStorage)
  // This ensures clean state on sign out
  if (typeof window !== 'undefined') {
    const { useStore } = await import('@/store/useStore');
    const store = useStore.getState();
    store.setVideos([]);
    store.setImages([]);
  }
}

export async function resetPassword(email: string): Promise<void> {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized. Please enable Authentication in Firebase Console.');
  }

  await sendPasswordResetEmail(auth, email);
}

export function getCurrentFirebaseUser(): FirebaseUser | null {
  if (!auth) {
    return null;
  }
  return auth.currentUser;
}

export async function signInWithGoogle(): Promise<{ user: User; firebaseUser: FirebaseUser }> {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized. Please enable Authentication in Firebase Console and ensure Google Sign-In is enabled.');
  }

  const provider = new GoogleAuthProvider();
  // Request additional scopes if needed
  provider.addScope('profile');
  provider.addScope('email');

  // Sign in with Google popup
  const userCredential = await signInWithPopup(auth, provider);
  const firebaseUser = userCredential.user;

  // Get or create Firestore user
  let user = await getUser(firebaseUser.uid);
  
  if (!user) {
    // Create new user in Firestore with Firebase UID
    const userData: Omit<User, 'id'> = {
      email: firebaseUser.email || undefined,
      tier: 'free',
      credits: 0, // Legacy field, kept for backward compatibility
      imageCredits: 3, // Free tier: 3 image credits
      videoCredits: 3, // Free tier: 3 video credits
      dailyVideoCount: 0,
      lastVideoDate: new Date().toISOString(),
      isAgeVerified: false,
      createdAt: new Date().toISOString(),
    };
    // Use Firebase UID as the document ID
    const { db } = await import('./firebase');
    const { doc, setDoc, Timestamp } = await import('firebase/firestore');
    const userRef = doc(db, 'users', firebaseUser.uid);
    await setDoc(userRef, {
      ...userData,
      createdAt: Timestamp.now(),
    });
    user = {
      id: firebaseUser.uid,
      ...userData,
    };
  } else if (!user.email && firebaseUser.email) {
    // Update user with email if missing
    await updateUser(firebaseUser.uid, { email: firebaseUser.email });
    user = { ...user, email: firebaseUser.email };
  }

  // Store user ID in localStorage
  localStorage.setItem('bunnyDance_userId', firebaseUser.uid);

  return { user, firebaseUser };
}

export function onAuthChange(callback: (user: FirebaseUser | null) => void): () => void {
  if (!auth) {
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

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
import { FirebaseError } from 'firebase/app';
import { auth } from './firebase';
import { getUser, getUserByEmail, updateUser } from './firestore';
import { User } from '@/types';

function toFriendlyAuthError(err: unknown): Error {
  if (err instanceof FirebaseError) {
    if (err.code === 'auth/network-request-failed') {
      return new Error(
        'Network request failed while contacting Firebase. This is usually caused by a blocked connection (adblock/VPN/firewall), a wrong Firebase Auth domain configuration, or missing NEXT_PUBLIC_FIREBASE_* env vars on Vercel. Check browser console + Network tab, and ensure your site domain is added to Firebase Auth -> Settings -> Authorized domains.'
      );
    }

    if (err.code === 'auth/unauthorized-domain') {
      return new Error(
        'This domain is not authorized for Firebase Auth. Add your current site domain to Firebase Console -> Authentication -> Settings -> Authorized domains, then refresh and try again.'
      );
    }

    return new Error(err.message || 'Firebase authentication error');
  }

  if (err instanceof Error) return err;
  return new Error('Authentication failed. Please try again.');
}

export async function signUp(email: string, password: string, displayName?: string): Promise<{ user: User; firebaseUser: FirebaseUser }> {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized. Please enable Authentication in Firebase Console and ensure your environment variables are set correctly.');
  }

  // Check if user already exists in Firestore by email
  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    throw new Error('An account with this email already exists');
  }

  let firebaseUser: FirebaseUser;
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    firebaseUser = userCredential.user;
  } catch (err) {
    throw toFriendlyAuthError(err);
  }

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
    const { FREE_IMAGE_CREDITS, FREE_VIDEO_CREDITS } = await import('./credit-constants');
    const userData: Omit<User, 'id'> = {
      email,
      tier: 'free',
      credits: 0, // Legacy field, kept for backward compatibility
      imageCredits: FREE_IMAGE_CREDITS,
      videoCredits: FREE_VIDEO_CREDITS,
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

  let firebaseUser: FirebaseUser;
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    firebaseUser = userCredential.user;
  } catch (err) {
    throw toFriendlyAuthError(err);
  }

  // Get or create Firestore user
  let user = await getUser(firebaseUser.uid);
  
  if (!user) {
    // Create new user in Firestore if doesn't exist with Firebase UID
    const { FREE_IMAGE_CREDITS, FREE_VIDEO_CREDITS } = await import('./credit-constants');
    const userData: Omit<User, 'id'> = {
      email: firebaseUser.email || email,
      tier: 'free',
      credits: 0, // Legacy field, kept for backward compatibility
      imageCredits: FREE_IMAGE_CREDITS,
      videoCredits: FREE_VIDEO_CREDITS,
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

  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err) {
    throw toFriendlyAuthError(err);
  }
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

  let firebaseUser: FirebaseUser;
  try {
    const userCredential = await signInWithPopup(auth, provider);
    firebaseUser = userCredential.user;
  } catch (err) {
    throw toFriendlyAuthError(err);
  }

  // Get or create Firestore user
  let user = await getUser(firebaseUser.uid);
  
  if (!user) {
    // Create new user in Firestore with Firebase UID
    const { FREE_IMAGE_CREDITS, FREE_VIDEO_CREDITS } = await import('./credit-constants');
    const userData: Omit<User, 'id'> = {
      email: firebaseUser.email || undefined,
      tier: 'free',
      credits: 0, // Legacy field, kept for backward compatibility
      imageCredits: FREE_IMAGE_CREDITS,
      videoCredits: FREE_VIDEO_CREDITS,
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

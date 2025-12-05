import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  deleteDoc,
  Timestamp,
  DocumentData,
  QuerySnapshot,
  Firestore
} from 'firebase/firestore';
import { db } from './firebase';
import { User, GeneratedVideo } from '@/types';

// User collection
const USERS_COLLECTION = 'users';
const VIDEOS_COLLECTION = 'videos';

// Use admin SDK for server-side operations, client SDK for client-side
const getDb = async (): Promise<Firestore> => {
  // Check if we're in a server environment (API routes)
  if (typeof window === 'undefined') {
    const { adminDb } = await import('./firebase-admin');
    return adminDb as any; // Type assertion to handle SDK differences
  }
  return db;
};

// User operations
export async function getUser(userId: string): Promise<User | null> {
  try {
    const database = await getDb();
    const userDoc = await getDoc(doc(database, USERS_COLLECTION, userId));
    if (userDoc.exists()) {
      return { id: userDoc.id, ...userDoc.data() } as User;
    }
    return null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

export async function createUser(userData: Omit<User, 'id'>): Promise<string> {
  try {
    const database = await getDb();
    const userRef = doc(collection(database, USERS_COLLECTION));
    const newUser: User = {
      id: userRef.id,
      ...userData,
    };
    await setDoc(userRef, {
      ...userData,
      createdAt: Timestamp.now(),
    });
    return userRef.id;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

export async function updateUser(userId: string, updates: Partial<User>): Promise<void> {
  try {
    const database = await getDb();
    const userRef = doc(database, USERS_COLLECTION, userId);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

// Video operations
export async function saveVideo(videoData: Omit<GeneratedVideo, 'id'> & { userId: string }): Promise<string> {
  try {
    const database = await getDb();
    const videoRef = await addDoc(collection(database, VIDEOS_COLLECTION), {
      ...videoData,
      createdAt: Timestamp.now(),
    });
    return videoRef.id;
  } catch (error) {
    console.error('Error saving video:', error);
    throw error;
  }
}

export async function getUserVideos(userId: string): Promise<GeneratedVideo[]> {
  try {
    const database = await getDb();
    const q = query(
      collection(database, VIDEOS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        userId: data.userId || userId,
        createdAt: convertTimestamp(data.createdAt),
      } as GeneratedVideo;
    });
  } catch (error) {
    console.error('Error getting user videos:', error);
    return [];
  }
}

export async function getVideo(videoId: string): Promise<GeneratedVideo | null> {
  try {
    const database = await getDb();
    const videoDoc = await getDoc(doc(database, VIDEOS_COLLECTION, videoId));
    if (videoDoc.exists()) {
      return {
        id: videoDoc.id,
        ...videoDoc.data(),
        createdAt: videoDoc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      } as GeneratedVideo;
    }
    return null;
  } catch (error) {
    console.error('Error getting video:', error);
    return null;
  }
}

export async function deleteVideo(videoId: string): Promise<void> {
  try {
    const database = await getDb();
    await deleteDoc(doc(database, VIDEOS_COLLECTION, videoId));
  } catch (error) {
    console.error('Error deleting video:', error);
    throw error;
  }
}

// Helper to convert Firestore timestamp to ISO string
export function convertTimestamp(timestamp: any): string {
  if (timestamp?.toDate) {
    return timestamp.toDate().toISOString();
  }
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  if (typeof timestamp === 'string') {
    return timestamp;
  }
  return new Date().toISOString();
}


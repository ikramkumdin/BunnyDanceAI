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
import { User, GeneratedVideo, GeneratedImage } from '@/types';

// User collection
const USERS_COLLECTION = 'users';
const VIDEOS_COLLECTION = 'videos';
const IMAGES_COLLECTION = 'images';

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

export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const database = await getDb();
    const q = query(
      collection(database, USERS_COLLECTION),
      where('email', '==', email),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const userDoc = querySnapshot.docs[0];
      return { id: userDoc.id, ...userDoc.data() } as User;
    }
    return null;
  } catch (error) {
    console.error('Error getting user by email:', error);
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
    const isClientSide = typeof window !== 'undefined';

    // For client-side calls, always use the simple query to avoid index requirements
    if (isClientSide) {
      console.log('📱 Client-side call, using simple query without ordering');
      const q = query(
        collection(database, VIDEOS_COLLECTION),
        where('userId', '==', userId)
      );
      const querySnapshot = await getDocs(q);

      const videos = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          userId: data.userId || userId,
          createdAt: convertTimestamp(data.createdAt),
          type: (data.type || 'video') as 'video',
        } as GeneratedVideo;
      });

      // Sort in memory (client-side sorting is fine)
      return videos.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return timeB - timeA; // Most recent first
      });
    }

    // For server-side calls, try ordered query with fallback
    try {
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
          type: (data.type || 'video') as 'video',
        } as GeneratedVideo;
      });
    } catch (indexError: any) {
      // If index error, fall back to unordered query and sort in memory
      if (indexError.code === 'failed-precondition') {
        console.warn('📊 Server-side: Firestore index missing, using fallback query');

        const q = query(
          collection(database, VIDEOS_COLLECTION),
          where('userId', '==', userId)
        );
        const querySnapshot = await getDocs(q);

        const videos = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            userId: data.userId || userId,
            createdAt: convertTimestamp(data.createdAt),
            type: (data.type || 'video') as 'video',
          } as GeneratedVideo;
        });

        // Sort in memory
        return videos.sort((a, b) => {
          const timeA = new Date(a.createdAt).getTime();
          const timeB = new Date(b.createdAt).getTime();
          return timeB - timeA; // Most recent first
        });
      }
      throw indexError;
    }
  } catch (error) {
    console.error('❌ Error getting user videos:', error);
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

// Image operations
export async function saveImage(imageData: Omit<GeneratedImage, 'id'> & { userId: string }): Promise<string> {
  try {
    const database = await getDb();
    const imageRef = await addDoc(collection(database, IMAGES_COLLECTION), {
      ...imageData,
      type: 'image',
      createdAt: Timestamp.now(),
    });
    return imageRef.id;
  } catch (error) {
    console.error('Error saving image:', error);
    throw error;
  }
}

export async function getUserImages(userId: string): Promise<GeneratedImage[]> {
  try {
    const database = await getDb();
    const isClientSide = typeof window !== 'undefined';

    if (isClientSide) {
      const q = query(
        collection(database, IMAGES_COLLECTION),
        where('userId', '==', userId)
      );
      const querySnapshot = await getDocs(q);

      const images = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          userId: data.userId || userId,
          createdAt: convertTimestamp(data.createdAt),
          type: 'image' as const,
        } as GeneratedImage;
      });

      return images.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return timeB - timeA; // Most recent first
      });
    }

    try {
      const q = query(
        collection(database, IMAGES_COLLECTION),
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
          type: 'image' as const,
        } as GeneratedImage;
      });
    } catch (indexError: any) {
      if (indexError.code === 'failed-precondition') {
        const q = query(
          collection(database, IMAGES_COLLECTION),
          where('userId', '==', userId)
        );
        const querySnapshot = await getDocs(q);

        const images = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            userId: data.userId || userId,
            createdAt: convertTimestamp(data.createdAt),
            type: 'image' as const,
          } as GeneratedImage;
        });

        return images.sort((a, b) => {
          const timeA = new Date(a.createdAt).getTime();
          const timeB = new Date(b.createdAt).getTime();
          return timeB - timeA;
        });
      }
      throw indexError;
    }
  } catch (error) {
    console.error('❌ Error getting user images:', error);
    return [];
  }
}

export async function deleteImage(imageId: string): Promise<void> {
  try {
    const database = await getDb();
    await deleteDoc(doc(database, IMAGES_COLLECTION, imageId));
  } catch (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
}

/**
 * Re-associate all videos and images owned by `fromUserId` to `toUserId`.
 *
 * Assets are queried by their `userId` field (see getUserVideos/getUserImages),
 * so when a user's identity changes (e.g. an anonymous session becoming an
 * authenticated Firebase user, whose id switches from a random Firestore id to
 * the auth uid) their previously-saved assets are orphaned under the old id.
 * This walks both collections and updates the `userId` field so the assets
 * surface under the new id. Idempotent: re-running with no matching docs is a no-op.
 *
 * @returns the number of asset documents moved.
 */
export async function mergeUserAssets(fromUserId: string, toUserId: string): Promise<number> {
  if (!fromUserId || !toUserId || fromUserId === toUserId) return 0;

  const database = await getDb();
  let moved = 0;

  for (const collectionName of [VIDEOS_COLLECTION, IMAGES_COLLECTION]) {
    const snapshot = await getDocs(
      query(collection(database, collectionName), where('userId', '==', fromUserId))
    );
    for (const assetDoc of snapshot.docs) {
      await updateDoc(doc(database, collectionName, assetDoc.id), { userId: toUserId });
      moved++;
    }
  }

  if (moved > 0) {
    console.log(`🔀 Migrated ${moved} asset(s) from ${fromUserId} → ${toUserId}`);
  }
  return moved;
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


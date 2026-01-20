import { adminDb } from '@/lib/firebase-admin';
import { User } from '@/types';

/**
 * Server-only Firestore helpers using Firebase Admin SDK.
 * Do NOT import firebase/firestore client SDK here.
 */
export async function getUserAdmin(userId: string): Promise<User | null> {
  try {
    const snap = await adminDb.collection('users').doc(userId).get();
    if (!snap.exists) return null;
    const data = snap.data() as any;
    return { id: snap.id, ...(data || {}) } as User;
  } catch (error) {
    console.error('Error getting user (admin):', error);
    return null;
  }
}


import * as admin from 'firebase-admin';
import { parseServiceAccountFromEnv } from './credentials';

// Initialize Firebase Admin
if (!admin.apps.length) {
  let serviceAccount: any = null;
  try {
    serviceAccount = parseServiceAccountFromEnv() || null;
  } catch (e) {
    console.error('Error parsing service account for Firebase Admin:', e);
    serviceAccount = null;
  }

  // Use bunnydanceai project
  const projectId = 'bunnydanceai';

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: projectId,
    });
  } else {
    // Fallback for local development
    admin.initializeApp({
      projectId: projectId,
    });
  }

  console.log('🔥 Firebase Admin initialized for project:', projectId);
}

export const adminDb = admin.firestore();
export const adminStorage = admin.storage();
export const adminAuth = admin.auth();
export default admin;

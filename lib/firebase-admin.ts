import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = process.env.GCP_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY)
    : null;

  // Use the same project ID as client-side Firebase
  const projectId = process.env.GCP_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'bunnydanceai';

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

import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = process.env.GCP_SERVICE_ACCOUNT_KEY
    ? JSON.parse(process.env.GCP_SERVICE_ACCOUNT_KEY)
    : null;

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.GCP_PROJECT_ID || 'voice-app-d19d8',
    });
  } else {
    // Fallback for local development
    admin.initializeApp({
      projectId: 'bunnydanceai',
    });
  }
}

export const adminDb = admin.firestore();
export const adminStorage = admin.storage();
export const adminAuth = admin.auth();
export default admin;

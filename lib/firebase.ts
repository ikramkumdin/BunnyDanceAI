// Import the functions you need from the SDKs you need
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";

// Your web app's Firebase configuration - using bunnydanceai project
// ⚠️ SECURITY: All Firebase config values should come from environment variables
// Note: Firebase API keys are public by design but should still use env vars for flexibility
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "bunnydanceai.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "bunnydanceai",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "bunnydanceai.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "983659160954",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:983659160954:web:035a8df84d2113e99c62c3",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-X5K3BFEMW9",
};

// Warn if API key is not set (but don't fail in development)
if (typeof window !== "undefined" && !firebaseConfig.apiKey) {
  console.warn("⚠️ NEXT_PUBLIC_FIREBASE_API_KEY is not set. Firebase may not work correctly.");
}

// Initialize Firebase
let app: FirebaseApp;
let analytics: Analytics | null = null;
let db: Firestore;
let storage: FirebaseStorage;

if (typeof window !== "undefined") {
  // Only initialize if not already initialized
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    // Analytics only works in browser
    analytics = getAnalytics(app);
  } else {
    app = getApps()[0];
  }

  db = getFirestore(app);
  storage = getStorage(app);
} else {
  // Server-side initialization
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  storage = getStorage(app);
}

// NOTE: We intentionally do NOT initialize/export Firebase Auth.
// This app uses a localStorage/Firestore user model, and initializing Auth can
// trigger identitytoolkit calls and noisy CONFIGURATION_NOT_FOUND errors.
export { app, analytics, db, storage };
export default app;





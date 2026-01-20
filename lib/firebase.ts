// Import the functions you need from the SDKs you need
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getAuth, Auth } from "firebase/auth";

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

// Validate Firebase config
if (typeof window !== "undefined" && (!firebaseConfig.apiKey || !firebaseConfig.authDomain)) {
  console.error("❌ Firebase Auth configuration is incomplete. Please set NEXT_PUBLIC_FIREBASE_API_KEY and NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN environment variables.");
}

// Initialize Firebase
let app: FirebaseApp;
let analytics: Analytics | null = null;
let db: Firestore;
let storage: FirebaseStorage;
let auth: Auth | null = null;

if (typeof window !== "undefined") {
  // Only initialize if not already initialized
  if (getApps().length === 0) {
    try {
      app = initializeApp(firebaseConfig);
      // Analytics only works in browser
      analytics = getAnalytics(app);
    } catch (error) {
      console.error("❌ Firebase initialization error:", error);
      throw error;
    }
  } else {
    app = getApps()[0];
  }

  db = getFirestore(app);
  storage = getStorage(app);
  
  // Only initialize Auth if we have valid config
  try {
    if (firebaseConfig.apiKey && firebaseConfig.authDomain) {
      auth = getAuth(app);
    } else {
      console.warn("⚠️ Firebase Auth not initialized: Missing API key or auth domain. Please configure Firebase Auth in Firebase Console.");
    }
  } catch (error) {
    console.error("❌ Firebase Auth initialization error:", error);
    console.warn("⚠️ Firebase Auth will not be available. Please enable Authentication in Firebase Console.");
    auth = null;
  }
} else {
  // Server-side initialization
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  storage = getStorage(app);
  // Auth is client-side only
}

export { app, analytics, db, storage, auth };
export default app;





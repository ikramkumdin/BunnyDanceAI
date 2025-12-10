// Import the functions you need from the SDKs you need
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getAuth, Auth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCQ_9asSsYO1fksIvVLJ3llr-JdrIPwXNM",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "bunnydanceai.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "bunnydanceai",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "bunnydanceai.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "983659160954",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:983659160954:web:035a8df84d2113e99c62c3",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-X5K3BFEMW9"
};

// Initialize Firebase
let app: FirebaseApp;
let analytics: Analytics | null = null;
let db: Firestore;
let storage: FirebaseStorage;
let auth: Auth;

if (typeof window !== 'undefined') {
  // Only initialize if not already initialized
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    // Analytics only works in browser
    if (typeof window !== 'undefined') {
      analytics = getAnalytics(app);
    }
  } else {
    app = getApps()[0];
  }
  
  db = getFirestore(app);
  storage = getStorage(app);
  auth = getAuth(app);
} else {
  // Server-side initialization
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  storage = getStorage(app);
  auth = getAuth(app);
}

export { app, analytics, db, storage, auth };
export default app;




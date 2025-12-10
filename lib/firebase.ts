// Import the functions you need from the SDKs you need
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getAuth, Auth } from "firebase/auth";

// Your web app's Firebase configuration - using bunnydanceai project
const firebaseConfig = {
  apiKey: "AIzaSyCQ_9asSsYO1fksIvVLJ3llr-JdrIPwXNM",
  authDomain: "bunnydanceai.firebaseapp.com",
  projectId: "bunnydanceai",
  storageBucket: "bunnydanceai.firebasestorage.app",
  messagingSenderId: "983659160954",
  appId: "1:983659160954:web:035a8df84d2113e99c62c3",
  measurementId: "G-X5K3BFEMW9"
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




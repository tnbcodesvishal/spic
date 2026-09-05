import { initializeApp, getApps, getApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import { initializeFirestore, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyATme5QeszOAyS456s6AINGDvZIfspEuY0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "aura-8cfbc.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "aura-8cfbc",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "aura-8cfbc.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "33775658852",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:33775658852:web:52fc59ddd366b2dccc3c71",
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const storage = getStorage(app);

let firestoreDb: ReturnType<typeof getFirestore>;
try {
  firestoreDb = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
  });
} catch {
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;
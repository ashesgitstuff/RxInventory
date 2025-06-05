
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  enableMultiTabIndexedDbPersistence,
  CACHE_SIZE_UNLIMITED
  // updateSettings is removed as it was causing an import error
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
let app;
let db: Firestore; // Explicitly type db

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  // Initialize Firestore with cache settings here, on the first initialization of the app
  db = getFirestore(app, { cacheSizeBytes: CACHE_SIZE_UNLIMITED });
} else {
  app = getApp();
  // If app already exists, get Firestore instance.
  // We assume that if the app was initialized, Firestore would have been initialized with settings
  // by the block above if this module is the primary entry point for Firebase setup.
  db = getFirestore(app);
}

// Enable Firestore offline persistence for multi-tab synchronization.
// This should be called after db is initialized.
enableMultiTabIndexedDbPersistence(db)
  .then(() => {
    // Firestore multi-tab offline persistence enabled.
  })
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      // Firestore offline persistence failed (failed-precondition). Likely multiple tabs open.
    } else if (err.code == 'unimplemented') {
      // Firestore offline persistence failed (unimplemented). Browser may not support it.
    } else {
      // Firestore offline persistence failed.
    }
  });

export { db, app };

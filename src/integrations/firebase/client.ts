import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

/**
 * Validate required Firebase config
 */
function validateFirebaseConfig(): boolean {
  const required = [
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_STORAGE_BUCKET",
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_FIREBASE_APP_ID",
  ];

  const missing = required.filter((key) => !import.meta.env[key]);

  if (missing.length > 0) {
    console.warn(
      `[Firebase] Missing required config: ${missing.join(", ")}. ` +
      "Firebase will not work. Add VITE_FIREBASE_* vars to .env.local"
    );
    return false;
  }
  return true;
}

// Initialize Firebase
let firebaseApp: ReturnType<typeof initializeApp> | null = null;
export let firebaseAuth: ReturnType<typeof getAuth> | null = null;
export let firebaseDb: ReturnType<typeof getFirestore> | null = null;
export let firebaseStorage: ReturnType<typeof getStorage> | null = null;
export let firebaseFunctions: ReturnType<typeof getFunctions> | null = null;

if (validateFirebaseConfig()) {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    const auth = getAuth(app);
    const db = getFirestore(app);
    const storage = getStorage(app);
    const functions = getFunctions(app);

    firebaseApp = app;
    firebaseAuth = auth;
    firebaseDb = db;
    firebaseStorage = storage;
    firebaseFunctions = functions;

    // Connect to emulators in development
    if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true") {
      connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
      connectFirestoreEmulator(firebaseDb, "localhost", 8080);
      connectFunctionsEmulator(firebaseDb, "localhost", 5001);
    }
  } catch (err) {
    console.error("[Firebase] Failed to initialize:", err);
  }
}

/**
 * Get the Firebase Auth instance (throws if not initialized)
 */
export function getFirebaseAuth() {
  if (!firebaseAuth) {
    throw new Error(
      "Firebase Auth not initialized. Check VITE_FIREBASE_* environment variables."
    );
  }
  return firebaseAuth;
}

/**
 * Get the Firestore instance
 */
export function getFirestoreDb() {
  if (!firebaseDb) {
    throw new Error(
      "Firestore not initialized. Check VITE_FIREBASE_* environment variables."
    );
  }
  return firebaseDb;
}

/**
 * Get the Firebase Functions instance
 */
export function getFirebaseFunctions() {
  if (!firebaseFunctions) {
    throw new Error(
      "Firebase Functions not initialized. Check VITE_FIREBASE_* environment variables."
    );
  }
  return firebaseFunctions;
}

/**
 * Check if Firebase is initialized
 */
export function isFirebaseInitialized(): boolean {
  return !!firebaseAuth && !!firebaseDb;
}

export { firebaseApp, firebaseAuth, firebaseDb, firebaseStorage, firebaseFunctions };
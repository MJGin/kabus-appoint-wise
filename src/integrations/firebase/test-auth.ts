/**
 * Simple Firebase Auth + Firestore Test
 * 
 * Run in browser console or as a test page
 * 
 * This tests:
 * 1. Firebase Auth sign up
 * 2. Firebase Auth sign in
 * 3. Profile creation in Firestore via Cloud Function trigger
 * 4. Profile retrieval from Firestore
 * 
 * Usage: Import and call runAuthTest() in browser console
 */

import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  User
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  onSnapshot 
} from "firebase/firestore";

// Firebase config from .env.local
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

const TEST_EMAIL = "test@kabarak.ac.ke";
const TEST_PASSWORD = "TestPass123!";
const TEST_FULL_NAME = "Test User";

export interface TestResult {
  step: string;
  success: boolean;
  message: string;
  data?: any;
}

export async function runAuthTest(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  
  const addResult = (step: string, success: boolean, message: string, data?: any) => {
    results.push({ step, success, message, data });
    console.log(`${success ? "✅" : "❌"} ${step}: ${message}`);
    if (data) console.log("  Data:", data);
  };

  try {
    // Step 1: Check Firebase initialization
    if (!auth.app.options.projectId) {
      addResult("Firebase Init", false, "Firebase not properly initialized");
      return results;
    }
    addResult("Firebase Init", true, `Project: ${auth.app.options.projectId}`);

    // Step 2: Sign up new user
    console.log("\n📝 Step 1: Creating test user...");
    let userCredential;
    try {
      const userCred = await createUserWithEmailAndPassword(auth, "test@kabarak.ac.ke", "TestPass123!");
      await updateProfile(firebaseAuth.currentUser!, { displayName: "Test User" });
      addResult("Sign Up", true, `User created: ${userCredential.user.uid}`, { uid: userCredential.user.uid });
    } catch (e: any) {
      if (e.code === "auth/email-already-in-use") {
        // Try to sign in instead
        try {
          await signInWithEmailAndPassword(auth, "test@kabarak.ac.ke", "TestPass123!");
          addResult("Sign Up", true, "User already exists, signed in instead");
        } catch (e2: any) {
          addResult("Sign Up", false, `Sign up failed: ${e2.message}`);
          return results;
        }
      } else {
        addResult("Sign Up", false, `Sign up failed: ${e.message}`);
        return results;
      }
    }

    // Step 2: Wait for profile creation (triggered by Cloud Function)
    console.log("⏳ Waiting for profile creation in Firestore...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 3: Verify profile in Firestore
    const user = auth.currentUser;
    if (user) {
      const userDoc = await getDoc(doc(getFirestore(), "users", user.uid));
      if (userDoc.exists()) {
        const profile = userDoc.data();
        addResult("Firestore Profile", true, "Profile created in Firestore", {
          uid: user.uid,
          email: profile.email,
          fullName: profile.fullName,
          role: profile.role,
          firebaseUid: profile.firebaseUid,
          isDemo: profile.isDemo,
        });
      } else {
        addResult("Firestore Profile", false, "Profile NOT found in Firestore - Cloud Function trigger may not have fired");
      }
    }

    // Step 4: Test sign out
    await signOut(auth);
    addResult("Sign Out", true, "Signed out successfully");

    // Step 4: Test sign in again
    await signInWithEmailAndPassword(auth, "test@kabarak.ac.ke", "TestPass123!");
    addResult("Sign In", true, "Signed in successfully after sign out");

    // Verify profile still accessible
    const user = auth.currentUser;
    if (user) {
      const userDoc = await getDoc(doc(getFirestore(), "users", user.uid));
      if (userDoc.exists()) {
        addResult("Profile After Re-login", true, "Profile accessible after re-login");
      } else {
        addResult("Profile After Re-login", false, "Profile not accessible after re-login");
      }
    }

    // Clean up - sign out
    await signOut(auth);
    addResult("Final Sign Out", true, "Test completed, signed out");

  } catch (error: any) {
    addResult("Error", false, `Test failed: ${error.message}`, { code: error.code });
  }

  return results;
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).runAuthTest = runAuthTest;
  console.log("🧪 Auth test ready! Run runAuthTest() in console");
}

export default runAuthTest;
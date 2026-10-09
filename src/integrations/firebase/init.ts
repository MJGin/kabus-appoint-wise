/**
 * Firebase Integration for KABU SlotIn
 * 
 * Firebase Authentication as the identity provider,
 * with mapping to Supabase for authorization (RLS policies,
 * appointment rules, throttling).
 * 
 * Setup:
 * 1. Add VITE_FIREBASE_* env vars in .env.local
 * 2. Initialize in main.tsx or root layout
 * 3. Use firebaseSignIn/ firebaseSignUp for auth
 * 4. Supabase auth context remains active for RLS policies
 */

import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User,
  NextOrObserver,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { supabase } from "./supabase/client";

/**
 * Firebase configuration from environment variables
 * Create .env.local with:
 * VITE_FIREBASE_API_KEY=your-api-key
 * VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
 * VITE_FIREBASE_PROJECT_ID=your-project-id
 * VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
 * VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
 * VITE_FIREBASE_APP_ID=your-app-id
 */
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
  
  const missing = required.filter(key => !import.meta.env[key]);
  
  if (missing.length > 0) {
    console.warn(
      `[Firebase] Missing required config: ${missing.join(", ")}. ` +
      "Firebase Auth will not work. Add VITE_FIREBASE_* vars to .env.local"
    );
    return false;
  }
  return true;
}

// Initialize Firebase only if config is valid
let firebaseApp: ReturnType<typeof initializeApp> | null = null;
export let firebaseAuth: ReturnType<typeof getAuth> | null = null;

if (validateFirebaseConfig()) {
  try {
    const app = initializeApp(firebaseConfig);
    firebaseAuth = getAuth(app);
  } catch (err) {
    console.error("[Firebase] Failed to initialize:", err);
  }
}

/**
 * Get the Firebase Auth instance (throws if not initialized)
 */
function getFirebaseAuth() {
  if (!firebaseAuth) {
    throw new Error(
      "Firebase Auth not initialized. Check VITE_FIREBASE_* environment variables."
    );
  }
  return firebaseAuth;
}

/**
 * Sign in with Firebase Email/Password
 * Then create/link user in Supabase
 */
export async function firebaseSignIn(
  email: string,
  password: string
): Promise<{
  success: boolean;
  user?: { firebaseUid: string; supabaseUserId: string; email: string };
  error?: string;
}> {
  try {
    const auth = getFirebaseAuth();

    // 1. Sign in with Firebase Auth
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUid = user.uid;
    const normalizedEmail = email.trim().toLowerCase();

    // 2. Check if user exists in Supabase profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, firebase_uid")
      .eq("email", normalizedEmail)
      .single();

    if (profileError && profileError.code !== "PGRST116") {
      // PGRST116 = no rows returned (not found)
      console.error("[Firebase] Profile lookup error:", profileError);
    }

    if (profile) {
      // User exists in Supabase - update Firebase UID if needed
      if (profile.firebase_uid !== user.uid) {
        await supabase
          .from("profiles")
          .update({ firebase_uid: user.uid })
          .eq("id", profile.id);
      }
      return {
        success: true,
        user: {
          firebaseUid: user.uid,
          supabaseUserId: profile.id,
          email: profile.email,
        },
      };
    }

    // 3. User not in Supabase - sign in with Supabase using same credentials
    const { data: supabaseAuth, error: supabaseAuthError } =
      await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

    if (supabaseAuthError) {
      // If Supabase sign-in fails, user might not exist - create account
      return await createSupabaseUserFromFirebase(user, normalizedEmail, password);
    }

    // 4. Link Firebase UID to existing Supabase user
    if (supabaseAuth.user) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ firebase_uid: user.uid })
        .eq("id", supabaseAuth.user.id);

      if (updateError) {
        console.warn("[Firebase] Failed to link Firebase UID:", updateError);
      }
    }

    return {
      success: true,
      user: {
        firebaseUid: user.uid,
        supabaseUserId: supabaseAuth.user?.id,
        email: normalizedEmail,
      },
    };
  } catch (err: any) {
    console.error("[Firebase] Sign-in error:", err);
    return {
      success: false,
      error: err.message || "Sign-in failed",
    };
  }
}

/**
 * Helper: Create Supabase user from Firebase user when no Supabase account exists
 */
async function createSupabaseUserFromFirebase(
  user: { uid: string; email?: string | null; displayName?: string | null },
  email: string,
  password: string
) {
  const normalizedEmail = email.trim().toLowerCase();

  const { data: supabaseAuth, error: supabaseAuthError } =
    await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          firebase_uid: user.uid,
        },
      },
    });

  if (supabaseAuthError) {
    return { success: false, error: supabaseAuthError.message };
  }

  // Profile will be created by handle_new_user trigger
  // Wait briefly for trigger to complete
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Verify profile was created and link Firebase UID
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, firebase_uid")
    .eq("email", email.trim().toLowerCase())
    .single();

  if (profile && profile.firebase_uid !== user.uid) {
    await supabase
      .from("profiles")
      .update({ firebase_uid: user.uid })
      .eq("id", profile.id);
  }

  return {
    success: true,
    user: {
      firebaseUid: user.uid,
      supabaseUserId: profile?.id,
      email: normalizedEmail,
    },
  };
}

/**
 * Sign up with Firebase Email/Password
 * Creates user in both Firebase and Supabase
 */
export async function firebaseSignUp(
  fullName: string,
  email: string,
  password: string,
  role: "student" | "lecturer" | "dean" | "it_support" = "student"
) {
  try {
    const auth = getFirebaseAuth();

    // 1. Create user in Firebase Auth
    const { user } = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const firebaseUid = user.uid;
    const normalizedEmail = email.trim().toLowerCase();

    // 2. Create user in Supabase with role mapping
    const roleMap: Record<string, "student" | "lecturer" | "dean" | "it_support"> = {
      student: "student",
      lecturer: "lecturer",
      dean: "dean",
      it_support: "it_support",
    };

    const role = roleMap[role];

    // Create Supabase auth user
    const { data: supabaseAuth, error: supabaseAuthError } =
      await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName,
            firebase_uid: firebaseUid,
            requested_role: role,
          },
        },
      });

    if (supabaseAuthError) {
      // Clean up Firebase user if Supabase creation failed
      try {
        await supabase.auth.admin.deleteUser(firebaseUid);
      } catch (cleanupErr) {
        console.warn("[Firebase] Failed to cleanup Firebase user:", cleanupErr);
      }
      return { success: false, error: supabaseAuthError.message };
    }

    // Profile will be created by handle_new_user trigger
    // Wait briefly for trigger to complete
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Update profile with additional info
    if (supabaseAuth.user) {
      await supabase.from("profiles").upsert({
        id: supabaseAuth.user.id,
        full_name: fullName,
        email: email.trim().toLowerCase(),
        firebase_uid: firebaseUid,
        requested_role: role,
      }, { onConflict: "id" });
    }

    return {
      success: true,
      user: {
        firebaseUid,
        supabaseUserId: supabaseAuth.user?.id,
        email: normalizedEmail,
      },
    };
  } catch (err: any) {
    console.error("[Firebase] Sign-up error:", err);
    return {
      success: false,
      error: err.message || "Sign-up failed",
    };
  }
}

/**
 * Password reset via Firebase
 */
export async function firebaseResetPassword(email: string) {
  try {
    const auth = getFirebaseAuth();
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Observe Firebase Auth state changes
 * Maps to Supabase context for React components
 */
export function useFirebaseAuth(
  onChange: (user: User | null) => void
): () => void {
  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, onChange);
}

/**
 * Get current Firebase user UID
 */
export function getFirebaseUid(): string | null {
  const auth = firebaseAuth;
  if (!auth) return null;
  const user = auth.currentUser;
  return user ? user.uid : null;
}

/**
 * Check if current user is a demo account (mapped via Firebase UID)
 */
export async function isDemoAccount(): Promise<boolean> {
  const firebaseUid = getFirebaseUid();
  if (!firebaseUid) return false;

  const demoEmails = [
    "demo@kabarak.ac.ke",
    "student@kabarak.ac.ke",
    "lecturer@kabarak.ac.ke",
    "dean@kabarak.ac.ke",
    "it-support@kabarak.ac.ke",
  ];

  // Check email from Supabase profiles
  const { data } = await supabase
    .from("profiles")
    .select("email")
    .eq("firebase_uid", firebaseUid)
    .single();

  if (!data) return false;

  return demoEmails.includes(data.email);
}

/**
 * Sign out from both Firebase and Supabase
 */
export async function firebaseSignOut() {
  try {
    const auth = getFirebaseAuth();
    await auth.signOut();
    await supabase.auth.signOut();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export type { User } from "firebase/auth";
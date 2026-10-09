import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

const db = admin.firestore();
const auth = admin.auth();

/**
 * User roles enum matching the original system
 */
export type AppRole = "student" | "lecturer" | "dean" | "administrator" | "it_support";

/**
 * User profile interface for Firestore
 */
export interface UserProfile {
  uid: string;
  email: string;
  fullName: string;
  displayName?: string;
  regNumber?: string; // For students: LAW/M/XXXX/XX/XX
  role: "student" | "lecturer" | "dean" | "administrator" | "it_support";
  title?: string;
  department?: string;
  bio?: string;
  photoUrl?: string;
  officeLocation?: string;
  firebaseUid: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  isDemo?: boolean;
}

/**
 * Check if user has a specific role
 */
export async function hasRole(uid: string, role: string): Promise<boolean> {
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) return false;
  const data = userDoc.data();
  return data?.role === role;
}

/**
 * Check if current user has any of the specified roles
 */
export async function currentRoleIs(roles: string[]): Promise<boolean> {
  const uid = getCurrentUid();
  if (!uid) return false;
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) return false;
  const data = userDoc.data();
  return roles.includes(data?.role);
}

/**
 * Get current user UID from context
 */
function getCurrentUid(): string | null {
  // In callable functions, context.auth.uid is available
  return null; // Will be passed from callable context
}

/**
 * Demo account white-list (bypasses all restrictions)
 */
const DEMO_EMAILS = new Set([
  "demo@kabarak.ac.ke",
  "student@kabarak.ac.ke",
  "lecturer@kabarak.ac.ke",
  "dean@kabarak.ac.ke",
  "it-support@kabarak.ac.ke",
]);

const DEMO_REG_NUMBERS = new Set([
  "LAW/M/0001/2024/25",
  "LAW/M/0002/2024/25",
]);

function isDemoAccount(email: string, regNumber?: string): boolean {
  return DEMO_EMAILS.has(email.toLowerCase()) || (regNumber && DEMO_REG_NUMBERS.has(regNumber.toUpperCase()));
}

/**
 * Callable: Create user profile after Firebase Auth sign-up
 * This replaces the Supabase handle_new_user trigger
 */
export const onUserCreated = functions.auth.user().onCreate(async (user) => {
  const email = user.email?.toLowerCase() || "";
  const firebaseUid = user.uid;
  const displayName = user.displayName || email.split("@")[0];
  const isDemo = DEMO_EMAILS.has(email);

  let role: AppRole = "student";
  const customClaims = user.customClaims || {};
  const requestedRole = (customClaims.role as string) || "student";

  if (requestedRole === "administrator") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Administrator accounts cannot be created through sign-up."
    );
  }

  // Determine role
  if (isDemo) {
    // Demo accounts: assign student role by default unless staff email
    if (email.endsWith("@kabarak.ac.ke") && 
        !email.includes("-support@") && 
        !email.includes("dean@")) {
      role = "student";
    } else {
      role = "lecturer";
    }
  } else if (requestedRole === "student") {
    role = "student";
  } else if (["lecturer", "dean", "it_support"].includes(requestedRole)) {
    role = requestedRole as AppRole;
  } else {
    role = "student";
  }

  // Create user profile in Firestore
  const profile = {
    uid: user.uid,
    email: user.email?.toLowerCase() || "",
    fullName: displayName,
    displayName,
    role,
    firebaseUid: user.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    isDemo,
  };

  await db.collection("users").doc(user.uid).set(profile);
  logger.info(`Created user profile for ${user.email} with role ${role}`);
});

/**
 * Callable: Get user profile
 */
export const getProfile = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }
  const uid = context.auth.uid;
  const doc = await db.collection("users").doc(uid).get();
  if (!doc.exists) {
    throw new functions.https.HttpsError("not-found", "Profile not found");
  }
  return doc.data();
});

/**
 * Callable: Update user profile
 */
export const updateProfile = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }
  const uid = context.auth.uid;
  const allowedFields = ["fullName", "title", "department", "bio", "photoUrl", "officeLocation"];
  const updateData: Record<string, unknown> = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
  
  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updateData[field] = data[field];
    }
  }

  await db.collection("users").doc(context.auth.uid).update(updateData);
  return { success: true };
});

/**
 * Callable: Check if user is demo account
 */
export const checkDemoAccount = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }
  const doc = await db.collection("users").doc(context.auth.uid).get();
  if (!doc.exists) return { isDemo: false };
  return { isDemo: doc.data()?.isDemo === true };
});

/**
 * Migration helper: Link existing Firebase user to profile
 */
export const linkFirebaseUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }
  
  const { email } = data;
  if (!email) {
    throw new functions.https.HttpsError("invalid-argument", "Email required");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const uid = context.auth.uid;

  // Find existing profile by email
  const query = await db.collection("users")
    .where("email", "==", email.toLowerCase())
    .limit(1)
    .get();

  if (query.empty) {
    return { success: false, error: "No existing profile found for this email" };
  }

  const doc = query.docs[0];
  const profile = doc.data();
  
  if (profile.firebaseUid && profile.firebaseUid !== context.auth.uid) {
    return { success: false, error: "Email already linked to another Firebase account" };
  }

  // Update with Firebase UID
  await doc.ref.update({
    firebaseUid: context.auth.uid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, profileId: doc.id };
});

/**
 * Check if user has demo access
 */
export function isDemoUser(email: string): boolean {
  return DEMO_EMAILS.has(email.toLowerCase());
}

/**
 * Get user role from profile
 */
export async function getUserRole(uid: string): Promise<string | null> {
  const doc = await db.collection("users").doc(uid).get();
  if (!doc.exists) return null;
  return doc.data()?.role || null;
}
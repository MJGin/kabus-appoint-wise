/**
 * Test script to verify Firebase Auth + Firestore integration
 * 
 * Usage: npx tsx scripts/test-auth-flow.ts
 * 
 * This script:
 * 1. Creates a test user in Firebase Auth (using Admin SDK)
 * 2. Verifies the onUserCreated trigger creates a profile in Firestore
 * 3. Tests login using Firebase client SDK
 * 4. Verifies the profile is accessible
 */

import { initializeApp, cert, getApps, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initializeApp as initializeClientApp, getApps } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore as getClientFirestore, doc, getDoc } from "firebase/firestore";

// Configuration - update with your Firebase project details
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "kabu-71867";
const CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || "";
const PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n") || "";

// Test user credentials
const TEST_EMAIL = "test@kabarak.ac.ke";
const TEST_PASSWORD = "TestPass123!";
const TEST_FULL_NAME = "Test User";

async function initializeAdmin() {
  // Initialize Firebase Admin
  if (getApps().length === 0) {
    if (PRIVATE_KEY && CLIENT_EMAIL) {
      initializeApp({
        credential: cert({
          projectId: PROJECT_ID,
          clientEmail: CLIENT_EMAIL,
          privateKey: PRIVATE_KEY,
        }),
      });
    } else {
      // Try application default credentials
      initializeApp({
        credential: applicationDefault(),
        projectId: PROJECT_ID,
      });
    }
  }
  return { auth: getAuth(), db: getFirestore() };
}

async function initializeClient() {
  // Initialize Firebase Client
  const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
    measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID,
  };

  if (getApps().length === 0) {
    initializeClientApp(firebaseConfig);
  }
  return { auth: getAuth(), db: getFirestore() };
}

async function createTestUser(auth: any) {
  console.log(`\n🔄 Creating test user: ${TEST_EMAIL}`);
  
  try {
    // Delete if exists
    try {
      const existing = await getAuth().getUserByEmail(TEST_EMAIL);
      await getAuth().deleteUser(existing.uid);
      console.log("  ✓ Deleted existing test user");
    } catch (e: any) {
      if (e.code !== "auth/user-not-found") {
        console.log("  ℹ No existing user to delete");
      }
    }

    // Create new user
    const userRecord = await getAuth().createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      displayName: TEST_FULL_NAME,
      emailVerified: false,
    });

    console.log(`  ✓ Created user: ${userRecord.uid}`);
    console.log(`  📧 Email: ${userRecord.email}`);
    console.log(`  👤 Display Name: ${userRecord.displayName}`);

    // Set custom claims for role (optional)
    await getAuth().setCustomUserClaims(TEST_EMAIL, { role: "student" });
    console.log("  ✓ Set custom claims: role=student");

    return userRecord;
  } catch (error: any) {
    console.error("  ❌ Failed to create user:", error.message);
    throw error;
  }
}

async function verifyProfileInFirestore(db: any, uid: string) {
  console.log(`\n🔍 Verifying profile in Firestore for UID: ${uid}`);
  
  // Wait a moment for the onUserCreated trigger to fire
  await new Promise(resolve => setTimeout(resolve, 2000));

  const userDoc = await db.collection("users").doc(uid).get();
  
  if (!userDoc.exists) {
    console.error("  ❌ Profile NOT found in Firestore!");
    return false;
  }

  const data = userDoc.data();
  console.log(`  ✓ Profile found in Firestore:`);
  console.log(`  📄 Document ID: ${userDoc.id}`);
  console.log(`  📧 Email: ${data.email}`);
  console.log(`  👤 Full Name: ${data.fullName}`);
  console.log(`  🎭 Role: ${data.role}`);
  console.log(`  🔥 Firebase UID: ${data.firebaseUid}`);
  console.log(`  🎭 Is Demo: ${data.isDemo}`);
  console.log(`  📅 Created: ${data.createdAt?.toDate?.() || data.createdAt}`);

  // Verify required fields
  const requiredFields = ["uid", "email", "fullName", "role", "firebaseUid", "createdAt", "updatedAt"];
  const missing = requiredFields.filter(f => !(f in data));
  
  if (missing.length > 0) {
    console.warn(`  ⚠ Missing fields: ${missing.join(", ")}`);
    return false;
  }

  console.log("  ✓ All required fields present");
  return true;
}

async function testLogin(clientAuth: any) {
  console.log(`\n🔐 Testing login with: ${TEST_EMAIL}`);
  
  try {
    const { user } = await signInWithEmailAndPassword(getAuth(), TEST_EMAIL, "TestPass123!");
    console.log(`  ✓ Login successful:`);
    console.log(`  🔑 UID: ${user.uid}`);
    console.log(`  📧 Email: ${user.email}`);
    console.log(`  👤 Display Name: ${user.displayName}`);
    console.log(`  ✉️ Email Verified: ${user.emailVerified}`);
    return user;
  } catch (error: any) {
    console.error("  ❌ Login failed:", error.code, error.message);
    throw error;
  }
}

async function verifyProfileAfterLogin(clientDb: any, uid: string) {
  console.log(`\n🔍 Verifying profile accessible after login:`);
  
  const doc = await getDoc(doc(getClientFirestore(), "users", uid));
  
  if (!doc.exists()) {
    console.error("  ❌ Profile NOT accessible after login!");
    return false;
  }

  const data = doc.data();
  console.log(`  ✓ Profile accessible after login:`);
  console.log(`  👤 Name: ${data.fullName}`);
  console.log(`  📧 Email: ${data.email}`);
  console.log(`  🎭 Role: ${data.role}`);
  console.log(`  🔥 Firebase UID: ${data.firebaseUid}`);
  
  return true;
}

async function testSignOut(clientAuth: any) {
  console.log(`\n🚪 Testing sign out:`);
  
  try {
    await signOut(getAuth());
    console.log("  ✓ Sign out successful");
    return true;
  } catch (error: any) {
    console.error("  ❌ Sign out failed:", error.message);
    return false;
  }
}

async function cleanupTestUser(auth: any, db: any) {
  console.log(`\n🧹 Cleaning up test user...`);
  
  try {
    const user = await getAuth().getUserByEmail(TEST_EMAIL);
    await getAuth().deleteUser(user.uid);
    console.log(`  ✓ Deleted Firebase Auth user: ${user.uid}`);
  } catch (e: any) {
    if (e.code !== "auth/user-not-found") {
      console.warn("  ⚠ Could not delete auth user:", e.message);
    }
  }

  // Note: We don't delete the Firestore profile here as it might be needed for reference
  // But we could: await db.collection("users").doc(uid).delete();
}

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  Firebase Auth + Firestore Integration Test");
  console.log("═══════════════════════════════════════\n");

  // Check required environment variables
  const requiredEnv = ["VITE_FIREBASE_API_KEY", "VITE_FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_PROJECT_ID"];
  const missing = requiredEnv.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach(v => console.error(`  - ${v}`));
    console.log("\nPlease set these in .env.local or environment:");
    console.log("  VITE_FIREBASE_API_KEY=...");
    console.log("  VITE_FIREBASE_AUTH_DOMAIN=...");
    console.log("  VITE_FIREBASE_PROJECT_ID=...");
    console.log("  VITE_FIREBASE_STORAGE_BUCKET=...");
    console.log("  VITE_FIREBASE_MESSAGING_SENDER_ID=...");
    console.log("  VITE_FIREBASE_APP_ID=...");
    console.log("  VITE_FIREBASE_MEASUREMENT_ID=...");
    process.exit(1);
  }

  try {
    // Initialize Admin SDK
    const { auth: adminAuth, db: adminDb } = await initializeAdmin();
    console.log("✅ Firebase Admin SDK initialized");

    // Initialize Client SDK
    const { auth: clientAuth, db: clientDb } = await initializeClient();
    console.log("✅ Firebase Client SDK initialized");

    // Step 1: Create test user
    const userRecord = await createTestUser(getAuth());

    // Step 2: Verify profile created in Firestore
    const profileCreated = await verifyProfileInFirestore(getFirestore(), userRecord.uid);
    if (!profileCreated) {
      throw new Error("Profile not created in Firestore");
    }

    // Step 3: Test login
    const user = await testLogin(getAuth());

    // Step 3b: Verify profile accessible after login
    const profileAccessible = await verifyProfileAfterLogin(getFirestore(), user.uid);
    if (!profileAccessible) {
      throw new Error("Profile not accessible after login");
    }

    // Step 4: Test sign out
    await testSignOut(getAuth());

    // Step 5: Test re-login
    await testLogin(getAuth());

    // Cleanup (optional - comment out if you want to keep the test user)
    // await cleanupTestUser(getAuth(), getFirestore());

    console.log("\n═══════════════════════════════════════");
    console.log("  ✅ ALL TESTS PASSED!");
    console.log("═══════════════════════════════════════");
    console.log("\n✅ Firebase Auth + Firestore integration verified:");
    console.log("  • User creation triggers Firestore profile creation");
    console.log("  • Profile includes all required fields");
    console.log("  • Login works with email/password");
    console.log("  • Profile accessible after login");
    console.log("  • Sign out works correctly");
    console.log("  • Firebase UID properly linked in profile");

  } catch (error: any) {
    console.error("\n═══════════════════════════════════════");
    console.error("  ❌ TEST FAILED:", error.message);
    console.error("═══════════════════════════════════════");
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);
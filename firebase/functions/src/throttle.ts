import * as admin from "firebase-admin";
import * as crypto from "crypto";

const db = admin.firestore();

/**
 * Hash identifier for privacy (same as Supabase)
 */
export function hashIdentifier(identifier: string): string {
  return crypto.createHash("sha256").update(identifier.trim().toLowerCase()).digest("hex");
}

/**
 * Get client IP from request
 */
export function getClientIp(req: any): string {
  return req.ip || req.headers["x-forwarded-for"]?.split(",")[0] || req.headers["x-real-ip"] || "unknown";
}

/**
 * Check if sign-in is allowed (not throttled)
 */
export async function checkSignInAllowed(identifier: string, req: any): Promise<{ allowed: boolean }> {
  const hashedId = hashIdentifier(identifier);
  const hashedIp = hashIdentifier(getClientIp(req));

  const [account, network] = await Promise.all([
    checkAuthThrottleInternal("signin:account", hashedId),
    checkAuthThrottleInternal("signin:ip", hashedIp),
  ]);

  return { allowed: account && network };
}

/**
 * Record sign-in attempt result
 */
export async function recordSignInResult(identifier: string, succeeded: boolean, req: any): Promise<void> {
  const hashedId = hashIdentifier(identifier);
  const hashedIp = hashIdentifier(getClientIp(req));

  await Promise.all([
    recordAuthAttemptInternal("signin:account", hashedId, succeeded),
    recordAuthAttemptInternal("signin:ip", hashedIp, succeeded),
  ]);
}

/**
 * Check action throttle (booking, reschedule)
 */
export async function checkActionThrottle(
  action: "booking" | "reschedule",
  userId: string,
  req: any
): Promise<{ allowed: boolean }> {
  const hashedId = hashIdentifier(userId);
  const hashedIp = hashIdentifier(getClientIp(req));

  const isFirebase = await isFirebaseUser(userId);
  const maxAttempts = isFirebase ? 20 : 5;

  const [account, network] = await Promise.all([
    checkAuthThrottleInternal(`${action}:account`, userId, isFirebase ? 20 : 5, 15),
    checkAuthThrottleInternal(`${action}:ip`, hashIdentifier(getClientIp(req)), isFirebase ? 60 : 15, 15),
  ]);

  return { allowed: account && network };
}

/**
 * Record action throttle attempt
 */
export async function recordActionThrottle(
  action: "booking" | "reschedule",
  userId: string,
  succeeded: boolean,
  req: any
): Promise<void> {
  const isFirebase = await isFirebaseUser(userId);

  await Promise.all([
    recordAuthAttemptInternal(`${action}:account`, userId, succeeded, isFirebase ? 20 : 5, 15),
    recordAuthAttemptInternal(`${action}:ip`, hashIdentifier(getClientIp(req)), succeeded, isFirebase ? 60 : 15, 15),
  ]);
}

/**
 * Internal: Check throttle without recording
 */
async function checkAuthThrottleInternal(
  scope: string,
  identifier: string,
  maxAttempts = 5,
  windowMinutes = 15
): Promise<boolean> {
  const docRef = admin.firestore().collection("authThrottle").doc(`${scope}:${identifier}`);
  const doc = await docRef.get();

  if (!doc.exists) return true;

  const data = doc.data();
  if (!data) return true;

  // Check if lock expired
  if (data.lockedUntil && data.lockedUntil.toDate() > new Date()) {
    return false;
  }

  // Check if window expired
  const windowStarted = data.windowStartedAt?.toDate() || new Date(0);
  const windowEnd = new Date(windowStarted.getTime() + 15 * 60 * 1000);
  if (new Date() > windowEnd) {
    // Window expired, allow
    return true;
  }

  return (data.attempts || 0) < 5; // Default 5 attempts
}

/**
 * Record auth attempt
 */
async function recordAuthAttemptInternal(
  scope: string,
  identifier: string,
  succeeded: boolean,
  maxAttempts = 5,
  windowMinutes = 15
): Promise<void> {
  if (succeeded) {
    // Reset on success
    await admin.firestore().collection("authThrottle").doc(`${scope}:${identifier}`).delete();
    return;
  }

  const docRef = admin.firestore().collection("authThrottle").doc(`${scope}:${identifier}`);
  const doc = await docRef.get();

  const now = new Date();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const lockMs = 15 * 60 * 1000; // 15 minutes lock

  if (doc.exists) {
    const data = doc.data()!;
    const windowStarted = data.windowStartedAt?.toDate() || new Date(0);
    const windowExpired = now.getTime() - windowStarted.getTime() > 15 * 60 * 1000;

    const currentAttempts = windowExpired ? 1 : (data.attempts || 0) + 1;
    const newWindowStarted = windowExpired ? now : data.windowStartedAt;

    let lockedUntil = data.lockedUntil || null;
    if (currentAttempts >= 5 && (!data.lockedUntil || data.lockedUntil.toDate() <= new Date())) {
      lockedUntil = admin.firestore.Timestamp.fromDate(new Date(now.getTime() + 15 * 60 * 1000));
    }

    await admin.firestore().collection("authThrottle").doc(`${scope}:${identifier}`).set({
      scope,
      identifier,
      attempts: currentAttempts,
      windowStartedAt: admin.firestore.Timestamp.fromDate(newWindowStarted),
      lockedUntil: lockedUntil || admin.firestore.FieldValue.delete(),
    });
  } else {
    await admin.firestore().collection("authThrottle").doc(`${scope}:${identifier}`).set({
      scope,
      identifier,
      attempts: 1,
      windowStartedAt: admin.firestore.Timestamp.fromDate(new Date()),
      lockedUntil: null,
    });
  }
}

/**
 * Check if user is a Firebase-linked user
 */
export async function isFirebaseUser(userId: string): Promise<boolean> {
  const userDoc = await admin.firestore().collection("users").doc(userId).get();
  if (!userDoc.exists) return false;
  const data = userDoc.data();
  return !!data?.firebaseUid;
}

/**
 * Public API: Check throttle for sign-in
 */
export async function checkSignInAllowed(identifier: string, req: any): Promise<{ allowed: boolean }> {
  const hashedId = hashIdentifier(identifier);
  const clientIp = getClientIp(req);
  const hashedIp = hashIdentifier(clientIp);

  const [account, network] = await Promise.all([
    checkAuthThrottleInternal("signin:account", hashIdentifier(identifier)),
    checkAuthThrottleInternal("signin:ip", hashIdentifier(getClientIp(req))),
  ]);

  return { allowed: account && network };
}

/**
 * Public API: Record sign-in result
 */
export async function recordSignInResult(identifier: string, succeeded: boolean, req: any): Promise<void> {
  await Promise.all([
    recordAuthAttemptInternal("signin:account", hashIdentifier(identifier), succeeded),
    recordAuthAttemptInternal("signin:ip", hashIdentifier(getClientIp(req)), succeeded),
  ]);
}

/**
 * Hash identifier for privacy
 */
function hashIdentifier(value: string): string {
  return crypto.createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/**
 * Get client IP
 */
function getClientIp(req: any): string {
  return req.ip || req.headers["x-forwarded-for"]?.split(",")[0] || req.headers["x-real-ip"] || "unknown";
}

/**
 * Check if user is Firebase-linked
 */
async function isFirebaseUser(userId: string): Promise<boolean> {
  try {
    const userDoc = await admin.firestore().collection("users").doc(userId).get();
    if (!userDoc.exists) return false;
    return !!userDoc.data()?.firebaseUid;
  } catch {
    return false;
  }
}

/**
 * Check throttle for actions (booking, reschedule)
 */
export async function checkActionThrottle(
  action: "booking" | "reschedule",
  userId: string,
  req: any
): Promise<{ allowed: boolean }> {
  const isFirebase = await isFirebaseUser(userId);
  const maxAttempts = isFirebase ? 20 : 5;
  const maxIp = isFirebase ? 60 : 15;

  const [account, network] = await Promise.all([
    checkAuthThrottleInternal(`${action}:account`, userId, isFirebase ? 20 : 5, 15),
    checkAuthThrottleInternal(`${action}:ip`, hashIdentifier(getClientIp(req)), isFirebase ? 60 : 15, 15),
  ]);

  return { allowed: account && network };
}

/**
 * Record action throttle attempt
 */
export async function recordActionThrottle(
  action: "booking" | "reschedule",
  userId: string,
  succeeded: boolean,
  req: any
): Promise<void> {
  const isFirebase = await isFirebaseUser(userId);
  const max = isFirebase ? 20 : 5;
  const maxIp = isFirebase ? 60 : 15;

  await Promise.all([
    recordAuthAttemptInternal(`${action}:account`, userId, succeeded, isFirebase ? 20 : 5, 15),
    recordAuthAttemptInternal(`${action}:ip`, hashIdentifier(getClientIp(req)), succeeded, isFirebase ? 60 : 15, 15),
  ]);
}

import * as crypto from "crypto";
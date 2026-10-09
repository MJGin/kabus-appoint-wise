import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

const db = admin.firestore();

/**
 * Scheduled: Clean up old auth throttle records (daily)
 */
export const cleanupAuthThrottle = functions.pubsub
  .schedule("0 3 * * *") // 3 AM daily
  .timeZone("Africa/Nairobi")
  .onRun(async () => {
    const cutoff = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)); // 7 days ago
    
    const snapshot = await admin.firestore()
      .collection("authThrottle")
      .where("windowStartedAt", "<", admin.firestore.Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
      .limit(500)
      .get();

    if (snapshot.empty) return;

    const batch = admin.firestore().batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    logger.info(`Cleaned up ${snapshot.size} old auth throttle records`);
  });

/**
 * Scheduled: Clean up old notifications (weekly)
 */
export const cleanupNotifications = functions.pubsub
  .schedule("0 4 * * 0") // 4 AM Sunday
  .timeZone("Africa/Nairobi")
  .onRun(async () => {
    const cutoff = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); // 30 days ago
    
    const snapshot = await admin.firestore()
      .collection("notifications")
      .where("createdAt", "<", admin.firestore.Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
      .where("read", "==", true)
      .limit(500)
      .get();

    if (snapshot.empty) return;

    const batch = admin.firestore().batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    logger.info(`Cleaned up ${snapshot.size} old read notifications`);
  });

/**
 * Scheduled: Clean up old error reports (monthly)
 */
export const cleanupErrorReports = functions.pubsub
  .schedule("0 5 1 * *") // 5 AM 1st of month
  .timeZone("Africa/Nairobi")
  .onRun(async () => {
    const cutoff = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)); // 90 days ago
    
    const snapshot = await admin.firestore()
      .collection("errorReports")
      .where("createdAt", "<", admin.firestore.Timestamp.fromDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)))
      .where("resolved", "==", true)
      .limit(500)
      .get();

    if (snapshot.empty) return;

    const batch = admin.firestore().batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    logger.info(`Cleaned up ${snapshot.size} old resolved error reports`);
  });

/**
 * Scheduled: Clean up old activity logs (monthly, keep 1 year)
 */
export const cleanupActivityLogs = functions.pubsub
  .schedule("0 5 2 * *") // 5 AM 2nd of month
  .timeZone("Africa/Nairobi")
  .onRun(async () => {
    const cutoff = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)); // 1 year
    
    const snapshot = await admin.firestore()
      .collection("activityLog")
      .where("createdAt", "<", admin.firestore.Timestamp.fromDate(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)))
      .limit(500)
      .get();

    if (snapshot.empty) return;

    const batch = admin.firestore().batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    logger.info(`Cleaned up ${snapshot.size} old activity logs`);
  });

/**
 * Callable: Manual cleanup trigger (admin only)
 */
export const manualCleanup = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  // Check admin
  const roleSnap = await admin.firestore().collection("users").doc(context.auth.uid).get();
  if (!roleSnap.exists || roleSnap.data()?.role !== "administrator") {
    throw new functions.https.HttpsError("permission-denied", "Only administrators can trigger cleanup");
  }

  const { type } = data as { type?: "throttle" | "notifications" | "errors" | "activity" | "all" };
  
  let cleaned = 0;

  if (!type || type === "throttle" || type === "all") {
    const snap = await admin.firestore()
      .collection("authThrottle")
      .where("windowStartedAt", "<", admin.firestore.Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
      .limit(500)
      .get();
    
    const batch = admin.firestore().batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    cleaned += snap.size;
  }

  if (!type || type === "notifications" || type === "all") {
    const snap = await admin.firestore()
      .collection("notifications")
      .where("createdAt", "<", admin.firestore.Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))
      .where("read", "==", true)
      .limit(500)
      .get();
    
    const batch = admin.firestore().batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    cleaned += snap.size;
  }

  if (!type || type === "errors" || type === "all") {
    const snap = await admin.firestore()
      .collection("errorReports")
      .where("createdAt", "<", admin.firestore.Timestamp.fromDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)))
      .where("resolved", "==", true)
      .limit(500)
      .get();
    
    const batch = admin.firestore().batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    cleaned += snap.size;
  }

  return { success: true, cleaned };
});
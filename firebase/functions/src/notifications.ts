import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

const db = admin.firestore();

/**
 * Trigger: Send notification when appointment is created
 */
export const onAppointmentCreated = functions.firestore
  .document("appointments/{appointmentId}")
  .onCreate(async (snap, context) => {
    const appointment = snap.data();
    
    // Notify lecturer
    await admin.firestore().collection("notifications").add({
      userId: appointment.lecturerId,
      type: "appointment_request",
      title: "New Appointment Request",
      message: `A student has requested an appointment for ${appointment.apptDate} ${appointment.block}`,
      read: false,
      relatedId: context.params.appointmentId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`Notification sent to lecturer ${appointment.lecturerId} for appointment ${context.params.appointmentId}`);
  });

/**
 * Trigger: Notify student when appointment is decided
 */
export const onAppointmentDecided = functions.firestore
  .document("appointments/{appointmentId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status === after.status) return;
    if (!["accepted", "declined"].includes(after.status)) return;

    const statusText = after.status === "accepted" ? "accepted" : "declined";
    
    await admin.firestore().collection("notifications").add({
      userId: after.studentId,
      type: "appointment_decision",
      title: `Appointment ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}`,
      message: `Your appointment for ${after.apptDate} ${after.block} has been ${statusText}.`,
      read: false,
      relatedId: context.params.appointmentId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`Notification sent to student ${after.studentId} for appointment ${context.params.appointmentId}`);
  });

/**
 * Trigger: Notify when make-up session added
 */
export const onMakeupSessionAdded = functions.firestore
  .document("makeupSessions/{sessionId}")
  .onCreate(async (snap, context) => {
    const session = snap.data();
    
    // Notify students of that lecturer (could be filtered by year group)
    await admin.firestore().collection("notifications").add({
      userId: session.lecturerId,
      type: "makeup_session",
      title: "Make-up Session Added",
      message: `Make-up session added for ${session.sessionDate} ${session.block}`,
      read: false,
      relatedId: context.params.sessionId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

/**
 * Trigger: Log activity for audit
 */
export const logActivity = functions.firestore
  .document("{collection}/{docId}")
  .onWrite(async (change, context) => {
    // Only log for specific collections
    const loggedCollections = ["appointments", "timetableSlots", "examSlots", "makeupSessions", "semesters", "users"];
    if (!loggedCollections.includes(context.params.collection)) return;

    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;

    // Determine action
    let action = "update";
    if (!change.before.exists && change.after.exists) action = "create";
    else if (change.before.exists && !change.after.exists) action = "delete";

    // Get actor from context (if available via callable)
    // For direct Firestore writes, we can't get auth context easily
    // This would typically be called from callable functions

    // For now, log minimal info
    await admin.firestore().collection("activityLog").add({
      action: `${action}_${context.params.collection}`,
      entityType: context.params.collection,
      entityId: context.params.docId,
      category: "operational",
      details: {
        before: before ? JSON.stringify(before) : null,
        after: after ? JSON.stringify(after) : null,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
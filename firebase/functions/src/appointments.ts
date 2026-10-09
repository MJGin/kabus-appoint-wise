import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

const db = admin.firestore();

/**
 * Time blocks enum
 */
export type TimeBlock = "block_1" | "block_2" | "block_3";

export const TIME_BLOCKS: Record<TimeBlock, { label: string; start: string; end: string }> = {
  block_1: { label: "08:00 – 11:00", start: "08:00", end: "11:00" },
  block_2: { label: "11:00 – 14:00", start: "11:00", end: "14:00" },
  block_3: { label: "14:00 – 17:00", start: "14:00", end: "17:00" },
};

export type AppointmentStatus = "pending" | "accepted" | "declined" | "cancelled";

export interface Appointment {
  id: string;
  studentId: string;
  lecturerId: string;
  apptDate: string; // YYYY-MM-DD
  block: TimeBlock;
  status: AppointmentStatus;
  reason: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  decidedAt?: admin.firestore.Timestamp;
}

export interface TimetableSlot {
  id: string;
  semesterId: string;
  lecturerId: string;
  unitCode: string;
  unitName: string;
  yearGroup: number;
  dayOfWeek: number; // 1=Mon, 5=Fri
  block: TimeBlock;
  createdAt: admin.firestore.Timestamp;
}

export interface MakeupSession {
  id: string;
  lecturerId: string;
  sessionDate: string; // YYYY-MM-DD
  block: TimeBlock;
  note?: string;
  createdAt: admin.firestore.Timestamp;
}

export interface ExamSlot {
  id: string;
  semesterId: string;
  lecturerId: string;
  unitCode: string;
  unitName?: string;
  examDate: string; // YYYY-MM-DD
  block: TimeBlock;
  venue: string;
  createdAt: admin.firestore.Timestamp;
}

export interface Semester {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  examStartDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: admin.firestore.Timestamp;
}

export interface AppointmentReason {
  appointmentId: string;
  reason: string;
  createdAt: admin.firestore.Timestamp;
}

const COLLECTIONS = {
  users: "users",
  appointments: "appointments",
  appointmentReasons: "appointment_reasons",
  timetableSlots: "timetable_slots",
  makeupSessions: "makeup_sessions",
  examSlots: "exam_slots",
  semesters: "semesters",
  activityLog: "activity_log",
  errorReports: "error_reports",
  authThrottle: "auth_throttle",
} as const;

type TimeBlockKey = "block_1" | "block_2" | "block_3";
const BLOCKS: TimeBlockKey[] = ["block_1", "block_2", "block_3"];

/**
 * Check if a date/time is during Chapel (Wednesday 11:00-14:00)
 */
export function isChapel(date: string, block: string): boolean {
  const d = new Date(date + "T00:00:00");
  return d.getDay() === 3 && block === "block_2"; // Wednesday = 3
}

/**
 * Get ISO day of week (1=Mon, 7=Sun)
 */
function isoDow(date: string): number {
  const d = new Date(date + "T00:00:00").getDay();
  return d === 0 ? 7 : d;
}

/**
 * Format date for display
 */
function formatDate(date: string): string {
  return new Date(date + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * Get block label
 */
function blockLabel(b: string): string {
  const map: Record<string, string> = {
    block_1: "08:00 – 11:00",
    block_2: "11:00 – 14:00",
    block_3: "14:00 – 17:00",
  };
  return map[b] || b;
}

/**
 * Check if lecturer is available at a given date/block
 */
export async function lecturerIsAvailable(
  lecturerId: string,
  date: string,
  block: string
): Promise<boolean> {
  if (isChapel(date, block)) return false;

  const semSnap = await admin.firestore()
    .collection("semesters")
    .where("isActive", "==", true)
    .limit(1)
    .get();

  if (semSnap.empty) return false;
  const sem = semSnap.docs[0].data();
  const start = sem.startDate;
  const end = sem.endDate;
  const examStart = sem.examStartDate;

  if (date < start || date > end) return false;

  const dow = isoDow(date);

  // Check make-up sessions first
  const makeupSnap = await admin.firestore()
    .collection("makeupSessions")
    .where("lecturerId", "==", lecturerId)
    .where("sessionDate", "==", date)
    .where("block", "==", block)
    .limit(1)
    .get();
  if (!makeupSnap.empty) return true;

  const inExam = date >= sem.examStartDate;

  if (inExam) {
    // Check exam slots
    const examSnap = await admin.firestore()
      .collection("examSlots")
      .where("lecturerId", "==", lecturerId)
      .where("examDate", "==", date)
      .where("block", "==", block)
      .limit(1)
      .get();
    return !examSnap.empty;
  }

  // Check timetable slots
  const timetableSnap = await admin.firestore()
    .collection("timetableSlots")
    .where("lecturerId", "==", lecturerId)
    .where("semesterId", "==", sem.id)
    .where("dayOfWeek", "==", isoDow(date))
    .where("block", "==", block)
    .limit(1)
    .get();
  return !timetableSnap.empty;
}

/**
 * Get available blocks for a lecturer on a date
 */
export async function getAvailableBlocks(
  lecturerId: string,
  date: string
): Promise<string[]> {
  if (isChapel(date, "block_2")) return []; // Chapel blocks all
  
  const available: string[] = [];
  for (const block of ["block_1", "block_2", "block_3"] as const) {
    if (isChapel(date, block)) continue;
    if (await lecturerIsAvailable(lecturerId, date, block)) {
      available.push(block);
    }
  }
  return available;
}

/**
 * Callable: Book appointment (student only)
 */
export const bookAppointment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  // Check role is student
  const roleSnap = await admin.firestore().collection("users").doc(context.auth.uid).get();
  if (!roleSnap.exists || roleSnap.data()?.role !== "student") {
    throw new functions.https.HttpsError("permission-denied", "Only students can request appointments");
  }

  // Rate limit check
  const allowed = await checkThrottle("booking", context.auth.uid);
  if (!allowed) {
    throw new functions.https.HttpsError("resource-exhausted", "Too many requests. Try again in 15 minutes.");
  }

  const { lecturerId, apptDate, block, reason } = data as {
    lecturerId: string;
    apptDate: string;
    block: string;
    reason: string;
  };

  // Validate
  if (!lecturerId || !apptDate || !block || !reason || reason.trim().length < 5) {
    throw new functions.https.HttpsError("invalid-argument", "Missing or invalid parameters");
  }

  if (!["block_1", "block_2", "block_3"].includes(data.block)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid time block");
  }

  // Check lecturer exists and is lecturer
  const lecturerSnap = await admin.firestore().collection("users").doc(data.lecturerId).get();
  if (!lecturerSnap.exists || lecturerSnap.data()?.role !== "lecturer") {
    throw new functions.https.HttpsError("not-found", "Lecturer not found");
  }

  // Check availability
  const available = await lecturerIsAvailable(data.lecturerId, data.apptDate, data.block);
  if (!available) {
    throw new functions.https.HttpsError("failed-precondition", "The lecturer has no recorded availability at that date and time.");
  }

  // Check for existing appointment
  const existing = await admin.firestore()
    .collection("appointments")
    .where("lecturerId", "==", data.lecturerId)
    .where("apptDate", "==", data.apptDate)
    .where("block", "==", data.block)
    .where("status", "in", ["pending", "accepted"])
    .limit(1)
    .get();

  if (!existing.empty) {
    throw new functions.https.HttpsError("already-exists", "That appointment time is no longer available.");
  }

  // Check Chapel
  if (isChapel(data.apptDate, data.block)) {
    throw new functions.https.HttpsError("failed-precondition", "Wednesday 11:00-14:00 is Chapel; no appointment may be placed there.");
  }

  // Check semester active
  const semSnap = await admin.firestore().collection("semesters").where("isActive", "==", true).limit(1).get();
  if (semSnap.empty) {
    throw new functions.https.HttpsError("failed-precondition", "No active semester");
  }
  const sem = semSnap.docs[0].data();
  if (data.apptDate < sem.startDate || data.apptDate > sem.endDate) {
    throw new functions.https.HttpsError("failed-precondition", "Date outside semester range");
  }

  // Create appointment
  const appointmentRef = admin.firestore().collection("appointments").doc();
  const appointmentId = appointmentRef.id;

  await admin.firestore().runTransaction(async (transaction) => {
    // Create appointment
    transaction.set(admin.firestore().collection("appointments").doc(appointmentId), {
      studentId: context.auth.uid,
      lecturerId: data.lecturerId,
      apptDate: data.apptDate,
      block: data.block,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create reason
    transaction.set(admin.firestore().collection("appointmentReasons").doc(appointmentId), {
      appointmentId: appointmentRef.id,
      reason: data.reason.trim(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log activity
    transaction.set(admin.firestore().collection("activityLog").doc(), {
      actorId: context.auth.uid,
      action: "create_appointment",
      entityType: "appointments",
      entityId: appointmentRef.id,
      category: "operational",
      details: { status: "pending", date: data.apptDate, block: data.block },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await recordThrottle("booking", context.auth.uid, true);
  return { success: true, appointmentId };
});

/**
 * Callable: Cancel appointment (student only)
 */
export const cancelAppointment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  const { appointmentId } = data as { appointmentId: string };
  if (!appointmentId) {
    throw new functions.https.HttpsError("invalid-argument", "Appointment ID required");
  }

  const appointmentRef = admin.firestore().collection("appointments").doc(appointmentId);
  const appointmentSnap = await appointmentRef.get();

  if (!appointmentSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Appointment not found");
  }

  const appointment = appointmentSnap.data();
  if (appointment.studentId !== context.auth.uid) {
    throw new functions.https.HttpsError("permission-denied", "Not your appointment");
  }

  if (appointment.status !== "pending") {
    throw new functions.https.HttpsError("failed-precondition", "This appointment cannot be cancelled");
  }

  await admin.firestore().runTransaction(async (transaction) => {
    transaction.update(admin.firestore().collection("appointments").doc(appointmentId), {
      status: "cancelled",
      decidedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log activity
    transaction.set(admin.firestore().collection("activityLog").doc(), {
      actorId: context.auth.uid,
      action: "cancel_appointment",
      entityType: "appointments",
      entityId: appointmentId,
      category: "operational",
      details: { status: "cancelled" },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { success: true };
});

/**
 * Callable: Decide appointment (lecturer only)
 */
export const decideAppointment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  // Rate limit
  const allowed = await checkThrottle("reschedule", context.auth.uid);
  if (!allowed) {
    throw new functions.https.HttpsError("resource-exhausted", "Too many changes. Try again in 15 minutes.");
  }

  const { appointmentId, decision, newDate, newBlock } = data as {
    appointmentId: string;
    decision: "accepted" | "declined";
    newDate?: string;
    newBlock?: string;
  };

  if (!appointmentId || !decision || !["accepted", "declined"].includes(decision)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid parameters");
  }

  // Check if lecturer
  const roleSnap = await admin.firestore().collection("users").doc(context.auth.uid).get();
  if (!roleSnap.exists || roleSnap.data()?.role !== "lecturer") {
    throw new functions.https.HttpsError("permission-denied", "Only lecturers can decide appointments");
  }

  const appointmentRef = admin.firestore().collection("appointments").doc(data.appointmentId);
  const appointmentSnap = await appointmentRef.get();

  if (!appointmentSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Appointment not found");
  }

  const appointment = appointmentSnap.data();
  if (appointment.lecturerId !== context.auth.uid) {
    throw new functions.https.HttpsError("permission-denied", "Not your appointment");
  }

  if (!["pending", "accepted"].includes(appointment.status)) {
    throw new functions.https.HttpsError("failed-precondition", "This appointment cannot be changed");
  }

  if (!["accepted", "declined"].includes(data.decision)) {
    throw new functions.https.HttpsError("invalid-argument", "The decision must be accepted or declined.");
  }

  // Reschedule validation
  if ((data.newDate && !data.newBlock) || (!data.newDate && data.newBlock)) {
    throw new functions.https.HttpsError("invalid-argument", "A reschedule needs both a date and a time block.");
  }

  if (data.newDate) {
    if (!await lecturerIsAvailable(context.auth.uid, data.newDate, data.newBlock!)) {
      throw new functions.https.HttpsError("failed-precondition", "The new time is outside recorded availability.");
    }

    if (isChapel(data.newDate, data.newBlock!)) {
      throw new functions.https.HttpsError("failed-precondition", "Wednesday 11:00-14:00 is Chapel; nothing may be scheduled there.");
    }

    // Check conflict
    const conflict = await admin.firestore()
      .collection("appointments")
      .where("lecturerId", "==", context.auth.uid)
      .where("apptDate", "==", data.newDate)
      .where("block", "==", data.newBlock)
      .where("status", "in", ["pending", "accepted"])
      .where(admin.firestore.FieldPath.documentId(), "!=", data.appointmentId)
      .limit(1)
      .get();

    if (!conflict.empty) {
      throw new functions.https.HttpsError("already-exists", "The new appointment time is already occupied.");
    }
  }

  await admin.firestore().runTransaction(async (transaction) => {
    const updates: Record<string, unknown> = {
      status: data.decision,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      decidedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (data.newDate) {
      transaction.update(admin.firestore().collection("appointments").doc(data.appointmentId), {
        apptDate: data.newDate,
        block: data.newBlock,
      });
    }

    transaction.update(admin.firestore().collection("appointments").doc(data.appointmentId), {
      status: data.decision,
      ...(data.newDate && { apptDate: data.newDate }),
      ...(data.newBlock && { block: data.newBlock }),
      decidedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log activity
    transaction.set(admin.firestore().collection("activityLog").doc(), {
      actorId: context.auth.uid,
      action: data.decision === "accepted" ? "accept_appointment" : "decline_appointment",
      entityType: "appointments",
      entityId: data.appointmentId,
      category: "operational",
      details: { 
        decision: data.decision, 
        date: data.newDate || data.apptDate, 
        block: data.newBlock || data.block 
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await recordThrottle("reschedule", context.auth.uid, true);
  return { success: true };
});

/**
 * Callable: Add make-up session (lecturer only)
 */
export const addMakeupSession = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  const roleSnap = await admin.firestore().collection("users").doc(context.auth.uid).get();
  if (!roleSnap.exists || roleSnap.data()?.role !== "lecturer") {
    throw new functions.https.HttpsError("permission-denied", "Only lecturers can add make-up sessions");
  }

  const { sessionDate, block, note } = data as {
    sessionDate: string;
    block: string;
    note?: string;
  };

  if (!sessionDate || !block || !["block_1", "block_2", "block_3"].includes(block)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid parameters");
  }

  if (isChapel(sessionDate, block)) {
    throw new functions.https.HttpsError("failed-precondition", "Wednesday 11:00-14:00 is Chapel; nothing may be scheduled there.");
  }

  await admin.firestore().collection("makeupSessions").add({
    lecturerId: context.auth.uid,
    sessionDate,
    block,
    note: note || "",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});

/**
 * Callable: Remove make-up session (lecturer only)
 */
export const removeMakeupSession = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  const { sessionId } = data as { sessionId: string };
  if (!sessionId) {
    throw new functions.https.HttpsError("invalid-argument", "Session ID required");
  }

  const sessionRef = admin.firestore().collection("makeupSessions").doc(sessionId);
  const sessionSnap = await sessionRef.get();

  if (!sessionSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Make-up session not found");
  }

  const session = sessionSnap.data();
  if (session.lecturerId !== context.auth.uid) {
    throw new functions.https.HttpsError("permission-denied", "Not your make-up session");
  }

  await sessionRef.delete();
  return { success: true };
});
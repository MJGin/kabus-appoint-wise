import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

const db = admin.firestore();

export interface TimetableSlotData {
  lecturerId: string;
  unitCode: string;
  unitName: string;
  yearGroup: number;
  dayOfWeek: number; // 1-5
  block: "block_1" | "block_2" | "block_3";
}

export interface SemesterData {
  name: string;
  startDate: string; // YYYY-MM-DD
  examStartDate: string;
  endDate: string;
}

export interface ExamSlotData {
  lecturerId: string;
  unitCode: string;
  unitName?: string;
  examDate: string;
  block: "block_1" | "block_2" | "block_3";
  venue: string;
}

/**
 * Callable: Add timetable slot (admin only)
 */
export const addTimetableSlot = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  // Check admin role
  const roleSnap = await admin.firestore().collection("users").doc(context.auth.uid).get();
  if (!roleSnap.exists || roleSnap.data()?.role !== "administrator") {
    throw new functions.https.HttpsError("permission-denied", "Only administrators can manage timetable");
  }

  const { lecturerId, unitCode, unitName, yearGroup, dayOfWeek, block } = data as {
    lecturerId: string;
    unitCode: string;
    unitName: string;
    yearGroup: number;
    dayOfWeek: number;
    block: "block_1" | "block_2" | "block_3";
  };

  // Validate
  if (!lecturerId || !unitCode || !unitName || !yearGroup || !dayOfWeek || !block) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields");
  }

  if (dayOfWeek < 1 || dayOfWeek > 5) {
    throw new functions.https.HttpsError("invalid-argument", "Day of week must be 1-5 (Mon-Fri)");
  }

  if (!["block_1", "block_2", "block_3"].includes(data.block)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid block");
  }

  if (data.dayOfWeek === 3 && data.block === "block_2") {
    throw new functions.https.HttpsError("invalid-argument", "Wednesday 11:00-14:00 is Chapel; cannot be timetabled");
  }

  if (data.yearGroup < 1 || data.yearGroup > 6) {
    throw new functions.https.HttpsError("invalid-argument", "Year group must be 1-6");
  }

  // Get active semester
  const semSnap = await admin.firestore().collection("semesters").where("isActive", "==", true).limit(1).get();
  if (semSnap.empty) {
    throw new functions.https.HttpsError("failed-precondition", "No active semester. Set an active semester first.");
  }
  const sem = semSnap.docs[0];

  // Check lecturer exists
  const lecturerSnap = await admin.firestore().collection("users").doc(data.lecturerId).get();
  if (!lecturerSnap.exists || lecturerSnap.data()?.role !== "lecturer") {
    throw new functions.https.HttpsError("not-found", "Lecturer not found");
  }

  // Check for conflict
  const conflict = await admin.firestore()
    .collection("timetableSlots")
    .where("semesterId", "==", sem.id)
    .where("lecturerId", "==", data.lecturerId)
    .where("dayOfWeek", "==", data.dayOfWeek)
    .where("block", "==", data.block)
    .limit(1)
    .get();

  if (!existing.empty) {
    throw new functions.https.HttpsError("already-exists", "This lecturer already has a class at this time");
  }

  // Add timetable slot
  const slotRef = await admin.firestore().collection("timetableSlots").add({
    semesterId: sem.id,
    lecturerId: data.lecturerId,
    unitCode: data.unitCode,
    unitName: data.unitName,
    yearGroup: data.yearGroup,
    dayOfWeek: data.dayOfWeek,
    block: data.block,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, slotId: slotRef.id };
});

/**
 * Callable: Remove timetable slot (admin only)
 */
export const removeTimetableSlot = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  const roleSnap = await admin.firestore().collection("users").doc(context.auth.uid).get();
  if (!roleSnap.exists || roleSnap.data()?.role !== "administrator") {
    throw new functions.https.HttpsError("permission-denied", "Only administrators can manage timetable");
  }

  const { slotId } = data as { slotId: string };
  if (!slotId) {
    throw new functions.https.HttpsError("invalid-argument", "Slot ID required");
  }

  const slotRef = admin.firestore().collection("timetableSlots").doc(slotId);
  const slotSnap = await slotRef.get();

  if (!slotSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Timetable slot not found");
  }

  await slotRef.delete();
  return { success: true };
});

/**
 * Callable: Add semester (admin only)
 */
export const addSemester = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  const roleSnap = await admin.firestore().collection("users").doc(context.auth.uid).get();
  if (!roleSnap.exists || roleSnap.data()?.role !== "administrator") {
    throw new functions.https.HttpsError("permission-denied", "Only administrators can manage semesters");
  }

  const { name, startDate, examStartDate, endDate } = data as {
    name: string;
    startDate: string;
    examStartDate: string;
    endDate: string;
  };

  // Validate dates
  if (!name || !startDate || !examStartDate || !endDate) {
    throw new functions.https.HttpsError("invalid-argument", "All dates and name required");
  }

  if (new Date(data.startDate) > new Date(data.endDate)) {
    throw new functions.https.HttpsError("invalid-argument", "Start date must be before end date");
  }

  if (new Date(data.examStartDate) < new Date(data.startDate)) {
    throw new functions.https.HttpsError("invalid-argument", "Exam start must be after semester start");
  }

  if (new Date(data.examStartDate) > new Date(data.endDate)) {
    throw new functions.https.HttpsError("invalid-argument", "Exam start must be before semester end");
  }

  if (new Date(data.examStartDate) < new Date(new Date(data.startDate).getTime() + 70 * 24 * 60 * 60 * 1000)) {
    throw new functions.https.HttpsError("invalid-argument", "Examinations must begin no earlier than week eleven (70 days after start)");
  }

  const semRef = await admin.firestore().collection("semesters").add({
    name: data.name,
    startDate: data.startDate,
    examStartDate: data.examStartDate,
    endDate: data.endDate,
    isActive: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, semesterId: semRef.id };
});

/**
 * Callable: Set active semester (admin only)
 */
export const setActiveSemester = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  const roleSnap = await admin.firestore().collection("users").doc(context.auth.uid).get();
  if (!roleSnap.exists || roleSnap.data()?.role !== "administrator") {
    throw new functions.https.HttpsError("permission-denied", "Only administrators can change active semester");
  }

  const { semesterId } = data as { semesterId: string };
  if (!semesterId) {
    throw new functions.https.HttpsError("invalid-argument", "Semester ID required");
  }

  const batch = admin.firestore().batch();
  
  // Deactivate all
  const allSemesters = await admin.firestore().collection("semesters").get();
  allSemesters.docs.forEach(doc => {
    if (doc.id !== data.semesterId) {
      batch.update(doc.ref, { isActive: false });
    }
  });

  // Activate selected
  const semRef = admin.firestore().collection("semesters").doc(data.semesterId);
  const semSnap = await semRef.get();
  if (!semSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Semester not found");
  }
  batch.update(semRef, { isActive: true });

  await batch.commit();
  return { success: true };
});

/**
 * Callable: Add exam slot (admin only)
 */
export const addExamSlot = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be authenticated");
  }

  const roleSnap = await admin.firestore().collection("users").doc(context.auth.uid).get();
  if (!roleSnap.exists || roleSnap.data()?.role !== "administrator") {
    throw new functions.https.HttpsError("permission-denied", "Only administrators can manage exam slots");
  }

  const { lecturerId, unitCode, examDate, block, venue, unitName } = data as {
    lecturerId: string;
    unitCode: string;
    examDate: string;
    block: "block_1" | "block_2" | "block_3";
    venue: string;
    unitName?: string;
  };

  // Validate
  if (!lecturerId || !unitCode || !examDate || !block || !venue) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields");
  }

  if (!["block_1", "block_2", "block_3"].includes(data.block)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid block");
  }

  // Check Chapel
  const isChapel = (date: string, block: string) => {
    const d = new Date(date + "T00:00:00");
    return d.getDay() === 3 && block === "block_2";
  };

  if (isChapel(data.examDate, data.block)) {
    throw new functions.https.HttpsError("invalid-argument", "Wednesday 11:00-14:00 is Chapel; nothing may be scheduled there");
  }

  // Get active semester
  const semSnap = await admin.firestore().collection("semesters").where("isActive", "==", true).limit(1).get();
  if (semSnap.empty) {
    throw new functions.https.HttpsError("failed-precondition", "No active semester");
  }
  const sem = semSnap.docs[0];

  // Check exam period
  if (data.examDate < sem.data().examStartDate || data.examDate > sem.data().endDate) {
    throw new functions.https.HttpsError("invalid-argument", "Exam slots must fall inside the configured examination period");
  }

  // Check lecturer
  const lecturerSnap = await admin.firestore().collection("users").doc(data.lecturerId).get();
  if (!lecturerSnap.exists || lecturerSnap.data()?.role !== "lecturer") {
    throw new functions.https.HttpsError("not-found", "Lecturer not found");
  }

  // Check Chapel for exam
  if (isChapel(data.examDate, data.block)) {
    throw new functions.https.HttpsError("invalid-argument", "Wednesday 11:00-14:00 is Chapel; nothing may be scheduled there");
  }

  const slotRef = await admin.firestore().collection("examSlots").add({
    semesterId: sem.id,
    lecturerId: data.lecturerId,
    unitCode: data.unitCode,
    unitName: data.unitName || "",
    examDate: data.examDate,
    block: data.block,
    venue: data.venue,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true, slotId: slotRef.id };
});
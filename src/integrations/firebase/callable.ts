import { getFunctions, httpsCallable, Functions } from "firebase/functions";
import { firebaseFunctions, getFirebaseFunctions, isFirebaseInitialized } from "./client";

/**
 * Get a callable Cloud Function
 */
function getCallable<T, R>(name: string) {
  const functions = getFirebaseFunctions();
  return httpsCallable<T, R>(getFirebaseFunctions(), name);
}

/**
 * Type-safe callable function wrapper
 */
export function createCallable<T, R>(name: string) {
  if (!isFirebaseInitialized()) {
    throw new Error("Firebase not initialized");
  }
  
  const functions = getFirebaseFunctions();
  return httpsCallable<T, R>(firebaseFunctions!, name);
}

/**
 * Auth callables
 */
export const firebaseSignIn = createCallable<{ email: string; password: string }, { success: boolean; user?: { firebaseUid: string; supabaseUserId: string; email: string }; error?: string }>("firebaseSignIn");
export const firebaseSignUp = createCallable<{ fullName: string; email: string; password: string; role?: "student" | "lecturer" | "dean" | "it_support" }, { success: boolean; user?: { firebaseUid: string; supabaseUserId: string; email: string }; error?: string }>("firebaseSignUp");
export const firebaseResetPassword = createCallable<{ email: string }, { success: boolean; error?: string }>("firebaseResetPassword");
export const getProfile = createCallable<{}, { success: boolean; profile?: any; error?: string }>("getProfile");
export const updateProfile = createCallable<Partial<{ fullName: string; title: string; department: string; bio: string; photoUrl: string; officeLocation: string }>, { success: boolean; error?: string }>("updateProfile");
export const checkDemoAccount = createCallable<{}, { isDemo: boolean }>("checkDemoAccount");
export const linkFirebaseUser = createCallable<{ email: string }, { success: boolean; profileId?: string; error?: string }>("linkFirebaseUser");

/**
 * Appointment callables
 */
export const bookAppointment = createCallable<{ lecturerId: string; apptDate: string; block: "block_1" | "block_2" | "block_3"; reason: string }, { success: boolean; appointmentId?: string; error?: string }>("bookAppointment");
export const cancelAppointment = createCallable<{ appointmentId: string }, { success: boolean; error?: string }>("cancelAppointment");
export const decideAppointment = createCallable<{ appointmentId: string; decision: "accepted" | "declined"; newDate?: string; newBlock?: "block_1" | "block_2" | "block_3" }, { success: boolean; error?: string }>("decideAppointment");
export const addMakeupSession = createCallable<{ sessionDate: string; block: "block_1" | "block_2" | "block_3"; note?: string }, { success: boolean; error?: string }>("addMakeupSession");
export const removeMakeupSession = createCallable<{ sessionId: string }, { success: boolean; error?: string }>("removeMakeupSession");

/**
 * Timetable/Admin callables
 */
export const addTimetableSlot = createCallable<{ lecturerId: string; unitCode: string; unitName: string; yearGroup: number; dayOfWeek: number; block: "block_1" | "block_2" | "block_3" }, { success: boolean; slotId?: string; error?: string }>("addTimetableSlot");
export const removeTimetableSlot = createCallable<{ slotId: string }, { success: boolean; error?: string }>("removeTimetableSlot");
export const addSemester = createCallable<{ name: string; startDate: string; examStartDate: string; endDate: string }, { success: boolean; semesterId?: string; error?: string }>("addSemester");
export const setActiveSemester = createCallable<{ semesterId: string }, { success: boolean; error?: string }>("setActiveSemester");
export const addExamSlot = createCallable<{ lecturerId: string; unitCode: string; examDate: string; block: "block_1" | "block_2" | "block_3"; venue: string; unitName?: string }, { success: boolean; slotId?: string; error?: string }>("addExamSlot");

/**
 * Admin callables
 */
export const getUsageSummary = createCallable<{}, { total: number; pending: number; accepted: number; declined: number; acceptance: number; responseHours: number }>("getUsageSummary");
export const addStaff = createCallable<{ email: string; role: "lecturer" | "dean" | "it_support" }, { success: boolean; error?: string }>("addStaff");
export const removeStaff = createCallable<{ staffId: string }, { success: boolean; error?: string }>("removeStaff");
export const getAllUsers = createCallable<{ role?: string }, { users: any[] }>("getAllUsers");
export const getLecturers = createCallable<{}, { lecturers: any[] }>("getLecturers");
export const addExamSlotAdmin = createCallable<{ lecturerId: string; unitCode: string; examDate: string; block: "block_1" | "block_2" | "block_3"; venue: string; unitName?: string }, { success: boolean; slotId?: string; error?: string }>("addExamSlot");

/**
 * Utility callables
 */
export const checkThrottle = createCallable<{ scope: string; identifier: string }, { allowed: boolean }>("checkThrottle");
export const isDemoAccount = createCallable<{ email: string }, { isDemo: boolean }>("isDemoAccount");
export const linkFirebaseUser = createCallable<{ email: string }, { success: boolean; profileId?: string; error?: string }>("linkFirebaseUser");

/**
 * Cleanup callables (admin only)
 */
export const manualCleanup = createCallable<{ type?: "throttle" | "notifications" | "errors" | "activity" | "all" }, { success: boolean; cleaned: number }>("manualCleanup");
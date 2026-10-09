/**
 * Firebase Integration Barrel Export
 * 
 * This is the main entry point for Firebase integration in the React app.
 * Replaces the old Supabase integration.
 */

// Client initialization
export { 
  firebaseApp, 
  firebaseAuth, 
  firebaseDb, 
  firebaseStorage, 
  firebaseFunctions,
  getFirebaseAuth,
  getFirestoreDb,
  getFirebaseFunctions,
  isFirebaseInitialized,
} from "./client";

// Auth hooks
export { useFirebaseAuth, useFirebaseReady } from "./hooks";

// Callable Cloud Functions
export {
  // Auth
  firebaseSignIn,
  firebaseSignUp,
  firebaseResetPassword,
  getProfile,
  updateProfile,
  checkDemoAccount,
  linkFirebaseUser,
  
  // Appointments
  bookAppointment,
  cancelAppointment,
  decideAppointment,
  addMakeupSession,
  removeMakeupSession,
  
  // Timetable/Admin
  addTimetableSlot,
  removeTimetableSlot,
  addSemester,
  setActiveSemester,
  addExamSlot,
  
  // Admin
  getUsageSummary,
  addStaff,
  removeStaff,
  getAllUsers,
  getLecturers,
  addExamSlotAdmin,
  
  // Utilities
  checkThrottle,
  isDemoAccount,
  linkFirebaseUser as linkFirebaseUserCallable,
  
  // Cleanup
  manualCleanup,
} from "./callable";

// Types
export type { User } from "firebase/auth";
export type { UserProfile } from "../../firebase/functions/src/auth";
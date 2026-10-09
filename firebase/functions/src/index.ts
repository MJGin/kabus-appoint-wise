import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

export * from "./auth";
export * from "./appointments";
export * from "./throttle";
export * from "./timetable";
export * from "./notifications";
export * from "./cleanup";
import { useState, useEffect, useCallback } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from "firebase/auth";
import { firebaseAuth, getFirebaseAuth, isFirebaseInitialized } from "./client";

/**
 * Custom hook for Firebase Authentication
 * Provides auth state, sign-in, sign-up, password reset, and sign-out
 */
export function useFirebaseAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseInitialized()) {
      setLoading(false);
      return;
    }

    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user };
    } catch (err: any) {
      const message = err.code
        ? err.code.replace("auth/", "").replace(/-/g, " ")
        : err.message || "Sign-in failed";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) {
        await updateProfile(user, { displayName });
      }
      return { success: true, user };
    } catch (err: any) {
      const message = err.code
        ? err.code.replace("auth/", "").replace(/-/g, " ")
        : err.message || "Sign-up failed";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (err: any) {
      const message = err.code
        ? err.code.replace("auth/", "").replace(/-/g, " ")
        : err.message || "Password reset failed";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setError(null);
    try {
      const auth = getFirebaseAuth();
      await signOut(auth);
      return { success: true };
    } catch (err: any) {
      const message = err.message || "Sign-out failed";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  return {
    user,
    loading,
    error,
    signIn,
    signUp,
    resetPassword,
    signOut: signOutUser,
    isAuthenticated: !!user,
    clearError: () => setError(null),
  };
}

/**
 * Hook for checking if Firebase is ready
 */
export function useFirebaseReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isFirebaseInitialized()) {
      setReady(true);
    } else {
      // Check periodically
      const interval = setInterval(() => {
        if (isFirebaseInitialized()) {
          setReady(true);
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  return ready;
}
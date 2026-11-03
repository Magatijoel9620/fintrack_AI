"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  reload,
  signOut,
  type User,
} from "firebase/auth";
import { auth, db, googleProvider, isFirebaseConfigured } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshEmailVerification: () => Promise<boolean>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const syncProfile = async (currentUser: User) => {
    if (!db) return;
    try {
      await setDoc(doc(db, "users", currentUser.uid), {
        uid: currentUser.uid,
        email: currentUser.email ?? null,
        displayName: currentUser.displayName ?? null,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      console.error("Could not sync own profile metadata", error instanceof Error ? error.message : "unknown");
    }
  };

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
      if (nextUser) void syncProfile(nextUser);
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    signIn: async (email, password) => {
      if (!auth) throw new Error("Firebase is not configured. Add Firebase environment variables.");
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      await syncProfile(result.user);
    },
    signUp: async (email, password) => {
      if (!auth) throw new Error("Firebase is not configured.");
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await syncProfile(result.user);
      try {
        await sendEmailVerification(result.user);
      } catch {
        throw new Error("Your account was created, but the verification email could not be sent. Use the resend verification option after signing in.");
      }
    },
    signInGoogle: async () => {
      if (!auth) throw new Error("Firebase is not configured.");
      const result = await signInWithPopup(auth, googleProvider);
      await syncProfile(result.user);
    },
    resetPassword: async (email) => {
      if (!auth) throw new Error("Firebase is not configured.");
      if (!email.trim()) throw new Error("Enter your account email address.");
      await sendPasswordResetEmail(auth, email.trim());
    },
    resendVerification: async () => {
      if (!auth?.currentUser) throw new Error("Sign in to resend your verification email.");
      if (auth.currentUser.emailVerified) return;
      await sendEmailVerification(auth.currentUser);
    },
    refreshEmailVerification: async () => {
      if (!auth?.currentUser) return false;
      await reload(auth.currentUser);
      const refreshed = auth.currentUser;
      setUser(refreshed);
      if (refreshed) await syncProfile(refreshed);
      return Boolean(refreshed?.emailVerified);
    },
    logout: async () => {
      if (auth) await signOut(auth);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

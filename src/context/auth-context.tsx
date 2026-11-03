"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  verifyBeforeUpdateEmail,
  reload,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth, db, googleProvider, isFirebaseConfigured } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

type AccountProfile = { phoneNumber: string };
type AccountProfileInput = { displayName: string; phoneNumber: string };
type AuthContextValue = {
  user: User | null;
  accountProfile: AccountProfile;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshEmailVerification: () => Promise<boolean>;
  updateAccountProfile: (profile: AccountProfileInput) => Promise<void>;
  requestEmailChange: (email: string) => Promise<void>;
  refreshAccountDetails: () => Promise<void>;
  logout: () => Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accountProfile, setAccountProfile] = useState<AccountProfile>({ phoneNumber: "" });
  const [loading, setLoading] = useState(true);

  const syncProfile = async (currentUser: User) => {
    if (!db) {
      setAccountProfile({ phoneNumber: "" });
      return;
    }
    try {
      const profileRef = doc(db, "users", currentUser.uid);
      const existing = await getDoc(profileRef);
      const savedPhone = typeof existing.data()?.phoneNumber === "string"
        ? String(existing.data()?.phoneNumber)
        : "";
      await setDoc(profileRef, {
        uid: currentUser.uid,
        email: currentUser.email ?? null,
        displayName: currentUser.displayName ?? null,
        phoneNumber: savedPhone,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setAccountProfile({ phoneNumber: savedPhone });
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
      else setAccountProfile({ phoneNumber: "" });
    });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    accountProfile,
    loading,
    signIn: async (email, password) => {
      if (!auth) throw new Error("Firebase is not configured. Add Firebase environment variables.");
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      await syncProfile(result.user);
      setUser(result.user);
    },
    signUp: async (email, password) => {
      if (!auth) throw new Error("Firebase is not configured.");
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await syncProfile(result.user);
      setUser(result.user);
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
      setUser(result.user);
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
    updateAccountProfile: async ({ displayName, phoneNumber }) => {
      const currentUser = auth?.currentUser;
      if (!currentUser) throw new Error("Your session has expired. Sign in again to update your profile.");
      const cleanName = displayName.trim();
      const cleanPhone = phoneNumber.trim();
      if (!cleanName) throw new Error("Enter your name before saving.");
      if (cleanName.length > 80) throw new Error("Your name must be 80 characters or fewer.");
      if (cleanPhone.length > 32) throw new Error("Your phone number must be 32 characters or fewer.");
      await updateProfile(currentUser, { displayName: cleanName });
      if (db) {
        await setDoc(doc(db, "users", currentUser.uid), {
          uid: currentUser.uid,
          email: currentUser.email ?? null,
          displayName: cleanName,
          phoneNumber: cleanPhone,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      setAccountProfile({ phoneNumber: cleanPhone });
      setUser(currentUser);
    },
    requestEmailChange: async (email) => {
      const currentUser = auth?.currentUser;
      if (!currentUser) throw new Error("Your session has expired. Sign in again to change your email.");
      const cleanEmail = email.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw new Error("Enter a valid new email address.");
      if (cleanEmail.toLowerCase() === currentUser.email?.toLowerCase()) throw new Error("That is already your current email address.");
      await verifyBeforeUpdateEmail(currentUser, cleanEmail);
    },
    refreshAccountDetails: async () => {
      if (!auth?.currentUser) throw new Error("Your session has expired. Sign in again.");
      await reload(auth.currentUser);
      const refreshed = auth.currentUser;
      setUser(refreshed);
      if (refreshed) await syncProfile(refreshed);
    },
    logout: async () => {
      if (auth) await signOut(auth);
    },
  }), [user, accountProfile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

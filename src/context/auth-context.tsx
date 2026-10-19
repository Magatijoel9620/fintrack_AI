"use client";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, createUserWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { auth, db, googleProvider, isFirebaseConfigured } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

type AuthContextValue = { user: User | null; loading: boolean; signIn: (email: string, password: string) => Promise<void>; signUp: (email: string, password: string) => Promise<void>; signInGoogle: () => Promise<void>; logout: () => Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null); const [loading, setLoading] = useState(true);
  const syncProfile = async (u: User) => {
    if (!db) return;
    try { await setDoc(doc(db, "users", u.uid), { uid: u.uid, email: u.email ?? null, displayName: u.displayName ?? null, updatedAt: serverTimestamp() }, { merge: true }); }
    catch (error) { console.error("Could not sync own profile metadata", error instanceof Error ? error.message : "unknown"); }
  };
  useEffect(() => {
    if (!isFirebaseConfigured || !auth) { setLoading(false); return; }
    return onAuthStateChanged(auth, u => { setUser(u); setLoading(false); if (u) void syncProfile(u); });
  }, []);
  const value = useMemo<AuthContextValue>(() => ({
    user, loading,
    signIn: async (email, password) => { if (!auth) throw new Error("Firebase is not configured. Add Firebase environment variables."); const result = await signInWithEmailAndPassword(auth, email, password); await syncProfile(result.user); },
    signUp: async (email, password) => { if (!auth) throw new Error("Firebase is not configured."); const result = await createUserWithEmailAndPassword(auth, email, password); await syncProfile(result.user); },
    signInGoogle: async () => { if (!auth) throw new Error("Firebase is not configured."); const result = await signInWithPopup(auth, googleProvider); await syncProfile(result.user); },
    logout: async () => { if (auth) await signOut(auth); },
  }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error("useAuth must be used inside AuthProvider"); return value; }

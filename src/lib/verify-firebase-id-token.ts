import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

export async function verifyFirebaseIdToken(idToken: string): Promise<string> {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("This service is temporarily unavailable.");
  const app = getApps().find((existing) => existing.name === "verified-ai-admin")
    ?? initializeApp({ credential: applicationDefault(), projectId }, "verified-ai-admin");
  try {
    const decoded = await getAuth(app).verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    throw new Error("Your session needs refreshing. Please sign in again.");
  }
}

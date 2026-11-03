import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdminApp } from '@/lib/firebase-admin';

export async function verifyFirebaseIdToken(idToken: string): Promise<string> {
  const app = getFirebaseAdminApp('verified-ai-admin');
  try {
    const decoded = await getAuth(app).verifyIdToken(idToken);
    return decoded.uid;
  } catch {
    throw new Error('Your session needs refreshing. Please sign in again.');
  }
}

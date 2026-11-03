import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
} from 'firebase-admin/app';

type ServiceAccountEnvironment = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function readServiceAccount(): ServiceAccountEnvironment | null {
  const raw = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  if (!raw?.trim()) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON is not valid JSON.');
  }

  if (typeof value !== 'object' || value === null) {
    throw new Error('FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON must contain a service-account object.');
  }

  const candidate = value as Record<string, unknown>;
  const projectId = candidate.project_id;
  const clientEmail = candidate.client_email;
  const privateKey = candidate.private_key;

  if (
    typeof projectId !== 'string' || !projectId.trim() ||
    typeof clientEmail !== 'string' || !clientEmail.trim() ||
    typeof privateKey !== 'string' || !privateKey.trim()
  ) {
    throw new Error('FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON is missing project_id, client_email or private_key.');
  }

  return { project_id: projectId, client_email: clientEmail, private_key: privateKey };
}

/**
 * Server-only Firebase Admin app factory. Supports ADC/workload identity and a
 * service-account JSON secret for hosts such as Vercel where no key file exists.
 */
export function getFirebaseAdminApp(name: string): App {
  const serviceAccount = readServiceAccount();
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    serviceAccount?.project_id ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error('Set FIREBASE_ADMIN_PROJECT_ID for the server-side Firebase Admin SDK.');
  }

  const existing = getApps().find((app) => app.name === name);
  if (existing) return existing;

  const credential = serviceAccount
    ? cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key.replace(/\\n/g, '\n'),
      })
    : applicationDefault();

  return initializeApp({ credential, projectId }, name);
}

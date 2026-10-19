import {
  applicationDefault,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const uid = process.argv[2];

if (!uid) {
  console.error(
    "Usage: node scripts/grant-platform-admin.mjs <0Br0JVCOrCZvd5oBUDVhvvDFUUK2>",
  );
  process.exit(1);
}

const projectId =
  process.env.FIREBASE_ADMIN_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!projectId) {
  throw new Error(
    "Set FIREBASE_ADMIN_PROJECT_ID to the intended Firebase project ID.",
  );
}

const app =
  getApps().find((existingApp) => existingApp.name === "[DEFAULT]") ??
  initializeApp({
    credential: applicationDefault(),
    projectId,
  });

const auth = getAuth(app);

// Verify the target account exists in the selected Firebase project.
const user = await auth.getUser(uid);

if (user.disabled) {
  throw new Error(
    "This Firebase Authentication account is disabled. No changes made.",
  );
}

console.log("Target Firebase project:", projectId);
console.log("Target account UID:", user.uid);
console.log("Target account email:", user.email ?? "(no email on account)");

// Preserve other custom claims while granting platform-admin access.
await auth.setCustomUserClaims(uid, {
  ...(user.customClaims ?? {}),
  platformAdmin: true,
});

// Read back the updated claims to verify the assignment.
const updatedUser = await auth.getUser(uid);

if (updatedUser.customClaims?.platformAdmin !== true) {
  throw new Error(
    "Verification failed: platformAdmin claim was not confirmed.",
  );
}

console.log("Verified: platformAdmin = true.");
console.log("Sign out and sign back in to refresh your ID token.");

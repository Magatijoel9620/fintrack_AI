# Firebase setup — Spark-compatible single-owner workspace

## Environment
Copy `.env.example` to `.env.local` and populate the Firebase Web SDK settings. Set `GOOGLE_GENAI_API_KEY` and Firebase Admin credentials only in the server environment used by the Next.js hosting platform. Never expose server credentials through `NEXT_PUBLIC_` variables.

## Authentication and business ownership
Enable Email/Password and/or Google in Firebase Authentication.

The current ownership model is deliberately simple:

- One Firebase Auth UID owns one business document at `businesses/{uid}`.
- The signed-in UID is the business ID and the only business owner.
- The app does not create, read, or depend on `members` documents, employee roles, invitations, or team memberships.
- Legacy member subcollections are left untouched; they are not used by this version.

## Firestore and subscription policy
The first authenticated session creates `businesses/{uid}` directly through the Firestore client. Firestore rules permit this one narrowly validated first-time create on Spark. The client cannot create a paid entitlement, reset a trial, change the subscription status, or delete the business document.

Business CRUD is permitted during the unexpired 21-day trial and while `subscription.status` is `active`. When the known `subscription.trialEndsAt` has passed and the subscription is not active, operational CRUD and budget changes are paused. Owners can still edit basic business identity/contact settings and submit subscription payment requests. Owners retain read access to their existing records, and `subscriptionPaymentRequests` remains writable so an owner can submit a payment reference and request reactivation. A missing or invalid legacy trial date is not treated as proof of expiry; review such records separately instead of silently locking them.

The current client performs inventory and financial writes directly through Firestore batches/transactions. `firestore.rules` enforces UID ownership, basic field validation, entitlement write gating, and append-only posted financial/stock history. This keeps ordinary business CRUD independent of Cloud Functions and compatible with Firestore's Spark plan.

Important integrity boundary: on Spark, calculations and multi-document transaction orchestration execute in the authenticated client. The app recalculates totals and atomically writes stock/product changes with sale, purchase, and movement records, but a modified owner-controlled client can attempt to submit fabricated amounts or inconsistent related writes. Firestore rules validate document shapes and protect ownership/immutability; they are not a replacement for a trusted server-side accounting engine. Do not describe this mode as server-authoritative financial processing.

Publish `firestore.rules` only after reviewing the current deployed schema and running the Firestore Emulator suite. Do not deploy old role-based rules or the previous callable-only rules with this client.

## Cloud Functions
Cloud Functions are **not required** for workspace provisioning or normal product, contact, stock, sale, purchase, payment, or expense CRUD. The current `firebase.json` intentionally has no Functions deployment target. The historical `functions/` source folder is retained for reference/future optional backend work; do not deploy it as a prerequisite for this Spark-compatible client.

Platform aggregate metrics still require a trusted backend process (for example, an optional scheduled Cloud Function or Cloud Run job). If that service is not deployed, the platform metrics dashboard may not refresh; normal business CRUD must continue to work independently.

## Platform admin
Grant the `platformAdmin: true` custom claim from a trusted Admin SDK environment only. Never let the client write custom claims. Platform metric/audit/settings documents are read-only to clients and restricted to the trusted platform-admin claim.

## Existing data and rollout
No data migration is included in this recovery. Existing business, product, contact, transaction, expense and subscription documents are not deleted or rewritten. Existing business documents must have a path/`id`/`ownerId` matching the authenticated UID to be used by the single-owner app. Records with mismatched ownership must be backed up and reviewed individually; do not automatically rewrite owner IDs or move tenant data.

Run the checks in `docs/FINAI_SPARK_CRUD_RECOVERY.md` before deploying. Back up/export production Firestore first, then deploy only the reviewed Firestore rules and matching frontend. No Functions deployment is needed for this rollout.

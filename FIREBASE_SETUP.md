# Firebase setup — Beta 6

## Environment
Copy `.env.example` to `.env.local` and populate the Firebase Web SDK settings. Set `GOOGLE_GENAI_API_KEY` only in the server environment.

## Authentication
Enable Email/Password and/or Google in Firebase Authentication. Demo mode is removed.

## Firestore
Publish `firestore.rules` only after testing in a staging project. The first authenticated business creates:
- `businesses/{uid}` with owner metadata and a 21-day trial entitlement
- `businesses/{uid}/members/{uid}` with owner role

The signed-in user can read only the business document whose ID matches their UID during initialization. This bootstrap read allows the client to distinguish a new business from an existing legacy record; the client still verifies that `ownerId` matches the signed-in user before proceeding. Publish the updated rules to the Firebase project configured for the app after staging verification.

Operational writes require an owner/manager/cashier/stock-clerk permission appropriate to the collection and an active subscription or unexpired trial. Reads remain available to business members after trial expiry so the owner can review/export existing data.

## Platform admin
Grant the `platformAdmin: true` custom claim from a trusted Admin SDK environment only. Never let the client write custom claims. The dashboard reads only:
- `platformMetrics/overview`
- approved aggregate-only `platformAudit` / `platformSettings` documents

No tenant documents are queried by the platform dashboard. Populate aggregate metrics using a trusted scheduled backend job; never include emails, names, invoices, payment details or product-level records in those aggregates.

## Existing data migration
Before publishing the stricter rules for an existing project, backfill `subscription` on each existing business and verify every owner has a matching members document. A missing/expired subscription intentionally blocks operational writes. Test role cases in Firebase Emulator Suite before production.

> **Superseded on 3 November 2026:** This note describes the intermediate callable-Functions implementation that caused normal CRUD to depend on Blaze. It is retained as historical context only. The current Spark-compatible architecture and verified commands are documented in [FINAI_SPARK_CRUD_RECOVERY.md](FINAI_SPARK_CRUD_RECOVERY.md). Do not follow the callable deployment/rollout steps below for the current client.

# FinAI implementation notes — 2 November 2026

## Product and authorization model

FinAI is a single-owner workspace: **one Firebase Auth UID owns one business document at `businesses/{uid}`**. There are no member documents, team invitations, business roles, manager/cashier/stock-clerk permissions, or membership-based authorization. The signed-in Firebase UID is the business ID. `platformAdmin` remains a separate trusted Firebase custom claim used only for platform-level aggregate views and is not a business-user role.

The client calls `ensureBusinessProvisioned` after authentication. The function creates a 21-day KES trial only if `businesses/{uid}` does not exist. It never resets an existing subscription or overwrites an existing business. Existing records with a mismatched `id` or `ownerId` are rejected rather than silently migrated.

## Trusted financial and inventory writes

The following cloud mutations now use callable Firebase Functions in `europe-west1`:

- `createProduct`, `updateProduct`, `deleteProduct`, and `adjustStock`;
- `recordSale` and `recordPurchase`;
- `recordAccountPayment`;
- `ensureBusinessProvisioned`.

The callable handlers verify the authenticated UID, confirm that `businesses/{uid}` is owned by that UID, and require an active/trialing subscription for business mutations. Financial and inventory write paths use Firestore transactions. Client Firestore rules permit reading a user's own business data but deny direct client writes to product records, stock-movement records, posted sales, purchases, and payments.

Sales and purchases recalculate their totals from stored product records and validated quantities. A sale snapshots unit selling price and unit cost (COGS) from product records read in the sale transaction. Purchases update stock and product `costPrice` in the same transaction. Payments are append-only and cannot exceed the calculated open balance for their customer or supplier. A party-record timestamp is updated within the payment transaction to serialize concurrent allocations against the same party balance.

### Purchase costing policy

The existing product `costPrice` behavior is preserved as **latest-purchase unit cost**, not weighted average or FIFO. A purchase records the entered supplier invoice unit cost; the product's current `costPrice` becomes the latest unit cost. Every new sale snapshots that stored cost inside the sale transaction. Historical sale lines are not rewritten. A change to weighted-average or FIFO costing would require a separately designed accounting migration and is not included here.

## Authentication

Email/password registration sends a Firebase verification email. The workspace displays a verification reminder with resend and refresh actions; verification is a soft gate in this implementation, not a hard lockout. Password recovery uses Firebase's password-reset email flow. Google sign-in remains available and is not blocked by the email/password verification reminder.

## Storage

Business-logo uploads are limited to the authenticated owner, PNG/JPEG/WebP, and 2 MiB. SVG is not accepted. The Storage rule path uses the business UID.

## Local verification commands

From the repository root:

```bash
npm ci
npm test
npm run typecheck
npm run build
```

For Cloud Functions:

```bash
cd functions
npm ci
npm run build
```

The Functions compiler emits `functions/lib/` from the checked-in `functions/src/` sources. `functions/lib/` is generated output and is not part of the source archive.

Firebase Emulator ports are configured in `firebase.json`: Auth 9099, Functions 5001, Firestore 8080, and Storage 9199. Emulator rule tests and live Firebase tests still need to be added/run in an environment with Firebase CLI, the rules test harness and emulator binaries installed.

## Safe rollout order

Do not deploy only the new rules or only the new client. The updated client expects the callable functions, and the updated rules deny direct client writes to the protected paths.

1. Back up/export the production Firestore data and record the currently deployed rules/functions revisions.
2. Install dependencies and build Functions from the supplied source; resolve any environment-specific build issue before deployment.
3. Deploy the new callable Functions first and verify their logs in a staging Firebase project.
4. Deploy Firestore and Storage rules after the Functions are available.
5. Deploy the matching Next.js client only after the backend and rules are ready.
6. Test a new account and an existing owner account: provisioning, profile read/update, product create/edit/archive, opening stock, stock adjustments, sale, purchase, account payment, reports, AI, password recovery and logo upload.
7. Monitor Functions errors and data reconciliation before any production-wide rollout.

No production deployment, live Firestore mutation, or migration has been performed by this implementation task.

## Legacy data and migration cautions

- Existing business documents, transaction documents, products, contacts and historical stock movements are not migrated or deleted by these patches.
- Existing legacy membership subcollections are left untouched in Firestore. The application no longer reads or creates them; the new security rules do not grant membership-based access.
- A business document whose ID/`id`/`ownerId` does not agree with the authenticated UID is refused by provisioning and callable operations. Inspect and back up such records before designing a one-off migration.
- Existing malformed financial history is not silently rewritten. New payments validate the historical records they use and can refuse an allocation if corrupt amounts are encountered.
- The current payment model allocates receipts/payments at customer/supplier aggregate level. It does not persist invoice-by-invoice allocation links.

## Remaining verification and product work

This implementation does not claim that the entire approved UI/SaaS scope is complete. The app already contained its core dashboard charts, responsive navigation, POS, inventory, invoices, accounting and AI screens. The changes add the command palette/global search, stronger sale/purchase validation, authentication recovery/verification and server-authoritative write paths. Dedicated notification centre, all requested report/export refinements, comprehensive table filtering/pagination, full PWA/offline refinements, and complete visual regression work remain separate phases.

The full root Next.js typecheck/production build, Firestore/Storage Emulator security suite, staging Firebase integration, scheduled metrics runtime verification, and live production checks are still required. See the generated implementation report for this run's exact verification outcomes.

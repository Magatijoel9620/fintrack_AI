# FinAI Full Source Audit Report
**Audit target:** `fintrack_AI` source archive supplied as `finai_audit.zip`  
**Audit date:** 2 November 2026  
**Scope:** Static source review of Next.js application, Firebase client/auth, Firestore and Storage rules, inventory/finance contexts, AI flows, Firebase Functions, tests and deployment configuration.

## Executive summary

The archive contains a substantial FinAI application, not a blank MVP. The source includes inventory, sales, purchasing, customer/supplier records, finance/expense views, AI flows, subscription UI, a platform-admin dashboard, and a scheduled aggregate-metrics function.

The existing test suite runs successfully: **4 passed, 0 failed**. Those tests cover only trial-date policy. A complete TypeScript check, Next.js production build, Cloud Functions build, Firebase Emulator rules test, and live Firebase integration test could not be completed from this archive/environment.

**Release recommendation: do not treat this archive as production-audited or deploy its rules/functions as a complete production release yet.** Several important workflow/security/accounting gaps are visible in source.

## Findings by severity

### Critical — cashier sale workflow is incompatible with Firestore rules

**Evidence**
- `src/context/inventory-context.tsx`: `recordSale()` performs one Firestore transaction that updates product documents, creates a sale, and creates stock-movement documents.
- `firestore.rules`: product updates and stock movement writes require `inventoryEditor()` (`owner`, `manager`, `stock_clerk`).
- `firestore.rules`: sale creation requires `transactionClerk()` (`owner`, `manager`, `cashier`).

**Impact**
A cashier is allowed to create a sale but is not allowed to perform the product quantity updates or stock-movement writes required by that same transaction. Firestore rejects the entire atomic transaction. The UI can therefore offer a cashier a sale workflow that predictably fails with permission denied.

**Recommended repair**
Move sale creation/stock deduction/stock-movement creation into a trusted callable/HTTPS backend operation that verifies the Firebase ID token, checks business membership and role, validates all item/product/price/stock data, and commits the transaction using Admin SDK. Alternatively, design narrowly constrained rules and prove them with Emulator tests. Do not broadly grant cashiers product-edit access.

### High — inventory assistant authorization is owner-only and not membership-aware

**Evidence**
- `src/ai/flows/inventory-assistant.ts` verifies the Firebase ID token and then requires `decoded.uid === parsed.businessId`.
- Current client workspace convention sets `businessId` to the signed-in owner's UID.
- Team membership is represented separately under `businesses/{businessId}/members/{uid}`.

**Impact**
A legitimate manager/cashier/stock-clerk whose UID differs from the business owner/business ID cannot use the inventory assistant. The endpoint does not consult the membership document or role, so its authorization model does not match the application's team model.

**Recommended repair**
Use a trusted Admin SDK lookup of the business and member document. Check the member's role against an explicit AI-access policy. Do not trust the caller-supplied business ID without confirming membership. Keep the input summary bounded and avoid returning unrelated tenant data.

### High — client-side financial and transaction validation is not an authoritative integrity boundary

**Evidence**
- `src/context/inventory-context.tsx`: `recordSale()` validates basic non-negative values and item quantity/price, but accepts client-supplied subtotal, discount, tax, total and amountPaid without recomputing and reconciling the complete invoice.
- `recordPurchase()` similarly accepts client-supplied totals and amountPaid after basic non-negative checks.
- `recordAccountPayment()` checks `input.amount <= 0` but does not explicitly reject `NaN` or `Infinity`, verify party existence/type, or constrain payment to an outstanding balance.
- `firestore.rules` primarily checks membership, role and subscription; it does not comprehensively validate document fields and arithmetic invariants.

**Impact**
The UI validation can be bypassed by a modified client or direct Firestore SDK calls. Incorrect totals, payment amounts, or accounting records may be persisted by an otherwise authorized user. This is a data-integrity issue even where tenant access control works.

**Recommended repair**
Put sale, purchase, payment and stock mutation behind trusted server operations. Recalculate totals server-side from validated line items and stored product data. Validate finite amounts, currency precision, amount-paid bounds, customer/supplier existence, and idempotency. Add Emulator tests for malformed and unauthorized writes.

### High — payment and stock movement records are mutable by broad roles

**Evidence**
- `firestore.rules`: `stockMovements` allows inventory editors to create, update and delete records.
- `firestore.rules`: `payments` allows managers to update and delete payment records.

**Impact**
These collections act as operational/accounting audit trails, but the rules permit historical entries to be rewritten or removed by client operations. This weakens traceability and makes reconciliation harder.

**Recommended repair**
Make posted stock movements and payments append-only from clients. Correct mistakes using reversal/adjustment entries with actor, timestamp, reason and reference. Reserve exceptional corrections for trusted audited backend operations.

### High — expense and budget controls are not consistently role-aware in the UI

**Evidence**
- `src/context/app-context.tsx` exposes add/update/delete expense and budget operations without checking the member role.
- `firestore.rules` restricts expenses to managers/owners and business-document updates (including `monthlyBudget`) to the owner.

**Impact**
A cashier/viewer or manager may see controls that fail when used because the rules deny the operation. The business budget update is owner-only even though the UI context does not express that restriction.

**Recommended repair**
Load and expose the verified membership role in a shared authorization context. Hide/disable actions the role cannot perform, while retaining Firestore/server authorization as the actual security boundary. Define whether managers should be allowed to edit monthly budgets.

### High — financial advisor and spending analysis use client-submitted financial summaries

**Evidence**
- `src/ai/flows/ask-financial-advisor.ts` verifies an ID token but sends the caller-provided expenses and history to the model.
- `src/ai/flows/analyze-spending-habits.ts` verifies an ID token but analyzes the caller-provided expense JSON.
- These flows do not fetch the caller's records from Firestore or verify a business membership before using the supplied data.

**Impact**
The AI can analyze fabricated, stale, or unrelated data and present it as personalized business context. This is not by itself a cross-tenant database read, but it is a reliability and trust boundary weakness.

**Recommended repair**
Prefer server-side retrieval of the authenticated user's authorized business records, or clearly treat client-supplied data as unverified user input. Validate JSON shape, amount/date ranges, record count and ownership. Make AI outputs advisory and never authoritative accounting entries.

### Medium — no email verification or password recovery flow is present

**Evidence**
- `src/context/auth-context.tsx` exposes sign-in, sign-up, Google sign-in and logout only.
- `src/components/login.tsx` has no email verification, password reset or resend-verification UI.

**Impact**
Email/password accounts can register and proceed without a verified email address; users have no in-app password recovery route.

**Recommended repair**
Add Firebase `sendEmailVerification`, `sendPasswordResetEmail`, and verification-state handling. Define whether unverified email users may access the workspace. Do not block Google sign-in on email verification without considering Firebase provider behavior.

### Medium — subscription trial creation is client-initiated and paid billing is not implemented

**Evidence**
- `src/context/inventory-context.tsx` creates a 21-day trial from the client when the business document is missing.
- `firestore.rules` checks trial end time and status for operational writes.
- Project notes state checkout/renewal is not implemented and plan cards are intentionally non-operational.

**Impact**
A fresh Firebase account can initialize a new trial. Paid subscription status cannot be assumed to represent a verified payment unless a trusted billing workflow updates it. Existing legacy business records without subscription/member data require a controlled migration.

**Recommended repair**
Provision trials from a trusted backend or trusted auth-triggered function with idempotency. Keep paid entitlements server-controlled and integrate a verified payment provider before representing a plan as paid. Backfill legacy records with a reviewed, reversible migration.

### Medium — storage logo rules are tied to business ID equalling owner UID

**Evidence**
- `storage.rules` allows upload only when `request.auth.uid == businessId`.
- Current workspace convention uses owner UID as business ID.

**Impact**
This works for the current owner-ID business model but will prevent a future manager/team member from uploading a logo, and it couples storage authorization to the current ID convention.

**Recommended repair**
If team logo management is required, use a trusted role-aware Storage rule design or a backend upload authorization flow. Keep file size and content-type restrictions. Consider disallowing SVG if uploaded SVGs are not sanitized/required.

### Medium — purchase cost updates use the latest purchase unit cost, not weighted average

**Evidence**
- `src/context/inventory-context.tsx`: `recordPurchase()` updates product `costPrice` to the latest purchase item's `unitCost`.
- `saleCOGS()` uses the cost stored on each sale item, falling back to current product cost for legacy sales.

**Impact**
This is a valid latest-cost policy if intentional, but it is not weighted-average costing. Historical sale COGS can also be based on the client-side product snapshot used to build the sale, while the transaction re-reads stock but does not re-read and snapshot the current cost price. Concurrent product-cost changes can therefore create inconsistent COGS snapshots.

**Recommended repair**
Choose and document a costing policy (latest cost, weighted average, FIFO). For sales, read authoritative product cost inside the same trusted transaction that validates stock and creates the sale. Preserve immutable unit cost snapshots on sale lines.

### Medium — platform metrics function needs deployment and operational verification

**Evidence**
- `functions/src/index.ts` uses scheduled hourly collection-group count queries and writes `platformMetrics/overview`.
- `firestore.rules` makes platform metric documents read-only to clients and restricts reads to the `platformAdmin` custom claim.

**Impact**
The design limits admin UI to aggregates, which is good, but production operation depends on scheduler/billing/API setup, collection-group count support/indexes, correct custom claims and successful function deployment. None of those were verified in this audit.

**Recommended repair**
Build and deploy in staging, verify function logs and metric freshness, test custom-claim access, and confirm that no tenant identifiers or personal data are added to aggregate documents.

## Positive controls observed

- The root layout mounts `AuthProvider`, `InventoryProvider` and `AppProvider`.
- Cloud inventory is intended to use Firestore as its source of truth.
- Account changes clear in-memory inventory state before loading the next workspace.
- Product edits use a Firestore transaction and create a stock adjustment movement when quantity changes.
- Product records with transaction history are archived instead of deleted.
- Sale and purchase stock changes are grouped with their corresponding transaction and stock-movement writes in Firestore transactions.
- The AI endpoints reviewed verify Firebase ID tokens before model execution.
- The inventory assistant prompt explicitly treats supplied data as untrusted facts, not instructions.
- Firebase Admin credentials and Gemini keys are not exposed as `NEXT_PUBLIC_` variables in the reviewed source.
- Platform metrics are generated server-side and Firestore rules make those documents read-only to clients.
- `.env.example` is intended for placeholders rather than live credentials (still verify before publishing).

## Verification results

| Check | Result |
|---|---|
| `node --test tests/*.test.mjs` | **PASS** — 4 tests |
| Test coverage | **Limited** — subscription date policy only |
| Root `npm run typecheck` | **Not run successfully** — root dependencies are not installed in this audit workspace |
| Root `npm run build` | **Not verified** — root dependencies are not installed |
| `functions` build | **Failed to start** — bundled `functions/node_modules/.bin/tsc` points to a missing `../lib/tsc.js` |
| Firestore Emulator rules tests | **Not present / not run** |
| Storage Emulator rules tests | **Not present / not run** |
| Live Firebase integration | **Not run** |
| Production Vercel deployment | **Not run** |
| Production secrets and IAM | **Not verified** |

The uploaded archive includes generated `.next-dev` build/cache output and a large `functions/node_modules` tree. These artifacts make the archive unnecessarily large and can make the source snapshot harder to reason about. Exclude generated caches and dependency folders from future audit ZIPs.

## Recommended remediation order

1. Implement a trusted atomic sale endpoint and resolve cashier/stock permissions.
2. Move payment, purchase and other financial mutations behind validated trusted operations; make audit records append-only.
3. Correct AI authorization to use verified business membership and server-sourced or explicitly untrusted summaries.
4. Add role-aware UI controls for expenses, budget and team features.
5. Add email verification and password recovery.
6. Provision trials and paid entitlements through trusted backend logic; plan a legacy-data migration.
7. Define inventory costing policy and snapshot authoritative unit cost during sale transactions.
8. Add Firestore/Storage Emulator tests and broader unit/integration tests.
9. Install from lockfiles and run root typecheck/build plus Functions build.
10. Deploy to staging, test full user journeys, then plan production rollout and rollback.

## Deployment safety

Do not deploy a new `firestore.rules` file as a quick fix for cashier errors. The current rules contain important tenant and role restrictions. Do not enable billing claims or alter legacy business records manually without a backup and migration plan. Do not deploy the Cloud Function until its build succeeds and the required Google Cloud scheduler/billing setup is confirmed.

**Audit limitation:** This is a source-level audit of the supplied ZIP. It does not establish that the currently deployed FinAI site has the same source revision, nor does it prove live Firebase behavior.

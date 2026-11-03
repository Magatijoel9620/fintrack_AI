# FinAI Spark-compatible CRUD recovery — 3 November 2026

## Objective

Restore normal business operations without requiring Firebase Cloud Functions or a Blaze upgrade. The recovery keeps the one-user/one-business architecture and limits subscription restrictions to a known elapsed trial without an active paid subscription.

## Current architecture

- Firebase Authentication remains the identity provider.
- One Auth UID owns one business document: `businesses/{uid}`.
- First workspace provisioning is a direct Firestore transaction. It creates a 21-day KES trial only when the document does not exist, and refuses to overwrite an existing record whose `id` or `ownerId` does not match the UID.
- Products, contacts, stock, sales, purchases, account payments, expenses and business profile data use the Firestore client SDK; stock/sale/purchase updates use Firestore batches or transactions where related records must be committed together.
- There are no application member roles, invitations, owner membership documents or team authorization checks.
- The frontend no longer imports the Firebase Functions SDK or Functions-side financial-integrity helper code for ordinary CRUD.
- `firebase.json` contains Firestore and Storage rule targets and Auth/Firestore/Storage emulator ports. It deliberately has no Functions deployment target.

## Subscription rule

| Business state | Reads | Business writes | Subscription payment request |
|---|---|---|---|
| Trial date is in the future | Allowed | Allowed | Allowed |
| Trial date has elapsed; no active paid plan | Allowed | Profile settings allowed; operational CRUD and budget paused | Allowed |
| `subscription.status == active` | Allowed | Allowed | Allowed |
| Legacy record has no usable trial date | Allowed | Not automatically blocked | Allowed |

The Firestore rules enforce this policy server-side for client requests. The UI helper mirrors it for clearer error messages. Subscription fields are immutable to ordinary clients; payment references do not automatically activate a paid plan.

## Recovered Firestore operations

- Business provisioning: direct `runTransaction` create at `businesses/{uid}`.
- Products: direct batch create; transactional edit; stock changes create append-only movement entries; delete action archives products to preserve history.
- Manual stock movement: transactional product quantity update + append-only movement.
- Sales: transactional product stock deduction + append-only sale + movement records. Unit selling price and unit cost are read from current product documents and totals are recalculated locally before commit. Duplicate product lines are rejected in both cloud and local storage modes.
- Purchases: transactional stock addition + latest-purchase cost update + append-only purchase and movement records. Duplicate product lines are rejected for both sales and purchases so stock is not recalculated twice from one stale starting balance.
- Account payments: sales/purchases and payments are queried before the transaction because the Firebase Web SDK does not support query reads inside `runTransaction`. The transaction then checks the party `accountRevision` and appends the payment while incrementing that revision. Linked sales and purchases increment the same party revision in their own ledger transaction, so concurrent operations from this client are detected and the user is asked to refresh/retry rather than applying a stale balance. This coordination is an application-level safeguard, not a server-authoritative accounting boundary.
- Contacts, expenses, budget and business profile: direct owner-scoped Firestore writes with client validation and Firestore rules.
- Posted sales, purchases, payments and stock movements cannot be updated or deleted by client rules. Products with history are archived rather than physically deleted.

## Important financial-integrity limitation

This recovery intentionally avoids a paid server dependency. Client-side totals are recomputed from Firestore product data and multi-document operations use Firestore transactions, but this is not equivalent to a trusted Admin SDK endpoint. A technically capable owner controlling a modified client can attempt to submit fabricated amounts or inconsistent related writes. The rules validate ownership, entitlement, document shape/ranges and append-only behavior, but they cannot robustly enforce arbitrary invoice arithmetic and 100-line stock-ledger relationships within Firestore Rules access-call limits. The app must therefore not claim server-authoritative accounting in Spark mode. A future trusted backend can strengthen this boundary without changing the normal user experience.

## Verification status

### Stage 1 — source recovery

- [x] Remove mandatory callable provisioning from the client.
- [x] Restore direct Firestore first-workspace provisioning.
- [x] Restore direct Firestore product, stock, sale, purchase and account-payment paths.
- [x] Remove frontend imports of `firebase/functions` and `functions/src/financial-integrity`.
- [x] Keep the single-owner UID path and immutable subscription contract.
- [x] Add client and Firestore-rule trial-expiry write gating while retaining reads and subscription payment requests.
- [x] Configure default Node tests separately from emulator tests.

### Stage 2 — security regression (local results supplied 3 November 2026)

- [x] Financial-integrity and subscription-policy unit tests: **23 passed, 0 failed**.
- [x] Auth + Firestore Emulator regression suite: **8 passed, 0 failed**. Coverage includes direct owner provisioning, no client-minted paid entitlement, immutable subscription fields, cross-owner isolation, mismatched legacy business protection, expired-trial reads/profile access/payment requests, paid-active access after trial end, and append-only sales/purchases/payments/stock movements.
- [x] Emulator suite used the disposable `demo-finai` project ID. It did not deploy rules or Functions to `fintrack-ai-d0120`.
- [x] Confirmed production rules and Functions were **not deployed**. This is intentional during Stage 2; Functions are not a dependency of this recovery.
- [ ] Root TypeScript/build verification: the first `npm run typecheck` reported 14 errors in `src/context/inventory-context.tsx`. The main causes were nullable Firestore narrowing inside callbacks, a widened `referenceType` string, and unsupported `Transaction.get(Query)` calls in the payment flow. A follow-up source patch fixes those reported causes by capturing a non-null Firestore instance, explicitly typing movement records, and moving query reads outside the Web SDK transaction with per-party `accountRevision` conflict detection. Re-run `npm run typecheck` and `npm run build` against this patch before Stage 3.

The production Next.js build compiled its bundles but was stopped by TypeScript validation. The corrected follow-up patch has not yet been compiled in this environment because root dependency installation timed out. Do not treat Stage 2 as fully complete until typecheck and build pass on the updated source.

### Stage 3 — deployment and live verification

Not performed. No production Firestore rules, Vercel frontend, business documents, or subscription records were changed by this recovery task.

## Commands

From the project root:

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run test:emulator
```

The emulator test command uses a disposable demo project ID (`demo-finai`) and starts Auth + Firestore emulators; it does not contact or mutate the production Firebase project.

After all checks pass, back up the production Firestore database and review existing owner records. Deploy only the Firestore rules:

```bash
npx --yes firebase-tools@latest deploy \
  --only firestore:rules \
  --project fintrack-ai-d0120
```

Then deploy the matching Next.js frontend through its normal hosting pipeline. Do not run `firebase deploy --only functions` for this recovery. Cloud Functions are not part of the normal CRUD dependency graph.

## Data preservation and rollback

- No production data was read or mutated by this source recovery.
- No business IDs, owner IDs, subscriptions, trial dates, or historical records were migrated.
- Do not run a destructive migration or bulk rewrite as part of deployment.
- Before production rollout, export Firestore and record the currently deployed rules revision.
- If the new rules reject a legitimate legacy document, inspect the exact record and add a narrow backwards-compatible validation only after verifying the owner path. Do not open broad authenticated writes as a workaround.

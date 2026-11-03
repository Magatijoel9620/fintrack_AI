> **Superseded on 3 November 2026:** This note documents the intermediate Cloud Functions-dependent patch. It is historical only. The current recovery removes the callable requirement from normal CRUD; see [docs/FINAI_SPARK_CRUD_RECOVERY.md](docs/FINAI_SPARK_CRUD_RECOVERY.md). Do not deploy the previous callable-only rules/client combination.

# FinAI build-error patch

## Changes
- Restored `src/lib/firebase.ts` (it was absent from the prior implementation archive) and exported Firebase Functions in `europe-west1`, matching `functions/src/index.ts`.
- Added the missing `recordSale` and `recordPurchase` inventory-context callbacks. Both invoke the trusted callable Functions and generate idempotency document IDs; they do not write financial totals from the browser.
- Changed POS sale/purchase payload types and item mapping to omit client-supplied transaction totals. The callable Functions calculate authoritative totals from stored product prices/costs and validated quantities.
- Restored the other original `src/lib` files from the audit source archive because the previous implementation archive omitted that directory.

## Verification
- `node --test tests/*.test.mjs`: 18 passed, 0 failed.
- Root TypeScript check and Next.js production build: not verified in this packaging environment. `npm ci` did not complete before the environment timeout, leaving incomplete `node_modules` type packages. Re-run `npm ci`, `npm run typecheck`, and `npm run build` in the user's project environment.
- No Firebase deployment was performed.

## Apply
Compare this archive with the current working tree before copying. Preserve `.env.local`, local credentials, and unrelated branch changes. Do not deploy Firestore rules before the matching Functions are deployed.


## Stage 2 TypeScript follow-up — 3 November 2026

- Capture the configured Firestore instance in a local `firestore` constant before entering transaction callbacks; this preserves TypeScript null narrowing.
- Explicitly type sale and purchase stock movement arrays as `StockMovement[]` so literal `referenceType` values do not widen to `string`.
- Replace unsupported `Transaction.get(Query)` calls. Firestore Web SDK transactions read document references, not query objects. Account history queries now run before the transaction; an `accountRevision` on the linked customer/supplier is checked and incremented in the transaction. Sales and purchases increment the same revision in their own transaction, detecting concurrent account changes from this app.
- This revision check is a client workflow coordination safeguard, not a substitute for trusted server enforcement against a modified client.
- Re-run `npm run typecheck` and `npm run build`; the follow-up has not yet been compiled in the recovery environment.

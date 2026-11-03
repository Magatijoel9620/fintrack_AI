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

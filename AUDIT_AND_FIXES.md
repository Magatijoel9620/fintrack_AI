# FinAI CRUD and persistence hardening pass

## Confirmed defects addressed

- `AppProvider` was implemented but never mounted in the application tree. Expense and budget screens were therefore using the context's no-op defaults instead of a real provider.
- Expenses were explicitly in-memory only; add/edit/delete did not persist to Firestore and data disappeared after refresh.
- Monthly budget was in-memory only and reset on reload.
- Firestore had no `/businesses/{businessId}/expenses/{id}` rule, so cloud expense CRUD would have been denied even after wiring up persistence.
- Inventory wrote local fallback data but did not restore it on reload.
- Switching accounts could briefly retain prior account records in provider state.
- Product creation/editing accepted empty identity fields, invalid/negative numbers, and duplicate SKUs/barcodes at the UI/context level.
- Product deletion could break historical invoice, purchase and stock movement references. Products with history are now archived (`isActive: false`) instead of hard-deleted.
- Product stock edits previously wrote a stale full product record and generated a stock movement from stale in-memory quantity. Cloud stock edits now use a Firestore transaction and derive the adjustment from the current persisted quantity.
- Sale/purchase writes now reject invalid quantities and invalid totals before touching stock or records.
- Product form, expense form, budget and settings surfaces now display save failures rather than silently closing or swallowing errors. Settings validates email and saves profile/currency together.

## Persistence model after this pass

- Cloud mode: Firestore is authoritative; expenses live under `businesses/{uid}/expenses`, monthly budget is `businesses/{uid}.monthlyBudget`, and currency is the business profile currency.
- Local fallback: inventory and finance state are stored per workspace key and restored on load. Local fallback is browser-local only and is not a cross-device sync mechanism.
- Existing stock, sales and purchase mutations continue to use the inventory context. Product stock edits create a matching stock movement in the same transaction.

## Validation and limitations

- `npm test` passes (4 existing subscription policy tests).
- Changed TypeScript/TSX files pass TypeScript transpilation syntax checks.
- A full `npm run typecheck` / production build could not be completed because dependency installation did not finish in this environment. Run `npm ci`, `npm run typecheck`, `npm test`, and `npm run build` before deployment.
- Firestore rules need to be deployed (`firebase deploy --only firestore:rules`) before cloud expense CRUD can work. Confirm rule behavior against the real project's role setup before release.
- This pass does not claim a live Firebase integration test; it uses source-level checks only.

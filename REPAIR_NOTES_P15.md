# FinTrack AI P15 repair notes

## Applied in this source patch

1. **Non-destructive workspace initialization** (`src/context/inventory-context.tsx`)
   - Creates a business and 21-day trial only when the business document is absent.
   - Preserves existing business name, currency, profile fields, and subscription.
   - Creates the owner membership only when it is missing; it never rewrites an existing owner membership.
   - Does not attempt a client-side subscription migration for legacy records without subscription data.
   - Identifies the failed initialization stage and gives permission-denied-specific sync feedback.
   - Reports snapshot-listener failures to the user and console without showing raw backend messages.
   - Skips tenant workspace initialization on `/platform-admin`.

2. **Stock audit trail**
   - Editing a product's quantity now writes a matching `adjustment` stock movement in the same Firestore batch (and local state), rather than silently changing quantity.

3. **AI action protection**
   - Added `verifyFirebaseIdToken` helper and required a valid Firebase ID token for receipt scanning, invoice scanning, and spending analysis.
   - Financial-advisor action now verifies Firebase ID tokens, validates input sizes and conversation length, and excludes the token from the prompt.
   - Receipt scanning client now passes the signed-in user's token.
   - Inventory assistant already had token verification; that protection is retained.

4. **Platform admin**
   - The platform-admin route no longer triggers tenant workspace provisioning through the global inventory provider.
   - Replaced the unpopulated `Errors (24h)` card with suspended-business count, which the scheduled aggregate job already writes.
   - Metrics listener displays a generic diagnostic rather than exposing raw Firestore error text.

5. **Deployment scaffolding**
   - Added `.env.example` with placeholders only.
   - Added `firebase.json` for Firestore rules and the separate `functions/` build/deploy workflow.
   - Added `.firebaserc` pointing the default alias to `fintrack-ai-d0120`; verify this is the intended target before deployment.

## Validation performed

- `node --test tests/*.test.mjs`: **4 passed, 0 failed**.
- Checked the example environment file for credential values: placeholders only.
- Production TypeScript/build, Cloud Functions build, Firebase Emulator rules tests, and live Firestore behavior are **not verified** in this environment because dependencies are not installed and no live Firebase access was used.

## Important remaining items — do not treat this ZIP as a live deployment approval

- **Cashier sale transaction permissions remain a known mismatch.** A cashier can create a sale, but the transaction also updates product quantities and creates stock-movement records; current rules restrict those writes to inventory editors. Do not broadly allow cashier inventory writes just to make the sale succeed. The safe complete fix is a trusted transactional sale endpoint (or carefully constrained emulator-tested rules that prove the related sale and movements are written atomically).
- Existing businesses without `subscription` need a trusted, one-time migration/backfill before their operational writes will be permitted. This patch intentionally does not weaken subscription rules or invent a new trial for existing records.
- `src/context/app-context.tsx` still keeps expenses/budget in React memory only; it is not a Firestore-backed financial ledger. Treat that area as prototype-level until persistence and tenant isolation are implemented.
- Configure `GOOGLE_GENAI_API_KEY` in the server deployment secret store and ensure Firebase Admin Application Default Credentials/workload identity are available. Never put server credentials in `.env.example` or any `NEXT_PUBLIC_` variable.
- Deploy and test rules in a staging Firebase project first. Run the functions build independently from the Next.js app.

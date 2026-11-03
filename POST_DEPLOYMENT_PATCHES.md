# FinAI post-deployment patch set

This is an additive source overlay for the FinAI Spark CRUD recovery source. It addresses the five post-deployment items reported after the successful CRUD smoke test.

## Included fixes and UI work

1. **Live stock movement history**
   - The Firestore listener subscribed to `businesses/{uid}/stockMovements` but wrote the snapshot to a context property named `stockMovements`.
   - The UI reads `movements`, so fresh movement records were not reflected in the live Stock page or Dashboard.
   - The listener now maps that collection to the existing `movements` state key and sorts records newest-first. Movement creation, transaction writes, rules, and stored document shape are unchanged.

2. **Invoice print preview**
   - A shared print helper now clones the invoice content and removes elements marked `data-print-exclude` before opening the print-only window.
   - The Print and Download PDF toolbar is excluded from the printed page. The on-screen controls remain available in the app.

3. **AI Intelligence error handling**
   - The inventory assistant catches authentication, Firebase Admin, Firestore, and Gemini flow errors and returns a safe result to the client instead of throwing through the Server Component/action render boundary.
   - Genkit is initialized lazily after the server action verifies that a Gemini API key is configured. This avoids an import-time provider initialization crash.
   - Firebase Admin supports the existing Application Default Credentials/workload identity approach and a server-only service-account JSON environment variable.

4. **Dashboard uplift**
   - KPI cards use a responsive bento layout with larger financial anchors.
   - Stock health has status emoji, motion-safe animation, and clear healthy/reorder/out-of-stock signals. Reduced-motion preferences are respected.
   - Existing inventory, sales and stock-movement data sources are retained.

5. **Reports and header uplift**
   - Reports now include a sales/gross-profit trend line chart, payment-method donut, product profitability bar chart, and inventory-health donut.
   - Summary cards use a responsive bento layout. Existing financial calculations and report tables are retained.
   - The theme switcher is placed immediately before the account/avatar menu.

## AI server environment

For the AI assistant to work on the deployed Next.js host, configure these as **server-side** environment variables (for example in Vercel Project Settings → Environment Variables):

- `GOOGLE_GENAI_API_KEY` — Gemini API key. `GEMINI_API_KEY` or `GOOGLE_API_KEY` are also accepted by the patched Genkit initialiser.
- `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` — the complete Firebase service-account JSON object, supplied as a secret, if the host does not provide Application Default Credentials/workload identity.
- `FIREBASE_ADMIN_PROJECT_ID` — optional explicit Firebase project ID; otherwise the helper uses the service account's `project_id` or `NEXT_PUBLIC_FIREBASE_PROJECT_ID`.

Do not prefix these variables with `NEXT_PUBLIC_`. Do not put the service-account JSON or API key in source control, a client-side file, or this patch archive. After changing host environment variables, redeploy the Next.js app so the server runtime receives the new values.

The AI path needs both a valid Gemini API key and a trusted Firebase Admin identity because it verifies the user's Firebase ID token and retrieves bounded business records on the server. If it still reports a connection/configuration error, inspect the server deployment logs for the `inventoryAssistant failed` diagnostic and confirm the environment variables are set for the active deployment environment.

## Apply and validate

1. Confirm this patch is being applied to the same FinAI recovery source version used for the successful CRUD smoke test. Compare any local edits before overwriting files.
2. Extract `finai_post_deployment_patch.zip` directly into the FinAI project root (the folder containing `package.json`). The archive contains `src/` and `FIREBASE_SETUP.md` at its root and overlays only the listed files.
3. Run locally:

   ```bash
   npm run typecheck
   npm test
   npm run test:emulator
   npm run build
   ```

4. Check the stock page and Dashboard by creating a stock-in or stock-out movement and verifying it appears immediately at the top of Movement history and Recent stock movements.
5. Open a sale invoice, use Print, and verify that neither Print nor Download PDF appears in the print preview. Verify PDF download still works from the on-screen invoice toolbar.
6. Test both a suggested AI question and a typed question in the deployed environment.
7. Inspect the responsive Dashboard/Reports layouts in light and dark themes, including a narrow mobile viewport.

## Scope guardrails

- No Firestore rules, database schema, existing records, or indexes are changed by this patch.
- No Cloud Functions are deployed or required for ordinary CRUD.
- No Firebase billing-plan upgrade or Blaze requirement is introduced.
- No dependency or lockfile changes are included.
- Existing financial validation and CRUD service/provider architecture are retained.

This archive is a source overlay, not a deployment. Build/test the merged project and deploy the frontend through the project's normal release process.

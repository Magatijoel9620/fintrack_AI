> **Current architecture update — 3 November 2026:** The previous role-based/Cloud-Functions-dependent notes below are historical. The current recovery uses a single-owner `businesses/{uid}` model and direct Firestore CRUD on Spark. See [FINAI_SPARK_CRUD_RECOVERY.md](docs/FINAI_SPARK_CRUD_RECOVERY.md) for current behavior, security limitations, and deployment steps. Normal CRUD must not require a Functions deployment or Blaze upgrade.

# Inventory Tracker migration progress

## Current uplift — Beta 6
- FinTrack personal-finance UI remnants and mock admin view removed.
- Firebase configuration is loaded from environment variables; Demo Mode is removed.
- Refined Scheme 1 lavender/ink design system, Inter + Manrope typography, responsive dashboard and sales activity chart.
- Business Admin hub, employee role management, settings, and subscription page.
- 21-day trial entitlement initialized on first business creation and enforced for operational Firestore writes.
- Role-aware Firestore rules for owners, managers, cashiers, stock clerks and viewers.
- Platform Admin route protected by Firebase Auth custom claim and limited to aggregate metrics.
- Scheduled Firebase Cloud Function writes aggregate business/user counts and health status without exposing tenant records to the admin UI.
- Gemini/Genkit Inventory AI validates Firebase ID tokens server-side and provides bounded data-grounded analysis.
- Branded SVG favicon/manifest icon replaces the IDX starter icon.
- Four subscription policy tests pass.

## Remaining before production
- Install dependencies and run full typecheck/build in a complete local environment.
- Test Firestore rules with the Emulator Suite and migrate existing business records to include subscription/member fields.
- Deploy scheduled Cloud Function and set the `platformAdmin` custom claim using the trusted script.
- Configure Gemini server key and Firebase Admin Application Default Credentials.
- Implement actual billing checkout/renewal before enabling paid plans; the UI is deliberately non-operational for payments.
- Add trusted email invitations, audited maintenance controls, and production error aggregation.

## Spark CRUD recovery verification — 3 November 2026

- Unit suite: 23/23 passed.
- Auth + Firestore Emulator: 8/8 passed using `demo-finai`.
- Emulator execution did not deploy production rules or Cloud Functions. No production deployment has been performed.
- The initial root typecheck exposed 14 errors in `src/context/inventory-context.tsx`; a follow-up patch resolves the reported nullable-Firestore, movement-literal and unsupported transaction-query issues. Re-run root typecheck/build before Stage 3.
- Cloud Functions remain optional/historical; normal business CRUD must not call them.

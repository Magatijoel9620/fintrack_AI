FINAI — ACCOUNT PROFILE, RESPONSIVE NAVIGATION & UI POLISH
========================================================

Apply this overlay to the current FinAI project root (the directory containing package.json).

1. Commit or stash any existing local work first.
2. Extract this ZIP into the project root, allowing the listed source files to be replaced.
3. Run the validation commands below before deploying.

Files in this patch:
- src/app/dashboard/page.tsx
- src/app/globals.css
- src/components/account-profile-view.tsx (new)
- src/components/header.tsx
- src/components/inventory/business-admin-view.tsx
- src/components/inventory/settings-view.tsx
- src/components/ui/button.tsx
- src/components/ui/card.tsx
- src/context/auth-context.tsx
- FINAI_PROFILE_NAV_UI_PATCH.md

No new npm dependencies are required.

VALIDATION
----------
npm run typecheck
npm test
npm run test:emulator
npm run build

Review with:
git diff --check
git status --short
git diff --stat

DEPLOYMENT
----------
This patch does not modify Firestore rules, business document schema, Cloud Functions,
Firebase billing plan, payment flows, or financial transaction logic. Do not deploy
Firestore rules or Functions for this patch. After all checks pass, deploy the web app
through the existing Vercel deployment workflow.

See FINAI_PROFILE_NAV_UI_PATCH.md for data handling and responsive QA notes.

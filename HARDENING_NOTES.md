# FinTrack Phase 14 — hardening pass

## Changes in this pass
- Added the missing `LOCAL_KEY` helper referenced by inventory-context local persistence.
- Fixed the AI assistant request contract: the client now sends a Firebase ID token and the signed-in user's business ID, matching the server-side schema.
- Replaced raw Zod validation failures and internal AI/provider failures with user-safe messages. Server-side token verification remains in place and the AI is still constrained to the supplied business summary.
- Added friendly authentication error messages instead of surfacing Firebase SDK exception text.
- Reworked the theme button to toggle between light and dark mode and expose an accessible label.
- Improved the workspace search action so Enter navigates to common sections and unknown terms get a helpful message.
- Added a time-based dashboard greeting using the signed-in user's display name or email prefix.
- Hardened direct `/dashboard` access: while auth initializes it shows a loading state, and signed-out users are shown the sign-in screen rather than the workspace shell.
- Clarified the platform-admin denied state and added an explicit sign-out action. Returning to the normal workspace does not grant platform-admin permissions; the `platformAdmin` custom claim remains separate.
- Excluded the separate Firebase Functions source tree from the Next.js app's TypeScript project. The Cloud Functions package has its own `functions/package.json` and `functions/tsconfig.json`; build it separately from that directory.
- Updated awkward login privacy copy and added explicit `type="button"` to non-submit buttons found in the login and AI suggestion UI.

## Security note
The platform-admin UI claim check is not the security boundary by itself. `firestore.rules` already restricts `platformMetrics`, `platformAudit`, and `platformSettings` reads to `request.auth.token.platformAdmin == true`; keep those rules deployed. Any future admin mutations must go through a trusted server-side endpoint and must verify the claim server-side.

## Validation
- `node --test tests/*.test.mjs`: passed (4 tests).
- `npm run lint`: could not provide a valid code-quality result because dependencies are not installed in this workspace (`react`, `next`, Firebase, Genkit and their types are missing). Install dependencies with `npm ci` and rerun `npm run lint` and `npm run build` before deployment.
- No production build or live Firebase authorization test is claimed by this patch.

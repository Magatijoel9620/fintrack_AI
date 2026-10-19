# Inventory Tracker uplift — bundled pass

## Delivered in this pass

- Chosen palette: Coolors Scheme 1 (lavender #3D65C2, ink #0C1427, pale lavender #ECF0F9, muted lilac/mauve support colors). This best fits a calm, trustworthy, modern business/fintech dashboard; the olive/orange scheme is better suited to agricultural/retail branding and the saturated violet scheme felt less restrained for financial data.
- Updated typography to Inter for UI/body and Manrope for headings.
- Modernized global colors, card radius, spacing tone, dark sidebar and dashboard shell.
- Replaced the IDX/Firebase starter favicon with a project-owned SVG brand mark and removed `.idx` and the old PWA worker artifacts.
- Removed Demo Mode entry points and moved Firebase configuration to environment variables.
- Added Business Admin hub and team member role UI.
- Added a separate `/platform-admin` page guarded by the Firebase Auth `platformAdmin` custom claim. It reads aggregate platform metrics only; it does not query tenant records.
- Added subscription page and a 21-day trial entitlement initialized when a business is first created.
- Hardened Firestore rules with membership/role checks, trial/active-subscription write gates, immutable owner identity/subscription fields from client updates, and read-only aggregate platform metrics.
- Connected Inventory AI Assistant to the existing server-side Gemini/Genkit flow with bounded business summaries, loading/error states and prompt suggestions.
- Added policy unit tests.

## Not represented as complete

- Online payment checkout / automatic subscription renewal is not implemented. Plan cards are disabled rather than pretending billing works.
- Platform metrics, error logs, maintenance mode and audit feeds require trusted Cloud Functions/Cloud Run/Admin SDK jobs and must not be populated by the client.
- Email-based employee invitations require a trusted callable function; the included UI grants a pre-registered Firebase UID.
- Firestore rules should be tested in the Emulator Suite before production rollout.
- Legacy business records require a subscription/member migration before the stricter rules can be applied safely.

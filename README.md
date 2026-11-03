# Inventory Tracker — Beta 6 Uplift

A Firebase-authenticated inventory and small-business operations app with a refined lavender/ink design system, business administration, accounting, Gemini-assisted inventory analysis, and a 21-day trial foundation.

## Stack
- Next.js 15 / React 18 / TypeScript
- Firebase Authentication + Cloud Firestore
- Gemini through Genkit server-side flows
- Tailwind CSS, Radix UI primitives, Recharts

## Setup
1. Copy `.env.example` to `.env.local`.
2. Fill the Firebase Web App values from Firebase Console.
3. Set `GOOGLE_GENAI_API_KEY` server-side for Gemini AI. Never expose it as a `NEXT_PUBLIC_` variable.
4. Publish `firestore.rules` in the Firebase Console.
5. Run `npm install`, `npm run typecheck`, `npm test`, and `npm run build`.

## Security and rollout notes
- Demo mode has been removed. The app requires Firebase Authentication.
- Firebase web config is loaded from environment variables.
- Firestore rules isolate each `businesses/{uid}` workspace to its Firebase Auth owner. There are no business member roles or membership documents.
- Direct Firestore CRUD is used for normal operations; Cloud Functions are not required for provisioning or CRUD.
- Business writes remain available during the 21-day trial and while `subscription.status` is `active`. After a known trial end date passes without an active subscription, writes pause while reads and subscription-payment requests remain available.
- A subscription is initialized on first business creation. Billing checkout is not yet connected; plan cards are informational and no payment is simulated.
- `/platform-admin` requires the Firebase Auth custom claim `platformAdmin: true` and reads aggregate-only `platformMetrics` documents. It does not query tenant business records or personal/transaction data.
- Platform metrics must be produced by trusted server-side jobs (Cloud Functions/Cloud Run/Admin SDK). Client writes to platform metric documents are denied.
- Platform-level metrics still need a trusted server-side job (optional Cloud Functions/Cloud Run/Admin SDK), but this does not gate normal business CRUD.
- Existing business records with a missing trial date are not automatically locked. Review records whose business path, `id`, and `ownerId` do not agree before deployment.
- Gemini receives bounded product and transaction summaries for each prompt. Review your privacy policy and user consent before production use.

## P15 repair notes
See [REPAIR_NOTES_P15.md](./REPAIR_NOTES_P15.md) for the changes made, validation boundaries, and remaining role/migration blockers. Do not deploy Firestore rules to production without staging Emulator Suite coverage.

## Routes
- `/` — Firebase sign-in / normal app entry
- `/dashboard?view=business-admin` — business administration hub
- `/dashboard?view=subscriptions` — trial and plan status
- `/platform-admin` — protected platform operations dashboard

## Tests
```bash
npm test
npm run typecheck
npm run build
```

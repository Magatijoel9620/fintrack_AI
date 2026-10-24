# FinAI mobile/PWA release pass

## Changes
- Reworked mobile primary navigation to include Home, Products, Sales, and AI, with a More menu for the remaining workspace sections.
- Added touch-sized controls, active states, safe-area-aware bottom navigation, and a dismissible mobile More menu.
- Corrected the mobile content bottom padding so the fixed navigation does not cover page content.
- Tightened the mobile header's Add Product control and compacted the global page heading on small screens.
- Improved AI view spacing and mobile form sizing.
- Added honest rotating AI request status updates and an accessible live status region. These are progress messages, not a representation of the model's private reasoning; no artificial wait was added.
- Added accurately sized 192x192 and 512x512 PWA icons and updated the manifest to reference them without incorrectly declaring the icon maskable.

## Verification
- `npm test`: passed (4 tests).
- `npm run typecheck`: could not be completed because dependency installation timed out and left an incomplete `node_modules` directory; TypeScript reported missing type definitions from that incomplete install.
- `npm run build`: not verified for the same dependency-install limitation.

## Before production
1. Extract this ZIP and run `npm ci` on a machine with working npm registry access.
2. Run `npm run typecheck`, `npm test`, and `npm run build`.
3. Deploy to a Vercel Preview URL and test on a real Android phone and iPhone if available.
4. Verify Firebase Auth authorized domains, AI server credentials, Firestore rules, and production business isolation before opening to customers.

FinAI AI TypeScript compatibility fix

Apply this ZIP over the FinAI project root (the folder containing package.json).
It is an additive overlay: it replaces only the six listed source files.

Fixes:
- Removes legacy static `ai` imports from four Genkit flows.
- Creates each Genkit prompt/flow lazily when the relevant server action runs.
- Gives each flow callback an explicit schema-derived input type.
- Uses the shared Firebase Admin app factory across AI token verification.
- Narrows service-account credentials before passing the private key to cert().

No Firestore rules, data, schema, subscription logic, CRUD paths, Cloud Functions,
or Firebase billing settings are changed.

After applying, run:
  npm run typecheck
  npm test
  npm run test:emulator
  npm run build

Do not redeploy until typecheck and build both pass. Emulator tests are expected
not to require any production data or deploy any Firebase resources.

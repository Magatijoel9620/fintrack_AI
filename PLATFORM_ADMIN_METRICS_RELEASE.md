# Platform Admin aggregate metrics update

## What changed
- The trusted Firebase scheduled function `refreshPlatformMetrics` now refreshes hourly in `Africa/Nairobi`.
- `platformMetrics/overview` contains aggregate counts for businesses, registered users, subscription states, customers, suppliers, products, sales, purchases, payments, and pending subscription payment requests.
- Platform Admin renders these additional aggregates.
- The function does not copy customer names, emails, phone numbers, business IDs, payment references, invoices, or transaction contents into the metrics document.
- Existing Firestore rules keep `platformMetrics/*` read-only to clients and readable only by accounts with the `platformAdmin` custom claim.

## Deploy
From the project root, install dependencies and deploy Firestore rules plus the function:

```bash
npm ci
npm --prefix functions install
npm --prefix functions run build
firebase deploy --only functions:refreshPlatformMetrics,firestore:rules
```

The project must be selected as `fintrack-ai-d0120` (`firebase use fintrack-ai-d0120`). The scheduled function uses `europe-west1` and `Africa/Nairobi` scheduling.

## First document / first run
The scheduled function creates `platformMetrics/overview` on its first successful run (within the first hourly schedule window after deployment). It can take up to about an hour for the first document to appear. Confirm the function has run in Firebase Console > Functions > Logs and then inspect Firestore > `platformMetrics` > `overview`.

## Important operational notes
- Scheduled functions require the Firebase/Google Cloud project to have the billing and APIs required for Cloud Scheduler / Cloud Functions enabled; Firebase may require the Blaze plan.
- Firestore collection-group count queries can require a collection-group index for the filtered `subscriptionPaymentRequests.status` query. If deployment logs report a missing index, create the suggested index from the error link.
- Aggregate counts are approximate snapshots of current record totals, not unique human customer counts across businesses.
- The dashboard intentionally does not show identifiable customer relationship records. It displays aggregate totals only to preserve tenant privacy.
- A failed refresh marks service status as `degraded` while preserving the previous counts.

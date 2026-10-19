# Platform metrics function

Deploy separately from the Next.js app:

```bash
cd functions
npm install
npm run build
firebase deploy --only functions:refreshPlatformMetrics
```

This scheduled function writes aggregate counts only to `platformMetrics/overview`. The platform admin UI does not query business records or user profile documents. The function requires a Firebase project with billing/scheduled functions enabled. Keep service-account credentials in the deployment environment, never in the repository.

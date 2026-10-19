import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";

initializeApp();
const db = getFirestore();

/**
 * Writes aggregate-only platform metrics. Never writes business/user identifiers,
 * emails, names, product data, invoices, payments or transaction contents.
 */
export const refreshPlatformMetrics = onSchedule("every 6 hours", async () => {
  try {
    const businesses = db.collection("businesses");
    const users = db.collection("users");
    const [businessCount, userCount, activeCount, trialingCount, suspendedCount] = await Promise.all([
      businesses.count().get(),
      users.count().get(),
      businesses.where("subscription.status", "==", "active").count().get(),
      businesses.where("subscription.status", "==", "trialing").count().get(),
      businesses.where("subscription.status", "==", "suspended").count().get(),
    ]);
    await db.doc("platformMetrics/overview").set({
      registeredBusinesses: businessCount.data().count,
      registeredUsers: userCount.data().count,
      activeBusinesses: activeCount.data().count,
      trialingBusinesses: trialingCount.data().count,
      suspendedBusinesses: suspendedCount.data().count,
      serviceStatus: "healthy",
      lastUpdated: FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    logger.error("Platform metrics refresh failed", { error: error instanceof Error ? error.message : "unknown" });
    await db.doc("platformMetrics/overview").set({
      serviceStatus: "degraded",
      lastUpdated: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
});

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshPlatformMetrics = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firebase_functions_1 = require("firebase-functions");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
/**
 * Scheduled trusted-backend job. Writes aggregate counts only; never exports
 * tenant IDs, customer names/emails, contact details, products, invoices,
 * payment references, or transaction contents into platform metrics.
 */
exports.refreshPlatformMetrics = (0, scheduler_1.onSchedule)({ schedule: "every 1 hours", timeZone: "Africa/Nairobi", region: "europe-west1" }, async () => {
    try {
        const businesses = db.collection("businesses");
        const users = db.collection("users");
        // Aggregates use Firestore count() queries and collection-group counts.
        // Admin SDK runs server-side and bypasses client Firestore rules.
        const [businessCount, userCount, activeCount, trialingCount, suspendedCount, customerCount, supplierCount, productCount, salesCount, purchaseCount, paymentCount, pendingPaymentRequestCount,] = await Promise.all([
            businesses.count().get(),
            users.count().get(),
            businesses.where("subscription.status", "==", "active").count().get(),
            businesses.where("subscription.status", "==", "trialing").count().get(),
            businesses.where("subscription.status", "==", "suspended").count().get(),
            db.collectionGroup("customers").count().get(),
            db.collectionGroup("suppliers").count().get(),
            db.collectionGroup("products").count().get(),
            db.collectionGroup("sales").count().get(),
            db.collectionGroup("purchases").count().get(),
            db.collectionGroup("payments").count().get(),
            db.collectionGroup("subscriptionPaymentRequests")
                .where("status", "==", "pending_review")
                .count()
                .get(),
        ]);
        await db.doc("platformMetrics/overview").set({
            registeredBusinesses: businessCount.data().count,
            registeredUsers: userCount.data().count,
            activeBusinesses: activeCount.data().count,
            trialingBusinesses: trialingCount.data().count,
            suspendedBusinesses: suspendedCount.data().count,
            totalCustomers: customerCount.data().count,
            totalSuppliers: supplierCount.data().count,
            totalProducts: productCount.data().count,
            totalSales: salesCount.data().count,
            totalPurchases: purchaseCount.data().count,
            totalPayments: paymentCount.data().count,
            pendingPaymentRequests: pendingPaymentRequestCount.data().count,
            serviceStatus: "healthy",
            lastUpdated: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
        firebase_functions_1.logger.info("Platform aggregate metrics refreshed");
    }
    catch (error) {
        firebase_functions_1.logger.error("Platform metrics refresh failed", {
            error: error instanceof Error ? error.message : "unknown",
        });
        // Keep the previous counts visible if refresh fails; mark them stale/degraded.
        await db.doc("platformMetrics/overview").set({
            serviceStatus: "degraded",
            lastUpdated: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
        throw error;
    }
});

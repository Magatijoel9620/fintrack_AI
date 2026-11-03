import { initializeApp, getApps } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import {
  IntegrityError,
  assertId,
  assertText,
  calculateOutstandingBalance,
  calculateStockDelta,
  calculateTotals,
  finiteNumber,
  roundMoney,
  validatePaymentAmount,
  validatePaymentMethod,
} from "./financial-integrity.js";

if (!getApps().length) initializeApp();
const db = getFirestore();
const REGION = "europe-west1";
const DAY_MS = 24 * 60 * 60 * 1000;

function callableError(error: unknown): never {
  if (error instanceof HttpsError) throw error;
  if (error instanceof IntegrityError) {
    logger.info("FinAI callable validation rejected", { message: error.message });
    throw new HttpsError("invalid-argument", error.message);
  }
  logger.error("FinAI callable failed", { error: error instanceof Error ? error.message : "unknown" });
  throw new HttpsError("internal", "The operation could not be completed. Please retry.");
}

function requireUid(request: { auth?: { uid: string } | null }): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to continue.");
  return uid;
}

function activeSubscription(business: FirebaseFirestore.DocumentData): boolean {
  const subscription = business.subscription ?? {};
  if (subscription.status === "active") return true;
  if (subscription.status !== "trialing" || !subscription.trialEndsAt) return false;
  const end = typeof subscription.trialEndsAt.toDate === "function"
    ? subscription.trialEndsAt.toDate()
    : new Date(subscription.trialEndsAt);
  return Number.isFinite(end.getTime()) && end.getTime() > Date.now();
}

type SaleItemInput = { productId: string; quantity: number };
type PurchaseItemInput = { productId: string; quantity: number; unitCost: number };
function normalizeItemInput(raw: unknown, index: number, priceField: "unitPrice"): SaleItemInput;
function normalizeItemInput(raw: unknown, index: number, priceField: "unitCost"): PurchaseItemInput;
function normalizeItemInput(raw: unknown, index: number, priceField: "unitPrice" | "unitCost"): SaleItemInput | PurchaseItemInput {
  if (!raw || typeof raw !== "object") throw new HttpsError("invalid-argument", `Item ${index + 1} is invalid.`);
  const item = raw as Record<string, unknown>;
  return {
    productId: assertId(item.productId, `Item ${index + 1} product`),
    quantity: finiteNumber(item.quantity, `Item ${index + 1} quantity`, Number.MIN_VALUE, 1_000_000_000),
    ...(priceField === "unitCost" ? { unitCost: finiteNumber(item.unitCost, `Item ${index + 1} unit cost`) } : {}),
  };
}

function asNumber(value: unknown, label: string): number {
  return finiteNumber(typeof value === "number" ? value : Number.NaN, label);
}

function saleInput(data: Record<string, unknown>) {
  const id = assertId(data.id, "Sale ID");
  const invoiceNumber = assertText(data.invoiceNumber, "Invoice number", 80)!;
  const paymentMethod = validatePaymentMethod(data.paymentMethod);
  const amountPaid = asNumber(data.amountPaid, "Amount paid");
  const discount = asNumber(data.discount ?? 0, "Discount");
  const taxRate = asNumber(data.taxRate ?? 0, "Tax rate");
  const customerId = data.customerId ? assertId(data.customerId, "Customer ID") : undefined;
  if (!Array.isArray(data.items) || data.items.length < 1 || data.items.length > 100) throw new HttpsError("invalid-argument", "A sale must contain between 1 and 100 items.");
  const items = data.items.map((item, index) => normalizeItemInput(item, index, "unitPrice"));
  if (new Set(items.map((item) => item.productId)).size !== items.length) throw new HttpsError("invalid-argument", "Each product may appear only once in a sale.");
  if (paymentMethod === "credit" && !customerId) throw new HttpsError("failed-precondition", "Select a customer for a credit sale.");
  return { id, invoiceNumber, paymentMethod, amountPaid, discount, taxRate, customerId, items };
}

function purchaseInput(data: Record<string, unknown>) {
  const id = assertId(data.id, "Purchase ID");
  const invoiceNumber = assertText(data.invoiceNumber, "Supplier invoice number", 80)!;
  const paymentMethod = validatePaymentMethod(data.paymentMethod ?? "credit");
  const amountPaid = asNumber(data.amountPaid ?? 0, "Amount paid");
  const discount = asNumber(data.discount ?? 0, "Discount");
  const taxRate = asNumber(data.taxRate ?? 0, "Tax rate");
  const supplierId = data.supplierId ? assertId(data.supplierId, "Supplier ID") : undefined;
  if (!Array.isArray(data.items) || data.items.length < 1 || data.items.length > 100) throw new HttpsError("invalid-argument", "A purchase must contain between 1 and 100 items.");
  const items = data.items.map((item, index) => normalizeItemInput(item, index, "unitCost"));
  if (new Set(items.map((item) => item.productId)).size !== items.length) throw new HttpsError("invalid-argument", "Each product may appear only once in a purchase.");
  return { id, invoiceNumber, paymentMethod, amountPaid, discount, taxRate, supplierId, items };
}

const PRODUCT_UNITS = new Set(["pcs", "kg", "g", "litres", "boxes", "cartons", "dozens", "metres"]);
const STOCK_MOVEMENT_TYPES = new Set(["stock-in", "stock-out", "adjustment", "damage"]);

type ProductPayload = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  reorderLevel: number;
  isActive: boolean;
  barcode?: string;
  supplierId?: string;
  description?: string;
  imageUrl?: string;
};

function productPayload(data: Record<string, unknown>): ProductPayload {
  const unit = data.unit;
  if (typeof unit !== "string" || !PRODUCT_UNITS.has(unit)) throw new HttpsError("invalid-argument", "Product unit is invalid.");
  if (typeof data.isActive !== "boolean") throw new HttpsError("invalid-argument", "Product status is invalid.");
  const barcode = assertText(data.barcode, "Barcode", 100, false);
  const supplierId = data.supplierId ? assertId(data.supplierId, "Supplier ID") : undefined;
  const description = assertText(data.description, "Description", 1000, false);
  const imageUrl = assertText(data.imageUrl, "Product image URL", 2048, false);
  return {
    id: assertId(data.id, "Product ID"),
    name: assertText(data.name, "Product name", 160)!,
    sku: assertText(data.sku, "SKU", 80)!,
    category: assertText(data.category, "Category", 80)!,
    unit,
    costPrice: finiteNumber(data.costPrice, "Cost price"),
    sellingPrice: finiteNumber(data.sellingPrice, "Selling price"),
    quantity: finiteNumber(data.quantity, "Stock quantity", 0, 1_000_000_000),
    reorderLevel: finiteNumber(data.reorderLevel, "Reorder level", 0, 1_000_000_000),
    isActive: data.isActive,
    ...(barcode ? { barcode } : {}),
    ...(supplierId ? { supplierId } : {}),
    ...(description ? { description } : {}),
    ...(imageUrl ? { imageUrl } : {}),
  };
}


async function requireOwnedActiveBusiness(
  transaction: FirebaseFirestore.Transaction,
  businessRef: FirebaseFirestore.DocumentReference,
  uid: string,
): Promise<FirebaseFirestore.DocumentData> {
  const business = await transaction.get(businessRef);
  const data = business.data();
  if (!business.exists || data?.ownerId !== uid || data?.id !== uid) {
    throw new HttpsError("permission-denied", "This account does not own this business workspace.");
  }
  if (!activeSubscription(data)) throw new HttpsError("failed-precondition", "Your subscription is not active.");
  return data;
}

/**
 * Server-authoritative, idempotent workspace provisioning. Existing business
 * documents and subscriptions are never overwritten or reset here.
 */
export const ensureBusinessProvisioned = onCall({ region: REGION }, async (request) => {
  const uid = requireUid(request);
  try {
    const reference = db.doc(`businesses/${uid}`);
    return await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (snapshot.exists) {
        const existing = snapshot.data()!;
        if (existing.ownerId !== uid || existing.id !== uid) {
          throw new HttpsError("permission-denied", "An existing business record is not owned by this account. No data was changed.");
        }
        return { created: false, businessId: uid };
      }
      const started = new Date();
      const ends = new Date(started.getTime() + 21 * DAY_MS);
      const displayName = typeof request.auth?.token.name === "string" ? request.auth.token.name.trim().slice(0, 80) : "";
      transaction.create(reference, {
        id: uid,
        name: displayName ? `${displayName}'s Business` : "My Business",
        currency: "KES",
        ownerId: uid,
        createdAt: started.toISOString(),
        subscription: {
          planId: "trial",
          status: "trialing",
          trialStartedAt: Timestamp.fromDate(started),
          trialEndsAt: Timestamp.fromDate(ends),
          updatedAt: Timestamp.fromDate(started),
        },
      });
      return { created: true, businessId: uid };
    });
  } catch (error) { return callableError(error); }
});

/** Create product + opening stock history atomically. */
export const createProduct = onCall({ region: REGION }, async (request) => {
  const uid = requireUid(request);
  try {
    const input = productPayload((request.data ?? {}) as Record<string, unknown>);
    const businessRef = db.doc(`businesses/${uid}`);
    const productRef = businessRef.collection("products").doc(input.id);
    return await db.runTransaction(async (transaction) => {
      await requireOwnedActiveBusiness(transaction, businessRef, uid);
      const [existing, sameSku, sameBarcode] = await Promise.all([
        transaction.get(productRef),
        transaction.get(businessRef.collection("products").where("sku", "==", input.sku)),
        input.barcode ? transaction.get(businessRef.collection("products").where("barcode", "==", input.barcode)) : Promise.resolve(null),
      ]);
      if (existing.exists) return existing.data();
      if (!sameSku.empty) throw new HttpsError("already-exists", "That SKU is already in use.");
      if (sameBarcode && !sameBarcode.empty) throw new HttpsError("already-exists", "That barcode is already assigned to another product.");
      const timestamp = new Date().toISOString();
      const product = { ...input, businessId: uid, createdAt: timestamp, updatedAt: timestamp };
      transaction.create(productRef, product);
      if (input.quantity > 0) {
        const movementRef = businessRef.collection("stockMovements").doc();
        transaction.create(movementRef, {
          id: movementRef.id, businessId: uid, productId: input.id,
          productName: input.name, type: "opening", quantity: input.quantity,
          reference: "Opening stock", createdAt: timestamp, createdBy: uid,
        });
      }
      return product;
    });
  } catch (error) { return callableError(error); }
});

/** Update product details and any stock delta as one trusted operation. */
export const updateProduct = onCall({ region: REGION }, async (request) => {
  const uid = requireUid(request);
  try {
    const data = (request.data ?? {}) as Record<string, unknown>;
    const input = productPayload(data);
    const expectedQuantity = finiteNumber(data.expectedQuantity, "Expected stock", 0, 1_000_000_000);
    const businessRef = db.doc(`businesses/${uid}`);
    const productRef = businessRef.collection("products").doc(input.id);
    return await db.runTransaction(async (transaction) => {
      await requireOwnedActiveBusiness(transaction, businessRef, uid);
      const [currentSnapshot, sameSku, sameBarcode] = await Promise.all([
        transaction.get(productRef),
        transaction.get(businessRef.collection("products").where("sku", "==", input.sku)),
        input.barcode ? transaction.get(businessRef.collection("products").where("barcode", "==", input.barcode)) : Promise.resolve(null),
      ]);
      if (!currentSnapshot.exists) throw new HttpsError("not-found", "Product not found.");
      if (sameSku.docs.some((document) => document.id !== input.id)) throw new HttpsError("already-exists", "That SKU is already in use.");
      if (sameBarcode?.docs.some((document) => document.id !== input.id)) throw new HttpsError("already-exists", "That barcode is already assigned to another product.");
      const current = currentSnapshot.data()!;
      const currentQuantity = finiteNumber(current.quantity, "Stored product stock", 0, 1_000_000_000);
      if (currentQuantity !== expectedQuantity) throw new HttpsError("aborted", "Stock changed while the product editor was open. Refresh the product and try again to avoid overwriting a newer stock balance.");
      const delta = roundMoney(input.quantity - currentQuantity);
      const timestamp = new Date().toISOString();
      const product = { ...input, businessId: uid, createdAt: current.createdAt, updatedAt: timestamp };
      transaction.update(productRef, product);
      if (delta !== 0) {
        const movementRef = businessRef.collection("stockMovements").doc();
        transaction.create(movementRef, {
          id: movementRef.id, businessId: uid, productId: input.id,
          productName: input.name, type: "adjustment", quantity: delta,
          reference: "Product edit stock adjustment", note: "Quantity changed from product editor",
          createdAt: timestamp, createdBy: uid,
        });
      }
      return product;
    });
  } catch (error) { return callableError(error); }
});

/** Manual stock changes are append-only and atomic with the product balance. */
export const adjustStock = onCall({ region: REGION }, async (request) => {
  const uid = requireUid(request);
  try {
    const data = (request.data ?? {}) as Record<string, unknown>;
    const movementId = assertId(data.id, "Movement ID");
    const productId = assertId(data.productId, "Product ID");
    const type = typeof data.type === "string" ? data.type : "";
    if (!STOCK_MOVEMENT_TYPES.has(type)) throw new HttpsError("invalid-argument", "Manual stock movement type is invalid.");
    const delta = calculateStockDelta(type, data.quantity as number);
    const note = assertText(data.note, "Movement note", 500, false);
    const reference = assertText(data.reference, "Movement reference", 100, false);
    const businessRef = db.doc(`businesses/${uid}`);
    const productRef = businessRef.collection("products").doc(productId);
    const movementRef = businessRef.collection("stockMovements").doc(movementId);
    return await db.runTransaction(async (transaction) => {
      await requireOwnedActiveBusiness(transaction, businessRef, uid);
      const [productSnapshot, existingMovement] = await Promise.all([
        transaction.get(productRef), transaction.get(movementRef),
      ]);
      if (existingMovement.exists) return existingMovement.data();
      if (!productSnapshot.exists) throw new HttpsError("not-found", "Product not found.");
      const product = productSnapshot.data()!;
      if (product.isActive === false) throw new HttpsError("failed-precondition", "Archived products cannot receive stock movements.");
      const current = finiteNumber(product.quantity, "Stored product stock", 0, 1_000_000_000);
      const next = finiteNumber(roundMoney(current + delta), "Resulting stock", 0, 1_000_000_000);
      const timestamp = new Date().toISOString();
      transaction.update(productRef, { quantity: next, updatedAt: timestamp });
      const movement = {
        id: movementId, businessId: uid, productId, productName: assertText(product.name, "Product name", 160)!,
        type, quantity: delta, ...(note ? { note } : {}), ...(reference ? { reference } : {}),
        createdAt: timestamp, createdBy: uid,
      };
      transaction.create(movementRef, movement);
      return movement;
    });
  } catch (error) { return callableError(error); }
});

/** Soft-delete a product with history; permanently remove only a history-free record. */
export const deleteProduct = onCall({ region: REGION }, async (request) => {
  const uid = requireUid(request);
  try {
    const data = (request.data ?? {}) as Record<string, unknown>;
    const productId = assertId(data.productId, "Product ID");
    const businessRef = db.doc(`businesses/${uid}`);
    const productRef = businessRef.collection("products").doc(productId);
    const movementsQuery = businessRef.collection("stockMovements").where("productId", "==", productId).limit(1);
    return await db.runTransaction(async (transaction) => {
      await requireOwnedActiveBusiness(transaction, businessRef, uid);
      const [productSnapshot, movementHistory] = await Promise.all([
        transaction.get(productRef), transaction.get(movementsQuery),
      ]);
      if (!productSnapshot.exists) return { deleted: true, archived: false };
      if (!movementHistory.empty) {
        transaction.update(productRef, { isActive: false, updatedAt: new Date().toISOString() });
        return { deleted: false, archived: true };
      }
      transaction.delete(productRef);
      return { deleted: true, archived: false };
    });
  } catch (error) { return callableError(error); }
});

/** Record a sale, authoritative COGS snapshot and stock movements atomically. */
export const recordSale = onCall({ region: REGION }, async (request) => {
  const uid = requireUid(request);
  try {
    const input = saleInput((request.data ?? {}) as Record<string, unknown>);
    const businessRef = db.doc(`businesses/${uid}`);
    const saleRef = businessRef.collection("sales").doc(input.id);
    return await db.runTransaction(async (transaction) => {
      const business = await transaction.get(businessRef);
      if (!business.exists || business.data()?.ownerId !== uid || business.data()?.id !== uid) {
        throw new HttpsError("permission-denied", "This account does not own this business workspace.");
      }
      if (!activeSubscription(business.data()!)) throw new HttpsError("failed-precondition", "Your subscription is not active.");
      const [existingSale, matchingInvoiceNumbers] = await Promise.all([
        transaction.get(saleRef),
        transaction.get(businessRef.collection("sales").where("invoiceNumber", "==", input.invoiceNumber)),
      ]);
      if (existingSale.exists) return existingSale.data();
      if (!matchingInvoiceNumbers.empty) throw new HttpsError("already-exists", "That invoice number has already been used for a sale.");
      const customerRef = input.customerId ? businessRef.collection("customers").doc(input.customerId) : undefined;
      const productRefs = input.items.map((item) => businessRef.collection("products").doc(item.productId));
      const reads = await Promise.all([
        ...(customerRef ? [transaction.get(customerRef)] : []),
        ...productRefs.map((reference) => transaction.get(reference)),
      ]);
      let readIndex = 0;
      if (customerRef) {
        const customer = reads[readIndex++];
        if (!customer.exists) throw new HttpsError("not-found", "The selected customer does not exist in this business.");
      }
      const products = reads.slice(readIndex);
      const normalizedItems = input.items.map((item, index) => {
        const snapshot = products[index];
        if (!snapshot.exists) throw new HttpsError("not-found", `Product ${item.productId} no longer exists.`);
        const product = snapshot.data()!;
        if (product.isActive === false) throw new HttpsError("failed-precondition", `${product.name ?? "A product"} is archived and cannot be sold.`);
        const stock = finiteNumber(product.quantity, `${product.name ?? "Product"} stock`);
        if (stock < item.quantity) throw new HttpsError("failed-precondition", `Insufficient stock for ${product.name ?? item.productId}.`);
        return {
          productId: item.productId,
          productName: assertText(product.name, "Product name", 160)!,
          quantity: item.quantity,
          unitPrice: finiteNumber(product.sellingPrice, "Stored selling price"),
          unitCost: finiteNumber(product.costPrice, "Stored cost price"),
          stock,
          product: snapshot.ref,
        };
      });
      const totals = calculateTotals({
        items: normalizedItems,
        priceField: "unitPrice",
        discount: input.discount,
        taxRate: input.taxRate,
        amountPaid: input.amountPaid,
      });
      if (input.paymentMethod !== "credit" && totals.amountPaid !== totals.total) {
        throw new HttpsError("failed-precondition", "A non-credit sale must be paid in full.");
      }
      const timestamp = new Date().toISOString();
      const sale = {
        id: input.id,
        businessId: uid,
        invoiceNumber: input.invoiceNumber,
        ...(input.customerId ? { customerId: input.customerId } : {}),
        items: totals.items.map((item, index) => ({
          productId: item.productId,
          productName: normalizedItems[index].productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitCost: roundMoney(normalizedItems[index].unitCost),
          total: item.total,
        })),
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        total: totals.total,
        ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
        amountPaid: totals.amountPaid,
        createdAt: timestamp,
      };
      totals.items.forEach((item, index) => {
        transaction.update(normalizedItems[index].product, {
          quantity: roundMoney(normalizedItems[index].stock - item.quantity),
          updatedAt: timestamp,
        });
      });
      const grouped = new Map<string, { quantity: number; productName: string }>();
      sale.items.forEach((item) => {
        const previous = grouped.get(item.productId);
        grouped.set(item.productId, {
          quantity: (previous?.quantity ?? 0) + item.quantity,
          productName: item.productName,
        });
      });
      for (const [productId, item] of grouped) {
        const movementRef = businessRef.collection("stockMovements").doc();
        transaction.create(movementRef, {
          id: movementRef.id,
          businessId: uid,
          productId,
          productName: item.productName,
          type: "sale",
          quantity: -item.quantity,
          reference: input.invoiceNumber,
          createdAt: timestamp,
          createdBy: uid,
        });
      }
      transaction.create(saleRef, sale);
      return sale;
    });
  } catch (error) { return callableError(error); }
});

/** Record supplier receipt and stock movement atomically (latest-purchase costing). */
export const recordPurchase = onCall({ region: REGION }, async (request) => {
  const uid = requireUid(request);
  try {
    const input = purchaseInput((request.data ?? {}) as Record<string, unknown>);
    const businessRef = db.doc(`businesses/${uid}`);
    const purchaseRef = businessRef.collection("purchases").doc(input.id);
    return await db.runTransaction(async (transaction) => {
      const business = await transaction.get(businessRef);
      if (!business.exists || business.data()?.ownerId !== uid || business.data()?.id !== uid) {
        throw new HttpsError("permission-denied", "This account does not own this business workspace.");
      }
      if (!activeSubscription(business.data()!)) throw new HttpsError("failed-precondition", "Your subscription is not active.");
      const [existingPurchase, matchingInvoiceNumbers] = await Promise.all([
        transaction.get(purchaseRef),
        transaction.get(businessRef.collection("purchases").where("invoiceNumber", "==", input.invoiceNumber)),
      ]);
      if (existingPurchase.exists) return existingPurchase.data();
      if (!matchingInvoiceNumbers.empty) throw new HttpsError("already-exists", "That supplier invoice number has already been recorded.");
      const supplierRef = input.supplierId ? businessRef.collection("suppliers").doc(input.supplierId) : undefined;
      const productRefs = input.items.map((item) => businessRef.collection("products").doc(item.productId));
      const reads = await Promise.all([
        ...(supplierRef ? [transaction.get(supplierRef)] : []),
        ...productRefs.map((reference) => transaction.get(reference)),
      ]);
      let readIndex = 0;
      if (supplierRef) {
        const supplier = reads[readIndex++];
        if (!supplier.exists) throw new HttpsError("not-found", "The selected supplier does not exist in this business.");
      }
      const products = reads.slice(readIndex);
      const normalizedItems = input.items.map((item, index) => {
        const snapshot = products[index];
        if (!snapshot.exists) throw new HttpsError("not-found", `Product ${item.productId} no longer exists.`);
        const product = snapshot.data()!;
        if (product.isActive === false) throw new HttpsError("failed-precondition", `${product.name ?? "A product"} is archived and cannot receive a purchase.`);
        return {
          productId: item.productId,
          productName: assertText(product.name, "Product name", 160)!,
          quantity: item.quantity,
          unitCost: item.unitCost,
          stock: finiteNumber(product.quantity, "Stored product stock", 0, 1_000_000_000),
          product: snapshot.ref,
        };
      });
      const totals = calculateTotals({
        items: normalizedItems,
        priceField: "unitCost",
        discount: input.discount,
        taxRate: input.taxRate,
        amountPaid: input.amountPaid,
      });
      if (input.paymentMethod !== "credit" && totals.amountPaid !== totals.total) {
        throw new HttpsError("failed-precondition", "A non-credit purchase must be paid in full.");
      }
      if (totals.amountPaid < totals.total && !input.supplierId) {
        throw new HttpsError("failed-precondition", "Select a supplier when recording an outstanding purchase balance.");
      }
      const timestamp = new Date().toISOString();
      const purchase = {
        id: input.id,
        businessId: uid,
        invoiceNumber: input.invoiceNumber,
        ...(input.supplierId ? { supplierId: input.supplierId } : {}),
        items: totals.items.map((item, index) => ({
          productId: item.productId,
          productName: normalizedItems[index].productName,
          quantity: item.quantity,
          unitCost: item.unitCost,
          total: item.total,
        })),
        subtotal: totals.subtotal,
        discount: totals.discount,
        tax: totals.tax,
        total: totals.total,
        ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
        amountPaid: totals.amountPaid,
        createdAt: timestamp,
      };
      const grouped = new Map<string, { quantity: number; total: number; productName: string; latestUnitCost: number; stock: number; product: FirebaseFirestore.DocumentReference }>();
      purchase.items.forEach((item, index) => {
        const previous = grouped.get(item.productId);
        grouped.set(item.productId, {
          quantity: (previous?.quantity ?? 0) + item.quantity,
          total: (previous?.total ?? 0) + item.total,
          productName: item.productName,
          latestUnitCost: item.unitCost,
          stock: normalizedItems[index].stock,
          product: normalizedItems[index].product,
        });
      });
      for (const [productId, item] of grouped) {
        transaction.update(item.product, {
          quantity: finiteNumber(roundMoney(item.stock + item.quantity), "Resulting product stock", 0, 1_000_000_000),
          costPrice: item.latestUnitCost,
          updatedAt: timestamp,
        });
        const movementRef = businessRef.collection("stockMovements").doc();
        transaction.create(movementRef, {
          id: movementRef.id,
          businessId: uid,
          productId,
          productName: item.productName,
          type: "purchase",
          quantity: item.quantity,
          reference: input.invoiceNumber,
          unitCost: item.latestUnitCost,
          createdAt: timestamp,
          createdBy: uid,
        });
      }
      transaction.create(purchaseRef, purchase);
      return purchase;
    });
  } catch (error) { return callableError(error); }
});

/** Append-only customer/supplier receipt allocated against current outstanding balance. */
export const recordAccountPayment = onCall({ region: REGION }, async (request) => {
  const uid = requireUid(request);
  try {
    const data = (request.data ?? {}) as Record<string, unknown>;
    const id = assertId(data.id, "Payment ID");
    const partyType = data.partyType;
    if (partyType !== "customer" && partyType !== "supplier") throw new HttpsError("invalid-argument", "Payment party type is invalid.");
    const partyId = assertId(data.partyId, "Payment party");
    const amount = validatePaymentAmount(data.amount);
    const paymentMethod = validatePaymentMethod(data.paymentMethod);
    const reference = assertText(data.reference, "Payment reference", 100, false);
    const note = assertText(data.note, "Payment note", 500, false);
    const businessRef = db.doc(`businesses/${uid}`);
    const paymentsCollection = businessRef.collection("payments");
    const paymentRef = paymentsCollection.doc(id);
    const partyCollection = partyType === "customer" ? "customers" : "suppliers";
    const transactionCollection = partyType === "customer" ? "sales" : "purchases";
    const partyField = partyType === "customer" ? "customerId" : "supplierId";
    return await db.runTransaction(async (transaction) => {
      const business = await transaction.get(businessRef);
      if (!business.exists || business.data()?.ownerId !== uid || business.data()?.id !== uid) {
        throw new HttpsError("permission-denied", "This account does not own this business workspace.");
      }
      if (!activeSubscription(business.data()!)) throw new HttpsError("failed-precondition", "Your subscription is not active.");
      const existing = await transaction.get(paymentRef);
      if (existing.exists) return existing.data();
      const partyRef = businessRef.collection(partyCollection).doc(partyId);
      const transactionsQuery = businessRef.collection(transactionCollection).where(partyField, "==", partyId);
      const priorPaymentsQuery = paymentsCollection.where("partyId", "==", partyId);
      const [party, transactions, priorPayments] = await Promise.all([
        transaction.get(partyRef),
        transaction.get(transactionsQuery),
        transaction.get(priorPaymentsQuery),
      ]);
      if (!party.exists) throw new HttpsError("not-found", `The selected ${partyType} does not exist in this business.`);
      const outstanding = calculateOutstandingBalance(
        transactions.docs.map((document) => document.data()),
        priorPayments.docs.map((document) => document.data()),
        partyType,
      );
      if (amount > outstanding) throw new HttpsError("failed-precondition", `Payment exceeds the outstanding ${partyType} balance of ${outstanding.toFixed(2)}.`);
      const timestamp = new Date().toISOString();
      const payment = {
        id,
        businessId: uid,
        partyType,
        partyId,
        amount,
        paymentMethod,
        ...(reference ? { reference } : {}),
        ...(note ? { note } : {}),
        createdAt: timestamp,
        createdBy: uid,
      };
      transaction.update(partyRef, { lastPaymentAt: timestamp });
      transaction.create(paymentRef, payment);
      return payment;
    });
  } catch (error) { return callableError(error); }
});

/**
 * Scheduled trusted-backend job. Writes aggregate counts only; never exports
 * tenant IDs, customer names/emails, contact details, products, invoices,
 * payment references, or transaction contents into platform metrics.
 */
export const refreshPlatformMetrics = onSchedule(
  { schedule: "every 1 hours", timeZone: "Africa/Nairobi", region: REGION },
  async () => {
    try {
      const businesses = db.collection("businesses");
      const users = db.collection("users");
      const [businessCount, userCount, activeCount, trialingCount, suspendedCount,
        customerCount, supplierCount, productCount, salesCount, purchaseCount,
        paymentCount, pendingPaymentRequestCount] = await Promise.all([
        businesses.count().get(), users.count().get(),
        businesses.where("subscription.status", "==", "active").count().get(),
        businesses.where("subscription.status", "==", "trialing").count().get(),
        businesses.where("subscription.status", "==", "suspended").count().get(),
        db.collectionGroup("customers").count().get(),
        db.collectionGroup("suppliers").count().get(),
        db.collectionGroup("products").count().get(),
        db.collectionGroup("sales").count().get(),
        db.collectionGroup("purchases").count().get(),
        db.collectionGroup("payments").count().get(),
        db.collectionGroup("subscriptionPaymentRequests").where("status", "==", "pending_review").count().get(),
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
        lastUpdated: FieldValue.serverTimestamp(),
      }, { merge: true });
      logger.info("Platform aggregate metrics refreshed");
    } catch (error) {
      logger.error("Platform metrics refresh failed", { error: error instanceof Error ? error.message : "unknown" });
      await db.doc("platformMetrics/overview").set({ serviceStatus: "degraded", lastUpdated: FieldValue.serverTimestamp() }, { merge: true });
      throw error;
    }
  },
);

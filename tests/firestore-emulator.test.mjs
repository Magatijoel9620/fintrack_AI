import test, { before } from "node:test";
import assert from "node:assert/strict";

const projectId = process.env.GCLOUD_PROJECT || "demo-finai";
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const firestoreBase = `http://${firestoreHost}/v1/projects/${projectId}/databases/(default)/documents`;
const authBase = `http://${authHost}/identitytoolkit.googleapis.com/v1`;
const now = Date.now();
let sequence = 0;

function encodeValue(input) {
  if (input === null) return { nullValue: null };
  if (typeof input === "string") return { stringValue: input };
  if (typeof input === "boolean") return { booleanValue: input };
  if (typeof input === "number") return Number.isInteger(input)
    ? { integerValue: String(input) }
    : { doubleValue: input };
  if (input instanceof Date) return { timestampValue: input.toISOString() };
  if (Array.isArray(input)) return { arrayValue: { values: input.map(encodeValue) } };
  if (typeof input === "object") return { mapValue: { fields: fields(input) } };
  throw new TypeError(`Unsupported Firestore test value: ${String(input)}`);
}

function fields(input) {
  return Object.fromEntries(Object.entries(input).map(([key, item]) => [key, encodeValue(item)]));
}

async function request(url, { method = "GET", token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(url, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const raw = await response.text();
  let parsed;
  try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }
  return { status: response.status, ok: response.ok, data: parsed };
}

async function createUser() {
  const email = `finai-test-${process.pid}-${++sequence}@example.test`;
  const result = await request(`${authBase}/accounts:signUp?key=fake-api-key`, {
    method: "POST",
    body: { email, password: "FinAI-Emulator-Test-Password-2026!", returnSecureToken: true },
  });
  assert.equal(result.ok, true, `Auth emulator sign-up failed: ${JSON.stringify(result.data)}`);
  return { uid: result.data.localId, token: result.data.idToken };
}

function businessDocument(uid, { status = "trialing", trialEnd = new Date(now + 86400000) } = {}) {
  const trialStart = new Date(now - 60000);
  return {
    id: uid,
    name: "FinAI Test Business",
    currency: "KES",
    ownerId: uid,
    createdAt: new Date(now - 60000).toISOString(),
    subscription: {
      planId: status === "active" ? "starter" : "trial",
      status,
      trialStartedAt: trialStart,
      trialEndsAt: trialEnd,
      updatedAt: trialStart,
    },
  };
}

async function createBusiness(user, data = businessDocument(user.uid)) {
  return request(`${firestoreBase}/businesses?documentId=${encodeURIComponent(user.uid)}`, {
    method: "POST", token: user.token, body: { fields: fields(data) },
  });
}

async function seedBusiness(user, data) {
  // The emulator's special owner token bypasses rules for test fixture setup.
  const result = await request(`${firestoreBase}/businesses?documentId=${encodeURIComponent(user.uid)}`, {
    method: "POST", token: "owner", body: { fields: fields(data) },
  });
  assert.equal(result.ok, true, `Admin fixture seed failed: ${JSON.stringify(result.data)}`);
}

async function createProduct(user, id = "product-one") {
  const product = {
    id,
    businessId: user.uid,
    name: "Test Product",
    sku: `SKU-${id}`,
    category: "General",
    unit: "pcs",
    costPrice: 40,
    sellingPrice: 75,
    quantity: 5,
    reorderLevel: 1,
    isActive: true,
    createdAt: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };
  return request(`${firestoreBase}/businesses/${user.uid}/products?documentId=${id}`, {
    method: "POST", token: user.token, body: { fields: fields(product) },
  });
}

async function createSubscriptionPaymentRequest(user) {
  const id = `request-${++sequence}`;
  const requestDoc = {
    businessId: user.uid,
    provider: "mpesa_manual",
    status: "pending_review",
    reference: "QWERTY123456",
    requestedPlan: "starter",
    requestedAmountKes: 500,
  };
  return request(`${firestoreBase}/businesses/${user.uid}/subscriptionPaymentRequests?documentId=${id}`, {
    method: "POST", token: user.token, body: { fields: fields(requestDoc) },
  });
}

before(async () => {
  try {
    await fetch(`http://${firestoreHost}/`);
  } catch {
    throw new Error("Firestore emulator is not reachable. Run npm run test:emulator.");
  }
});

test("owner can provision their UID business and create product/contact records", async () => {
  const owner = await createUser();
  const provisioned = await createBusiness(owner);
  assert.equal(provisioned.ok, true, `Provisioning denied: ${JSON.stringify(provisioned.data)}`);

  const product = await createProduct(owner);
  assert.equal(product.ok, true, `Product create denied: ${JSON.stringify(product.data)}`);

  const contact = {
    id: "customer-one", businessId: owner.uid, name: "Test Customer", balance: 0,
  };
  const customer = await request(`${firestoreBase}/businesses/${owner.uid}/customers?documentId=customer-one`, {
    method: "POST", token: owner.token, body: { fields: fields(contact) },
  });
  assert.equal(customer.ok, true, `Customer create denied: ${JSON.stringify(customer.data)}`);
});

test("owner can update the customer account revision used to coordinate ledger transactions", async () => {
  const owner = await createUser();
  assert.equal((await createBusiness(owner)).ok, true);
  const contact = {
    id: "customer-revision", businessId: owner.uid, name: "Revision Customer", balance: 0,
  };
  const created = await request(`${firestoreBase}/businesses/${owner.uid}/customers?documentId=customer-revision`, {
    method: "POST", token: owner.token, body: { fields: fields(contact) },
  });
  assert.equal(created.ok, true, `Customer fixture create denied: ${JSON.stringify(created.data)}`);

  const update = await request(`${firestoreBase}/businesses/${owner.uid}/customers/customer-revision?updateMask.fieldPaths=accountRevision&updateMask.fieldPaths=lastTransactionAt`, {
    method: "PATCH", token: owner.token,
    body: { fields: { accountRevision: encodeValue(1), lastTransactionAt: encodeValue(new Date(now).toISOString()) } },
  });
  assert.equal(update.ok, true, `Customer account revision update denied: ${JSON.stringify(update.data)}`);
});

test("business creation cannot mint a paid entitlement", async () => {
  const owner = await createUser();
  const paidAtCreation = businessDocument(owner.uid, { status: "active", trialEnd: new Date(now + 86400000) });
  const result = await createBusiness(owner, paidAtCreation);
  assert.equal(result.status, 403, `Expected paid entitlement creation to be denied, got ${result.status}: ${JSON.stringify(result.data)}`);
});


test("owners cannot change subscription entitlements from the client", async () => {
  const owner = await createUser();
  assert.equal((await createBusiness(owner)).ok, true);
  const update = await request(`${firestoreBase}/businesses/${owner.uid}?updateMask.fieldPaths=subscription.status&updateMask.fieldPaths=subscription.planId`, {
    method: "PATCH", token: owner.token,
    body: { fields: { subscription: encodeValue({ planId: "starter", status: "active", trialStartedAt: new Date(now - 86400000), trialEndsAt: new Date(now - 1) }) } },
  });
  assert.equal(update.status, 403, `Client entitlement update unexpectedly returned ${update.status}`);
});

test("owners cannot read or write another UID workspace", async () => {
  const ownerA = await createUser();
  const ownerB = await createUser();
  const provisioned = await createBusiness(ownerA);
  assert.equal(provisioned.ok, true);

  const crossRead = await request(`${firestoreBase}/businesses/${ownerA.uid}`, { token: ownerB.token });
  assert.equal(crossRead.status, 403, `Cross-owner business read unexpectedly returned ${crossRead.status}`);

  const crossWrite = await request(`${firestoreBase}/businesses/${ownerA.uid}/products?documentId=intruder-product`, {
    method: "POST", token: ownerB.token,
    body: { fields: fields({ id: "intruder-product", businessId: ownerA.uid, name: "Intruder", sku: "INTRUDER", category: "General", unit: "pcs", costPrice: 1, sellingPrice: 2, quantity: 0, reorderLevel: 0, isActive: true, createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString() }) },
  });
  assert.equal(crossWrite.status, 403, `Cross-owner product write unexpectedly returned ${crossWrite.status}`);
});

test("an existing mismatched business is not exposed or overwritten during provisioning", async () => {
  const owner = await createUser();
  const mismatched = businessDocument(owner.uid);
  mismatched.id = "different-owner-id";
  mismatched.ownerId = "different-owner-id";
  await seedBusiness(owner, mismatched);

  const read = await request(`${firestoreBase}/businesses/${owner.uid}`, { token: owner.token });
  assert.equal(read.status, 403, `Mismatched business was unexpectedly readable: ${JSON.stringify(read.data)}`);

  const overwrite = await request(`${firestoreBase}/businesses/${owner.uid}?updateMask.fieldPaths=name`, {
    method: "PATCH", token: owner.token, body: { fields: { name: encodeValue("Should not overwrite") } },
  });
  assert.equal(overwrite.status, 403, `Mismatched business should not be overwritten: ${JSON.stringify(overwrite.data)}`);

  const unchanged = await request(`${firestoreBase}/businesses/${owner.uid}`, { token: "owner" });
  assert.equal(unchanged.data?.fields?.id?.stringValue, "different-owner-id");
});

test("expired trial retains reads and subscription requests but business writes are denied", async () => {
  const owner = await createUser();
  const expired = businessDocument(owner.uid, { status: "expired", trialEnd: new Date(now - 86400000) });
  await seedBusiness(owner, expired);

  const read = await request(`${firestoreBase}/businesses/${owner.uid}`, { token: owner.token });
  assert.equal(read.ok, true, `Expired owner should retain reads: ${JSON.stringify(read.data)}`);

  const expiredProduct = {
    id: "existing-product", businessId: owner.uid, name: "Historical Product", sku: "HIST-1",
    category: "General", unit: "pcs", costPrice: 10, sellingPrice: 20, quantity: 2,
    reorderLevel: 0, isActive: true, createdAt: new Date(now - 86400000).toISOString(),
    updatedAt: new Date(now - 86400000).toISOString(),
  };
  const seedProduct = await request(`${firestoreBase}/businesses/${owner.uid}/products?documentId=existing-product`, {
    method: "POST", token: "owner", body: { fields: fields(expiredProduct) },
  });
  assert.equal(seedProduct.ok, true, `Historical product fixture seed failed: ${JSON.stringify(seedProduct.data)}`);
  const historyRead = await request(`${firestoreBase}/businesses/${owner.uid}/products/existing-product`, { token: owner.token });
  assert.equal(historyRead.ok, true, `Expired owner should retain historical record reads: ${JSON.stringify(historyRead.data)}`);

  const profileUpdate = await request(`${firestoreBase}/businesses/${owner.uid}?updateMask.fieldPaths=name`, {
    method: "PATCH", token: owner.token, body: { fields: { name: encodeValue("Updated Business Profile") } },
  });
  assert.equal(profileUpdate.ok, true, `Expired owner should retain profile settings: ${JSON.stringify(profileUpdate.data)}`);

  const budgetUpdate = await request(`${firestoreBase}/businesses/${owner.uid}?updateMask.fieldPaths=monthlyBudget`, {
    method: "PATCH", token: owner.token, body: { fields: { monthlyBudget: encodeValue(12000) } },
  });
  assert.equal(budgetUpdate.status, 403, `Expired owner budget mutation should be denied: ${JSON.stringify(budgetUpdate.data)}`);

  const product = await createProduct(owner, "expired-product");
  assert.equal(product.status, 403, `Expired trial product write unexpectedly returned ${product.status}`);
  const expense = await request(`${firestoreBase}/businesses/${owner.uid}/expenses?documentId=expired-expense`, {
    method: "POST", token: owner.token,
    body: { fields: fields({ id: "expired-expense", amount: 5, merchant: "Test Shop", category: "Other", date: new Date(now).toISOString() }) },
  });
  assert.equal(expense.status, 403, `Expired trial expense write unexpectedly returned ${expense.status}`);

  const paymentRequest = await createSubscriptionPaymentRequest(owner);
  assert.equal(paymentRequest.ok, true, `Expired owner must be able to request subscription: ${JSON.stringify(paymentRequest.data)}`);
});

test("paid-active subscription remains writable after the original trial date", async () => {
  const owner = await createUser();
  await seedBusiness(owner, businessDocument(owner.uid, { status: "active", trialEnd: new Date(now - 86400000) }));

  const product = await createProduct(owner, "paid-product");
  assert.equal(product.ok, true, `Paid-active business should remain writable: ${JSON.stringify(product.data)}`);
});

test("sales, purchases, payments and stock movements are append-only", async () => {
  const owner = await createUser();
  assert.equal((await createBusiness(owner)).ok, true);

  const movement = {
    id: "movement-one", businessId: owner.uid, productId: "product-one", productName: "Test Product",
    type: "opening", quantity: 5, createdAt: new Date(now).toISOString(),
  };
  const createMovement = await request(`${firestoreBase}/businesses/${owner.uid}/stockMovements?documentId=movement-one`, {
    method: "POST", token: owner.token, body: { fields: fields(movement) },
  });
  assert.equal(createMovement.ok, true, `Initial movement should be appendable: ${JSON.stringify(createMovement.data)}`);

  const sale = {
    id: "sale-one", businessId: owner.uid, invoiceNumber: "INV-TEST-1", items: [{ productId: "product-one", productName: "Test Product", quantity: 1, unitPrice: 75, total: 75 }],
    subtotal: 75, discount: 0, tax: 0, total: 75, amountPaid: 75, paymentMethod: "cash",
    createdAt: new Date(now).toISOString(), stockMovementIds: ["movement-sale-one"],
  };
  const createSale = await request(`${firestoreBase}/businesses/${owner.uid}/sales?documentId=sale-one`, {
    method: "POST", token: owner.token, body: { fields: fields(sale) },
  });
  assert.equal(createSale.ok, true, `Sale create should succeed: ${JSON.stringify(createSale.data)}`);

  const purchase = {
    id: "purchase-one", businessId: owner.uid, invoiceNumber: "PUR-TEST-1", items: [{ productId: "product-one", productName: "Test Product", quantity: 1, unitCost: 40, total: 40 }],
    subtotal: 40, discount: 0, tax: 0, total: 40, amountPaid: 40, paymentMethod: "cash",
    createdAt: new Date(now).toISOString(), stockMovementIds: ["movement-purchase-one"],
  };
  const createPurchase = await request(`${firestoreBase}/businesses/${owner.uid}/purchases?documentId=purchase-one`, {
    method: "POST", token: owner.token, body: { fields: fields(purchase) },
  });
  assert.equal(createPurchase.ok, true, `Purchase create should succeed: ${JSON.stringify(createPurchase.data)}`);

  const payment = {
    id: "payment-one", businessId: owner.uid, partyType: "customer", partyId: "customer-one",
    amount: 10, paymentMethod: "cash", createdAt: new Date(now).toISOString(),
  };
  const createPayment = await request(`${firestoreBase}/businesses/${owner.uid}/payments?documentId=payment-one`, {
    method: "POST", token: owner.token, body: { fields: fields(payment) },
  });
  assert.equal(createPayment.ok, true, `Payment create should succeed: ${JSON.stringify(createPayment.data)}`);

  for (const collectionName of ["sales", "purchases", "payments"]) {
    const update = await request(`${firestoreBase}/businesses/${owner.uid}/${collectionName}/${collectionName === "sales" ? "sale-one" : collectionName === "purchases" ? "purchase-one" : "payment-one"}?updateMask.fieldPaths=total`, {
      method: "PATCH", token: owner.token, body: { fields: { total: encodeValue(1) } },
    });
    assert.equal(update.status, 403, `Posted ${collectionName} update unexpectedly returned ${update.status}`);
  }

  const deleteMovement = await request(`${firestoreBase}/businesses/${owner.uid}/stockMovements/movement-one`, {
    method: "DELETE", token: owner.token,
  });
  assert.equal(deleteMovement.status, 403, `Stock movement delete unexpectedly returned ${deleteMovement.status}`);
});

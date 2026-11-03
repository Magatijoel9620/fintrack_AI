import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  calculateTotals,
  calculateOutstandingBalance,
  validatePaymentAmount,
  validatePaymentMethod,
  calculateStockDelta,
} = require("../functions/src/financial-integrity.js");

test("sale totals are recomputed from unit prices and quantities", () => {
  const totals = calculateTotals({
    items: [
      { productId: "p1", quantity: 2, unitPrice: 125.5 },
      { productId: "p2", quantity: 3, unitPrice: 40 },
    ],
    priceField: "unitPrice",
    discount: 10,
    taxRate: 16,
    amountPaid: 418.76,
  });
  assert.equal(totals.subtotal, 371);
  assert.equal(totals.discount, 10);
  assert.equal(totals.tax, 57.76);
  assert.equal(totals.total, 418.76);
  assert.equal(totals.balance, 0);
});

test("purchase totals support fractional quantities and a discount", () => {
  const totals = calculateTotals({
    items: [{ productId: "p1", quantity: 1.25, unitCost: 80 }],
    priceField: "unitCost",
    discount: 5,
    taxRate: 0,
    amountPaid: 20,
  });
  assert.equal(totals.subtotal, 100);
  assert.equal(totals.discount, 5);
  assert.equal(totals.total, 95);
  assert.equal(totals.balance, 75);
});

test("invalid monetary inputs including NaN and Infinity are rejected", () => {
  for (const bad of [NaN, Infinity, -Infinity, -0.01, "10", null]) {
    assert.throws(() => calculateTotals({
      items: [{ productId: "p1", quantity: 1, unitPrice: bad }],
      priceField: "unitPrice",
    }));
  }
});

test("zero, negative and non-finite quantities are rejected", () => {
  for (const quantity of [0, -1, NaN, Infinity, "2"]) {
    assert.throws(() => calculateTotals({
      items: [{ productId: "p1", quantity, unitPrice: 100 }],
      priceField: "unitPrice",
    }));
  }
});

test("discount cannot exceed subtotal and tax rate is bounded", () => {
  assert.throws(() => calculateTotals({
    items: [{ productId: "p1", quantity: 1, unitPrice: 100 }],
    priceField: "unitPrice", discount: 101,
  }), /Discount cannot exceed/);
  assert.throws(() => calculateTotals({
    items: [{ productId: "p1", quantity: 1, unitPrice: 100 }],
    priceField: "unitPrice", taxRate: 100.01,
  }), /Tax rate/);
});

test("payment cannot exceed the recomputed invoice total", () => {
  assert.throws(() => calculateTotals({
    items: [{ productId: "p1", quantity: 1, unitPrice: 100 }],
    priceField: "unitPrice", amountPaid: 100.01,
  }), /Amount paid cannot exceed/);
});

test("payments must be finite and strictly positive", () => {
  for (const amount of [0, -1, NaN, Infinity, "100"]) assert.throws(() => validatePaymentAmount(amount));
  assert.equal(validatePaymentAmount(10.126), 10.13);
});

test("only supported payment methods are accepted", () => {
  for (const method of ["cash", "mpesa", "card", "credit", "other"]) assert.equal(validatePaymentMethod(method), method);
  assert.throws(() => validatePaymentMethod("crypto"));
});


test("computed transaction values cannot exceed the supported currency range", () => {
  assert.throws(() => calculateTotals({
    items: [{ productId: "p1", quantity: 1_000_000_000, unitPrice: 1_000_000_000_000 }],
    priceField: "unitPrice",
  }), /supported range/);
});

test("sub-cent amounts cannot be recorded as zero-value payments", () => {
  assert.throws(() => validatePaymentAmount(0.001), /at least one cent/);
});


test("customer and supplier allocations reduce outstanding balances by party type", () => {
  const transactions = [
    { total: 250, amountPaid: 100 },
    { total: 100, amountPaid: 0 },
  ];
  const payments = [
    { partyType: "customer", amount: 50 },
    { partyType: "supplier", amount: 25 },
  ];
  assert.equal(calculateOutstandingBalance(transactions, payments, "customer"), 200);
  assert.equal(calculateOutstandingBalance(transactions, payments, "supplier"), 225);
});

test("account balance rejects corrupt historical amounts", () => {
  assert.throws(() => calculateOutstandingBalance([{ total: Infinity }], [], "customer"));
  assert.throws(() => calculateOutstandingBalance([{ total: 100 }], [{ partyType: "customer", amount: -1 }], "customer"));
});


test("stock movement deltas follow the defined movement direction", () => {
  assert.equal(calculateStockDelta("stock-in", 3), 3);
  assert.equal(calculateStockDelta("return", 2), 2);
  assert.equal(calculateStockDelta("opening", 4), 4);
  assert.equal(calculateStockDelta("stock-out", 1), -1);
  assert.equal(calculateStockDelta("adjustment", 1.5), -1.5);
  assert.equal(calculateStockDelta("damage", 2), -2);
});

test("stock movement quantity and type are validated", () => {
  for (const quantity of [0, -1, NaN, Infinity, "3"]) {
    assert.throws(() => calculateStockDelta("stock-in", quantity));
  }
  assert.throws(() => calculateStockDelta("unsupported", 1), /type is invalid/);
});

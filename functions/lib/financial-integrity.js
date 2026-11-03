'use strict';
const MAX_MONEY = 1_000_000_000_000;
const MAX_QUANTITY = 1_000_000_000;
const MAX_LINE_ITEMS = 100;
const PAYMENT_METHODS = new Set(['cash', 'mpesa', 'card', 'credit', 'other']);
class IntegrityError extends Error {
    constructor(message) { super(message); this.name = 'IntegrityError'; }
}
function fail(message) {
    throw new IntegrityError(message);
}
function finiteNumber(value, label, min = 0, max = MAX_MONEY) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
        fail(`${label} must be a finite number between ${min} and ${max}.`);
    }
    return value;
}
function roundMoney(value) {
    if (!Number.isFinite(value) || Math.abs(value) > MAX_MONEY)
        fail('A monetary calculation exceeds the supported range.');
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
function assertId(value, label = 'Record ID') {
    if (typeof value !== 'string' || value.length < 1 || value.length > 128 || !/^[A-Za-z0-9_-]+$/.test(value)) {
        fail(`${label} is invalid.`);
    }
    return value;
}
function assertText(value, label, max = 160, required = true) {
    if (typeof value !== 'string') {
        if (!required && (value === undefined || value === null || value === ''))
            return undefined;
        fail(`${label} is required.`);
    }
    const clean = value.trim();
    if ((!clean && required) || clean.length > max)
        fail(`${label} must contain between ${required ? 1 : 0} and ${max} characters.`);
    return clean || undefined;
}
function validatePaymentMethod(value) {
    if (typeof value !== 'string' || !PAYMENT_METHODS.has(value))
        fail('Payment method is invalid.');
    return value;
}
/** Calculate line totals and invoice totals from validated unit values. */
function calculateTotals({ items, priceField, discount = 0, taxRate = 0, amountPaid = 0 }) {
    if (!Array.isArray(items) || items.length < 1 || items.length > MAX_LINE_ITEMS) {
        fail(`A transaction must contain between 1 and ${MAX_LINE_ITEMS} items.`);
    }
    if (!['unitPrice', 'unitCost'].includes(priceField))
        fail('Transaction price field is invalid.');
    const normalizedItems = items.map((item, index) => {
        if (!item || typeof item !== 'object')
            fail(`Item ${index + 1} is invalid.`);
        const productId = assertId(item.productId, `Item ${index + 1} product`);
        const quantity = finiteNumber(item.quantity, `Item ${index + 1} quantity`, Number.MIN_VALUE, MAX_QUANTITY);
        const unitValue = roundMoney(finiteNumber(item[priceField], `Item ${index + 1} ${priceField}`));
        const total = roundMoney(quantity * unitValue);
        return { productId, quantity, [priceField]: unitValue, total };
    });
    const subtotal = roundMoney(normalizedItems.reduce((sum, item) => sum + item.total, 0));
    const normalizedDiscount = roundMoney(finiteNumber(discount, 'Discount'));
    if (normalizedDiscount > subtotal)
        fail('Discount cannot exceed the transaction subtotal.');
    const normalizedTaxRate = finiteNumber(taxRate, 'Tax rate', 0, 100);
    const taxableAmount = roundMoney(subtotal - normalizedDiscount);
    const tax = roundMoney(taxableAmount * normalizedTaxRate / 100);
    const total = roundMoney(taxableAmount + tax);
    const normalizedAmountPaid = roundMoney(finiteNumber(amountPaid, 'Amount paid'));
    if (normalizedAmountPaid > total)
        fail('Amount paid cannot exceed the transaction total.');
    return {
        items: normalizedItems,
        subtotal,
        discount: normalizedDiscount,
        taxRate: normalizedTaxRate,
        tax,
        total,
        amountPaid: normalizedAmountPaid,
        balance: roundMoney(total - normalizedAmountPaid),
    };
}
function calculateOutstandingBalance(transactionRecords, paymentRecords, partyType) {
    if (!Array.isArray(transactionRecords) || !Array.isArray(paymentRecords))
        fail('Account history is invalid.');
    if (partyType !== 'customer' && partyType !== 'supplier')
        fail('Account party type is invalid.');
    const billed = transactionRecords.reduce((sum, record) => sum + finiteNumber(record.total, 'Existing transaction total'), 0);
    const upfront = transactionRecords.reduce((sum, record) => sum + finiteNumber(record.amountPaid ?? 0, 'Existing amount paid'), 0);
    const allocated = paymentRecords
        .filter((record) => record.partyType === partyType)
        .reduce((sum, record) => sum + finiteNumber(record.amount, 'Existing account payment'), 0);
    return roundMoney(Math.max(0, billed - upfront - allocated));
}
function validatePaymentAmount(amount) {
    const rounded = roundMoney(finiteNumber(amount, 'Payment amount', Number.EPSILON));
    if (rounded <= 0)
        fail('Payment amount must be at least one cent.');
    return rounded;
}
function calculateStockDelta(type, quantity) {
    const amount = finiteNumber(quantity, 'Stock movement quantity', Number.MIN_VALUE, MAX_QUANTITY);
    const positiveTypes = new Set(['stock-in', 'purchase', 'return', 'opening']);
    const negativeTypes = new Set(['stock-out', 'adjustment', 'damage']);
    if (!positiveTypes.has(type) && !negativeTypes.has(type))
        fail('Stock movement type is invalid.');
    return positiveTypes.has(type) ? amount : -amount;
}
module.exports = {
    MAX_LINE_ITEMS,
    IntegrityError,
    calculateTotals,
    assertId,
    assertText,
    finiteNumber,
    roundMoney,
    calculateOutstandingBalance,
    validatePaymentAmount,
    validatePaymentMethod,
    calculateStockDelta,
};

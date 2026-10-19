import { AccountPayment, Customer, Product, Purchase, Sale, Supplier } from "@/types";

export type LedgerEntry = {
  id: string;
  date: string;
  type: "sale" | "purchase" | "customer-payment" | "supplier-payment";
  reference: string;
  party: string;
  debit: number;
  credit: number;
  cashIn: number;
  cashOut: number;
  description: string;
};

export type FinancialSummary = {
  grossSales: number;
  salesTax: number;
  netSales: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;
  purchases: number;
  purchaseTax: number;
  customerReceivables: number;
  supplierPayables: number;
  customerCollections: number;
  supplierPayments: number;
  cashIn: number;
  cashOut: number;
  netCashFlow: number;
  inventoryValue: number;
};

const paidFor = (sale: Sale, payments: AccountPayment[]) =>
  Math.max(0, Number(sale.amountPaid || 0)) + payments.filter(p => p.partyType === "customer" && p.partyId === sale.customerId).reduce((a, p) => a + p.amount, 0);

export function saleCOGS(sale: Sale, products: Product[]) {
  return sale.items.reduce((sum, item) => {
    const cost = Number(item.unitCost ?? products.find(p => p.id === item.productId)?.costPrice ?? 0);
    return sum + item.quantity * cost;
  }, 0);
}

export function customerBalance(customer: Customer, sales: Sale[], payments: AccountPayment[]) {
  const invoiced = sales.filter(s => s.customerId === customer.id).reduce((a, s) => a + s.total, 0);
  const creditedAtSale = sales.filter(s => s.customerId === customer.id).reduce((a, s) => a + Number(s.amountPaid || 0), 0);
  const laterPayments = payments.filter(p => p.partyType === "customer" && p.partyId === customer.id).reduce((a, p) => a + p.amount, 0);
  return Math.max(0, invoiced - creditedAtSale - laterPayments);
}

export function supplierBalance(supplier: Supplier, purchases: Purchase[], payments: AccountPayment[]) {
  const invoiced = purchases.filter(p => p.supplierId === supplier.id).reduce((a, p) => a + p.total, 0);
  const paidAtPurchase = purchases.filter(p => p.supplierId === supplier.id).reduce((a, p) => a + Number(p.amountPaid || 0), 0);
  const laterPayments = payments.filter(p => p.partyType === "supplier" && p.partyId === supplier.id).reduce((a, p) => a + p.amount, 0);
  return Math.max(0, invoiced - paidAtPurchase - laterPayments);
}

export function buildLedger(sales: Sale[], purchases: Purchase[], payments: AccountPayment[], customers: Customer[], suppliers: Supplier[]): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  for (const sale of sales) {
    const customer = customers.find(c => c.id === sale.customerId)?.name || "Walk-in Customer";
    const paid = Number(sale.amountPaid || 0);
    entries.push({ id: `sale-${sale.id}`, date: sale.createdAt, type: "sale", reference: sale.invoiceNumber, party: customer, debit: sale.total, credit: 0, cashIn: paid, cashOut: 0, description: `Sale to ${customer}` });
  }
  for (const purchase of purchases) {
    const supplier = suppliers.find(s => s.id === purchase.supplierId)?.name || "Unspecified Supplier";
    const paid = Number(purchase.amountPaid || 0);
    entries.push({ id: `purchase-${purchase.id}`, date: purchase.createdAt, type: "purchase", reference: purchase.invoiceNumber, party: supplier, debit: 0, credit: purchase.total, cashIn: 0, cashOut: paid, description: `Purchase from ${supplier}` });
  }
  for (const payment of payments) {
    const party = payment.partyType === "customer" ? customers.find(c => c.id === payment.partyId)?.name : suppliers.find(s => s.id === payment.partyId)?.name;
    const incoming = payment.partyType === "customer";
    entries.push({ id: `payment-${payment.id}`, date: payment.createdAt, type: incoming ? "customer-payment" : "supplier-payment", reference: payment.reference || payment.id.slice(0, 8), party: party || "Unknown", debit: incoming ? payment.amount : 0, credit: incoming ? 0 : payment.amount, cashIn: incoming ? payment.amount : 0, cashOut: incoming ? 0 : payment.amount, description: `${incoming ? "Customer collection" : "Supplier payment"}${payment.note ? ` — ${payment.note}` : ""}` });
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

export function summarize(sales: Sale[], purchases: Purchase[], payments: AccountPayment[], products: Product[], customers: Customer[], suppliers: Supplier[]): FinancialSummary {
  const grossSales = sales.reduce((a, s) => a + s.total, 0);
  const salesTax = sales.reduce((a, s) => a + s.tax, 0);
  const netSales = grossSales - salesTax;
  const cogs = sales.reduce((a, s) => a + saleCOGS(s, products), 0);
  const purchasesTotal = purchases.reduce((a, p) => a + p.total, 0);
  const purchaseTax = purchases.reduce((a, p) => a + p.tax, 0);
  const customerReceivables = customers.reduce((a, c) => a + customerBalance(c, sales, payments), 0);
  const supplierPayables = suppliers.reduce((a, s) => a + supplierBalance(s, purchases, payments), 0);
  const customerCollections = sales.reduce((a, s) => a + Number(s.amountPaid || 0), 0) + payments.filter(p => p.partyType === "customer").reduce((a, p) => a + p.amount, 0);
  const supplierPayments = purchases.reduce((a, p) => a + Number(p.amountPaid || 0), 0) + payments.filter(p => p.partyType === "supplier").reduce((a, p) => a + p.amount, 0);
  const cashIn = sales.reduce((a, s) => a + Number(s.amountPaid || 0), 0) + payments.filter(p => p.partyType === "customer").reduce((a, p) => a + p.amount, 0);
  const cashOut = purchases.reduce((a, p) => a + Number(p.amountPaid || 0), 0) + payments.filter(p => p.partyType === "supplier").reduce((a, p) => a + p.amount, 0);
  const grossProfit = netSales - cogs;
  return { grossSales, salesTax, netSales, cogs, grossProfit, grossMargin: netSales ? grossProfit / netSales * 100 : 0, purchases: purchasesTotal, purchaseTax, customerReceivables, supplierPayables, customerCollections, supplierPayments, cashIn, cashOut, netCashFlow: cashIn - cashOut, inventoryValue: products.reduce((a, p) => a + p.quantity * p.costPrice, 0) };
}

export function paymentMethodTotals(sales: Sale[], purchases: Purchase[], payments: AccountPayment[]) {
  const methods = ["cash", "mpesa", "card", "other"] as const;
  return methods.map(method => ({
    method,
    salesIn: sales.filter(s => s.paymentMethod === method).reduce((a, s) => a + Number(s.amountPaid || 0), 0),
    customerCollections: payments.filter(p => p.partyType === "customer" && p.paymentMethod === method).reduce((a, p) => a + p.amount, 0),
    purchaseOut: purchases.filter(p => p.paymentMethod === method).reduce((a, p) => a + Number(p.amountPaid || 0), 0),
    supplierPayments: payments.filter(p => p.partyType === "supplier" && p.paymentMethod === method).reduce((a, p) => a + p.amount, 0),
  }));
}

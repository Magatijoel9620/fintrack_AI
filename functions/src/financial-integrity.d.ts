type Totals<TItem> = {
  items: Array<TItem & { total: number }>;
  subtotal: number;
  discount: number;
  taxRate: number;
  tax: number;
  total: number;
  amountPaid: number;
  balance: number;
};
type TotalsOptions = { discount?: number; taxRate?: number; amountPaid?: number };
export class IntegrityError extends Error {}
export function calculateTotals(input: TotalsOptions & { items: Array<{ productId: string; quantity: number; unitPrice: number }>; priceField: 'unitPrice' }): Totals<{ productId: string; quantity: number; unitPrice: number }>;
export function calculateTotals(input: TotalsOptions & { items: Array<{ productId: string; quantity: number; unitCost: number }>; priceField: 'unitCost' }): Totals<{ productId: string; quantity: number; unitCost: number }>;
export function assertId(value: unknown, label?: string): string;
export function assertText(value: unknown, label: string, max?: number, required?: boolean): string | undefined;
export function finiteNumber(value: unknown, label: string, min?: number, max?: number): number;
export function roundMoney(value: number): number;
export function calculateOutstandingBalance(transactionRecords: Array<Record<string, unknown>>, paymentRecords: Array<Record<string, unknown>>, partyType: "customer" | "supplier"): number;
export function validatePaymentAmount(value: unknown): number;
export function validatePaymentMethod(value: unknown): string;

export function calculateStockDelta(type: string, quantity: number): number;

export type Currency = "KES" | "USD" | "EUR" | "GBP" | "JPY";
export const CURRENCY_SYMBOLS: Record<Currency, string> = { KES: "KSh", USD: "$", EUR: "€", GBP: "£", JPY: "¥" };
export type Unit = "pcs" | "kg" | "g" | "litres" | "boxes" | "cartons" | "dozens" | "metres";
export type StockMovementType = "opening" | "purchase" | "sale" | "stock-in" | "stock-out" | "adjustment" | "return" | "damage";
export type PaymentMethod = "cash" | "mpesa" | "card" | "credit" | "other";

export type Expense = {
  id: string;
  amount: number;
  merchant: string;
  category: string;
  date: string;
};

export type Product = {
  id: string; businessId: string; name: string; sku: string; barcode?: string;
  category: string; supplierId?: string; unit: Unit; costPrice: number; sellingPrice: number;
  quantity: number; reorderLevel: number; description?: string; imageUrl?: string;
  isActive: boolean; createdAt: string; updatedAt: string;
};
export type Supplier = { id: string; businessId: string; name: string; phone?: string; email?: string; address?: string; balance: number; createdAt: string };
export type Customer = { id: string; businessId: string; name: string; phone?: string; email?: string; balance: number; createdAt: string };
export type StockMovement = { id: string; businessId: string; productId: string; productName: string; type: StockMovementType; quantity: number; reference?: string; note?: string; unitCost?: number; createdAt: string; createdBy?: string };
export type SaleItem = { productId: string; productName: string; quantity: number; unitPrice: number; total: number; unitCost?: number };
export type Sale = { id: string; businessId: string; invoiceNumber: string; customerId?: string; items: SaleItem[]; subtotal: number; discount: number; tax: number; total: number; paymentMethod: PaymentMethod; amountPaid: number; createdAt: string };
export type PurchaseItem = { productId: string; productName: string; quantity: number; unitCost: number; total: number };
export type Purchase = { id: string; businessId: string; invoiceNumber: string; supplierId?: string; items: PurchaseItem[]; subtotal: number; tax: number; total: number; paymentMethod?: PaymentMethod; amountPaid?: number; createdAt: string };
export type AccountPayment = { id: string; businessId: string; partyType: "customer" | "supplier"; partyId: string; amount: number; paymentMethod: PaymentMethod; reference?: string; note?: string; createdAt: string; createdBy?: string };

export type BusinessSubscription = { planId: "trial" | "starter" | "growth" | "business"; status: "trialing" | "active" | "past_due" | "suspended" | "expired"; trialStartedAt?: { toDate?: () => Date } | string; trialEndsAt?: { toDate?: () => Date } | string; currentPeriodEnd?: { toDate?: () => Date } | string; updatedAt?: unknown };
export type Business = { id: string; name: string; currency: Currency; ownerId: string; createdAt: string; phone?: string; email?: string; address?: string; taxNumber?: string; logoUrl?: string; subscription?: BusinessSubscription };

export const DEFAULT_CATEGORIES = ["Electronics", "Office", "Home", "Food", "Clothing", "Hardware", "Other"];

"use client";

import { usePathname } from "next/navigation";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  collection,
  deleteField,
  Timestamp,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  setDoc,
  writeBatch,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { businessWritesAllowed } from "@/lib/subscription-policy.mjs";
import {
  calculateTotals,
  calculateOutstandingBalance,
  calculateStockDelta,
  validatePaymentAmount,
  validatePaymentMethod,
  roundMoney,
} from "@/lib/financial-integrity.mjs";
import { useAuth } from "@/context/auth-context";
import {
  Business,
  Customer,
  Product,
  Purchase,
  Sale,
  StockMovement,
  AccountPayment,
  Supplier,
  Currency,
  CURRENCY_SYMBOLS,
  DEFAULT_CATEGORIES,
} from "@/types";
import { useToast } from "@/hooks/use-toast";

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const LOCAL_KEY = (businessId: string) => `inventory-tracker:${businessId || "guest"}:v1`;

function readAccountRevision(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

// Firebase rejects `undefined` fields unless the Firestore instance opts into
// ignoreUndefinedProperties. UI forms intentionally use undefined for blank
// optional fields (barcode, phone, email, reference), so strip those fields
// before sending plain records to Firestore while preserving Timestamp/Date.
function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripUndefined(item)) as T;
  if (value !== null && typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype === Object.prototype || prototype === null) {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, item]) => item !== undefined)
          .map(([key, item]) => [key, stripUndefined(item)]),
      ) as T;
    }
  }
  return value;
}

type State = {
  business: Business;
  products: Product[];
  suppliers: Supplier[];
  customers: Customer[];
  movements: StockMovement[];
  sales: Sale[];
  purchases: Purchase[];
  payments: AccountPayment[];
};

function emptyState(): State {
  const createdAt = now();
  return {
    business: {
      id: "",
      name: "My Business",
      currency: "KES",
      ownerId: "",
      createdAt,
    },
    products: [],
    suppliers: [],
    customers: [],
    movements: [],
    sales: [],
    purchases: [],
    payments: [],
  };
}

interface InventoryContextValue extends State {
  loading: boolean;
  categories: string[];
  currencySymbol: string;
  addProduct: (
    p: Omit<Product, "id" | "businessId" | "createdAt" | "updatedAt">,
  ) => Promise<Product>;
  updateProduct: (p: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  adjustStock: (
    productId: string,
    quantity: number,
    type: StockMovement["type"],
    note?: string,
    reference?: string,
  ) => Promise<void>;
  recordSale: (sale: {
    invoiceNumber: string; customerId?: string;
    items: Array<{ productId: string; productName: string; quantity: number; unitPrice: number }>;
    subtotal: number; discount: number; taxRate: number;
    paymentMethod: Sale["paymentMethod"]; amountPaid: number;
  }) => Promise<Sale>;
  recordPurchase: (purchase: {
    invoiceNumber: string; supplierId?: string;
    items: Array<{ productId: string; productName: string; quantity: number; unitCost: number }>;
    subtotal: number; discount: number; taxRate: number;
    paymentMethod: Purchase["paymentMethod"]; amountPaid: number;
  }) => Promise<Purchase>;
  addSupplier: (
    s: Omit<Supplier, "id" | "businessId" | "createdAt">,
  ) => Promise<void>;
  addCustomer: (
    c: Omit<Customer, "id" | "businessId" | "createdAt">,
  ) => Promise<void>;
  payments: AccountPayment[];
  recordAccountPayment: (
    payment: Omit<AccountPayment, "id" | "businessId" | "createdAt">,
  ) => Promise<void>;
  setCurrency: (currency: Currency) => Promise<void>;
  updateBusiness: (
    patch: Partial<
      Pick<
        Business,
        "name" | "phone" | "email" | "address" | "taxNumber" | "logoUrl" | "currency"
      >
    >,
  ) => Promise<void>;
}

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const { toast } = useToast();
  const [state, setState] = useState<State>(emptyState());
  const [loading, setLoading] = useState(true);
  const businessId = user?.uid ?? "";
  const firebaseMode = Boolean(db && user);

  // Never let one account's previous in-memory records flash in another workspace.
  useEffect(() => {
    setState(emptyState());
  }, [businessId]);

  // No local/demo data mode: authenticated Firestore is the source of truth.
  useEffect(() => {
    if (!user || firebaseMode) {
      if (!user) setLoading(false);
      return;
    }
  }, [user, firebaseMode]);

  // Restore local workspace data when cloud mode is unavailable. Previously the
  // app wrote local data but never hydrated it, so a refresh looked like data loss.
  useEffect(() => {
    if (firebaseMode || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(LOCAL_KEY(businessId));
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<State>;
        setState((current) => ({
          ...current,
          ...parsed,
          business: { ...current.business, ...(parsed.business ?? {}) },
          products: Array.isArray(parsed.products) ? parsed.products : [],
          suppliers: Array.isArray(parsed.suppliers) ? parsed.suppliers : [],
          customers: Array.isArray(parsed.customers) ? parsed.customers : [],
          movements: Array.isArray(parsed.movements) ? parsed.movements : [],
          sales: Array.isArray(parsed.sales) ? parsed.sales : [],
          purchases: Array.isArray(parsed.purchases) ? parsed.purchases : [],
          payments: Array.isArray(parsed.payments) ? parsed.payments : [],
        }));
      } else {
        setState(emptyState());
      }
    } catch (error) {
      console.error("Local inventory restore failed", error);
      setState(emptyState());
      toast({ variant: "destructive", title: "Local data could not be restored", description: "Stored workspace data could not be read in this browser." });
    }
    setLoading(false);
  }, [firebaseMode, businessId, toast]);

  // Firebase becomes the source of truth for authenticated users.
  useEffect(() => {
    const firestore = db;
    if (pathname?.startsWith("/platform-admin")) {
      setLoading(false);
      return;
    }
    if (!firebaseMode || !firestore || !user) return;
    let cancelled = false;
    setLoading(true);

    const businessRef = doc(firestore, "businesses", businessId);
    let initializationStage = "provisioning business workspace";
    const seedBusiness = async () => {
      // The signed-in UID is the business ID. Provisioning is a narrowly
      // authorized Firestore create, so ordinary workspace setup works on Spark.
      // The transaction prevents two simultaneous first logins from overwriting
      // an existing profile or resetting its trial.
      await runTransaction(firestore, async (tx) => {
        const existing = await tx.get(businessRef);
        if (existing.exists()) {
          const data = existing.data() as Partial<Business>;
          if (data.id !== user.uid || data.ownerId !== user.uid) {
            throw new Error("The existing business record does not belong to this account. No data was changed.");
          }
          return;
        }
        initializationStage = "creating new business record";
        const trialStartedAt = Timestamp.now();
        const trialEndsAt = Timestamp.fromMillis(trialStartedAt.toMillis() + 21 * 24 * 60 * 60 * 1000);
        tx.set(businessRef, {
          id: user.uid,
          name: user.displayName ? `${user.displayName.trim().slice(0, 80)}'s Business` : "My Business",
          currency: "KES",
          ownerId: user.uid,
          createdAt: now(),
          subscription: {
            planId: "trial",
            status: "trialing",
            trialStartedAt,
            trialEndsAt,
            updatedAt: trialStartedAt,
          },
        });
      });
    };

    const unsubscribers: (() => void)[] = [];
    (async () => {
      try {
        await seedBusiness();
        if (cancelled) return;
        unsubscribers.push(
          onSnapshot(
            businessRef,
            (snap) => {
              if (!snap.exists() || cancelled) return;
              const data = snap.data() as Business;
              setState((s) => ({
                ...s,
                business: {
                  ...s.business,
                  ...data,
                  id: businessId,
                  ownerId: user.uid,
                },
              }));
              setLoading(false);
            },
            (err) => {
              console.error("Failed to sync business snapshot", { code: err.code, message: err.message });
              setLoading(false);
              toast({ variant: "destructive", title: "Business sync failed", description: err.code === "permission-denied" ? "Firestore denied access to this business record. Verify that the business document ID matches your signed-in account and that the latest rules are deployed." : "The business record could not be synchronized. Check your connection and retry." });
            },
          ),
        );

        const read = <T,>(
          name: string,
          mapper: (data: Record<string, unknown>) => T,
        ) =>
          onSnapshot(
            collection(firestore, "businesses", businessId, name),
            (snap) => {
              if (cancelled) return;
              const values = snap.docs.map((d) =>
                mapper({ ...d.data(), id: d.id }),
              );
              setState((s) => ({ ...s, [name]: values }) as State);
              setLoading(false);
            },
            (err) => {
              console.error(`Failed to sync ${name} collection`, { code: err.code, message: err.message });
              setLoading(false);
              toast({ variant: "destructive", title: `${name} sync failed`, description: err.code === "permission-denied" ? `Firestore denied access to ${name}. Verify that the signed-in account owns this workspace and that the latest rules are deployed.` : `The ${name} collection could not be synchronized. Check your connection and retry.` });
            },
          );

        unsubscribers.push(
          read<Product>("products", (d) => d as unknown as Product),
        );
        unsubscribers.push(
          read<Supplier>("suppliers", (d) => d as unknown as Supplier),
        );
        unsubscribers.push(
          read<Customer>("customers", (d) => d as unknown as Customer),
        );
        unsubscribers.push(
          read<StockMovement>(
            "stockMovements",
            (d) => d as unknown as StockMovement,
          ),
        );
        unsubscribers.push(read<Sale>("sales", (d) => d as unknown as Sale));
        unsubscribers.push(
          read<Purchase>("purchases", (d) => d as unknown as Purchase),
        );
        unsubscribers.push(
          read<AccountPayment>(
            "payments",
            (d) => d as unknown as AccountPayment,
          ),
        );
      } catch (e) {
        const errorDetails =
          typeof e === "object" && e !== null
            ? (e as { code?: unknown; message?: unknown })
            : undefined;
        const code =
          typeof errorDetails?.code === "string" ? errorDetails.code : "unknown";
        const message =
          typeof errorDetails?.message === "string"
            ? errorDetails.message
            : e instanceof Error
              ? e.message
              : "Unknown error";
        console.error(`Firebase initialization failed during ${initializationStage}`, {
          code,
          message,
        });
        toast({
          variant: "destructive",
          title: `Cloud sync failed: ${initializationStage}`,
          description: code === "permission-denied"
            ? "Firestore denied this operation. Check workspace ownership and the deployed rules; no existing business profile was overwritten."
            : message === "Unknown error" ? "Please retry or contact support with the operation shown here." : message,
        });
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      unsubscribers.forEach((unsub) => unsub());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseMode, businessId, user, pathname]);

  const persistLocal = useCallback(
    (next: State) => {
      if (!firebaseMode && typeof window !== "undefined")
        localStorage.setItem(LOCAL_KEY(businessId), JSON.stringify(next));
    },
    [firebaseMode, businessId],
  );

  const assertBusinessWriteAccess = useCallback(() => {
    if (!firebaseMode || businessWritesAllowed(state.business.subscription)) return;
    throw new Error("Your free trial has ended. Your existing records remain available, but business changes are paused until you subscribe to a plan.");
  }, [firebaseMode, state.business.subscription]);

  const addProduct = useCallback(
    async (input: Omit<Product, "id" | "businessId" | "createdAt" | "updatedAt">) => {
      assertBusinessWriteAccess();
      if (!input.name?.trim() || !input.sku?.trim()) throw new Error("Product name and SKU are required.");
      if (![input.costPrice, input.sellingPrice, input.quantity, input.reorderLevel].every((n) => Number.isFinite(n) && n >= 0)) throw new Error("Prices, stock and reorder level must be valid non-negative numbers.");
      const normalizedSku = input.sku.trim();
      if (state.products.some((item) => item.sku.trim().toLowerCase() === normalizedSku.toLowerCase())) throw new Error("That SKU already exists. Use a unique SKU.");
      if (input.barcode?.trim() && state.products.some((item) => item.barcode?.trim() === input.barcode?.trim())) throw new Error("That barcode is already assigned to another product.");
      const productId = uid();
      const createdAt = now();
      const movement: StockMovement | null = input.quantity > 0 ? {
        id: uid(), businessId, productId, productName: input.name.trim(),
        type: "opening", quantity: input.quantity, reference: "Opening stock",
        createdAt, createdBy: user?.uid,
      } : null;
      const product: Product & { lastStockMovementId?: string } = {
        ...input, name: input.name.trim(), sku: normalizedSku,
        id: productId, businessId, createdAt, updatedAt: createdAt,
        ...(movement ? { lastStockMovementId: movement.id } : {}),
      };
      const firestore = db;
      if (firebaseMode && firestore) {
        const batch = writeBatch(firestore);
        batch.set(doc(firestore, "businesses", businessId, "products", product.id), stripUndefined(product));
        if (movement) batch.set(doc(firestore, "businesses", businessId, "stockMovements", movement.id), stripUndefined(movement));
        await batch.commit();
      } else {
        setState((current) => {
          const next = { ...current, products: [product, ...current.products], movements: movement ? [movement, ...current.movements] : current.movements };
          persistLocal(next);
          return next;
        });
      }
      toast({ title: "Product added", description: `${product.name} is now in your inventory.` });
      return product;
    },
    [assertBusinessWriteAccess, businessId, firebaseMode, persistLocal, state.products, toast, user?.uid],
  );

  const updateProduct = useCallback(
    async (product: Product) => {
      assertBusinessWriteAccess();
      if (!product.id || !product.name?.trim() || !product.sku?.trim()) throw new Error("Product name and SKU are required.");
      if (![product.costPrice, product.sellingPrice, product.quantity, product.reorderLevel].every((n) => Number.isFinite(n) && n >= 0)) throw new Error("Prices, stock and reorder level must be valid non-negative numbers.");
      if (state.products.some((item) => item.id !== product.id && item.sku.trim().toLowerCase() === product.sku.trim().toLowerCase())) throw new Error("That SKU already exists. Use a unique SKU.");
      if (product.barcode?.trim() && state.products.some((item) => item.id !== product.id && item.barcode?.trim() === product.barcode?.trim())) throw new Error("That barcode is already assigned to another product.");
      const updated = { ...product, name: product.name.trim(), sku: product.sku.trim(), updatedAt: now() };
      const previous = state.products.find((item) => item.id === product.id);
      if (!previous) throw new Error("Product not found. Refresh the inventory and try again.");
      const firestore = db;
      if (firebaseMode && firestore) {
        await runTransaction(firestore, async (tx) => {
          const productRef = doc(firestore, "businesses", businessId, "products", product.id);
          const snapshot = await tx.get(productRef);
          if (!snapshot.exists()) throw new Error("Product not found. Refresh the inventory and try again.");
          const stored = snapshot.data() as Product;
          const delta = roundMoney(updated.quantity - Number(stored.quantity));
          if (delta !== 0) {
            const movement: StockMovement = {
              id: uid(), businessId, productId: product.id, productName: updated.name,
              type: "adjustment", quantity: delta, reference: "Product edit stock adjustment",
              note: "Quantity changed from product editor", createdAt: now(), createdBy: user?.uid,
            };
            tx.update(productRef, {
              ...stripUndefined({ ...updated, lastStockMovementId: movement.id }),
              ...(product.barcode === undefined ? { barcode: deleteField() } : {}),
            });
            tx.set(doc(firestore, "businesses", businessId, "stockMovements", movement.id), stripUndefined(movement));
          } else {
            tx.update(productRef, {
              ...stripUndefined(updated),
              ...(product.barcode === undefined ? { barcode: deleteField() } : {}),
            });
          }
        });
      } else {
        const delta = roundMoney(updated.quantity - previous.quantity);
        const movement: StockMovement | null = delta !== 0 ? {
          id: uid(), businessId, productId: product.id, productName: updated.name,
          type: "adjustment", quantity: delta, reference: "Product edit stock adjustment",
          note: "Quantity changed from product editor", createdAt: now(), createdBy: user?.uid,
        } : null;
        setState((current) => {
          const next = {
            ...current,
            products: current.products.map((item) => item.id === product.id ? { ...updated, ...(movement ? { lastStockMovementId: movement.id } : {}) } : item),
            movements: movement ? [movement, ...current.movements] : current.movements,
          };
          persistLocal(next);
          return next;
        });
      }
      toast({ title: "Product updated", description: product.name });
    },
    [assertBusinessWriteAccess, businessId, firebaseMode, persistLocal, state.products, toast, user?.uid],
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      assertBusinessWriteAccess();
      const product = state.products.find((item) => item.id === id);
      if (!product) throw new Error("Product not found. Refresh the inventory and try again.");
      // Keep product history referentially intact. Archive rather than delete;
      // stock movements, sales and purchases remain readable for reports.
      await updateProduct({ ...product, isActive: false });
      toast({ title: "Product archived", description: `${product.name} remains available in historical records.` });
    },
    [assertBusinessWriteAccess, state.products, toast, updateProduct],
  );

  const adjustStock = useCallback(
    async (productId: string, quantity: number, type: StockMovement["type"], note?: string, reference?: string) => {
      assertBusinessWriteAccess();
      const product = state.products.find((item) => item.id === productId);
      if (!product) throw new Error("Product not found");
      const amount = Math.abs(quantity);
      const delta = calculateStockDelta(type, amount);
      const firestore = db;
      if (firebaseMode && firestore) {
        await runTransaction(firestore, async (tx) => {
          const productRef = doc(firestore, "businesses", businessId, "products", productId);
          const snapshot = await tx.get(productRef);
          if (!snapshot.exists()) throw new Error("Product not found. Refresh inventory and try again.");
          const stored = snapshot.data() as Product;
          const nextQuantity = roundMoney(Number(stored.quantity) + delta);
          if (nextQuantity < 0) throw new Error("Not enough stock available");
          const movement: StockMovement = {
            id: uid(), businessId, productId, productName: String(stored.name), type,
            quantity: delta, note, reference, createdAt: now(), createdBy: user?.uid,
          };
          tx.update(productRef, { quantity: nextQuantity, updatedAt: now(), lastStockMovementId: movement.id });
          tx.set(doc(firestore, "businesses", businessId, "stockMovements", movement.id), stripUndefined(movement));
        });
      } else {
        const nextQuantity = roundMoney(product.quantity + delta);
        if (nextQuantity < 0) throw new Error("Not enough stock available");
        const movement: StockMovement = { id: uid(), businessId, productId, productName: product.name, type, quantity: delta, note, reference, createdAt: now(), createdBy: user?.uid };
        setState((current) => {
          const next = { ...current, products: current.products.map((item) => item.id === productId ? { ...item, quantity: nextQuantity, updatedAt: now(), lastStockMovementId: movement.id } : item), movements: [movement, ...current.movements] };
          persistLocal(next);
          return next;
        });
      }
      toast({ title: "Stock updated", description: `${product.name}: ${delta > 0 ? "+" : ""}${delta} ${product.unit}` });
    },
    [assertBusinessWriteAccess, businessId, firebaseMode, persistLocal, state.products, toast, user?.uid],
  );

  const addSupplier = useCallback(
    async (input: Omit<Supplier, "id" | "businessId" | "createdAt">) => {
      assertBusinessWriteAccess();
      const supplier: Supplier = {
        id: uid(), businessId, name: input.name.trim(), balance: Number(input.balance ?? 0), createdAt: now(),
        ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
        ...(input.email?.trim() ? { email: input.email.trim() } : {}),
        ...(input.address?.trim() ? { address: input.address.trim() } : {}),
      };
      if (!supplier.name || !Number.isFinite(supplier.balance) || supplier.balance < 0) throw new Error("Enter a supplier name and valid balance.");
      if (firebaseMode && db) await setDoc(doc(db, "businesses", businessId, "suppliers", supplier.id), stripUndefined(supplier));
      else setState((current) => { const next = { ...current, suppliers: [supplier, ...current.suppliers] }; persistLocal(next); return next; });
    },
    [assertBusinessWriteAccess, businessId, firebaseMode, persistLocal],
  );

  const addCustomer = useCallback(
    async (input: Omit<Customer, "id" | "businessId" | "createdAt">) => {
      assertBusinessWriteAccess();
      const customer: Customer = {
        id: uid(), businessId, name: input.name.trim(), balance: Number(input.balance ?? 0), createdAt: now(),
        ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
        ...(input.email?.trim() ? { email: input.email.trim() } : {}),
      };
      if (!customer.name || !Number.isFinite(customer.balance) || customer.balance < 0) throw new Error("Enter a customer name and valid balance.");
      if (firebaseMode && db) await setDoc(doc(db, "businesses", businessId, "customers", customer.id), stripUndefined(customer));
      else setState((current) => { const next = { ...current, customers: [customer, ...current.customers] }; persistLocal(next); return next; });
    },
    [assertBusinessWriteAccess, businessId, firebaseMode, persistLocal],
  );

  const recordSale = useCallback(async (input: {
    invoiceNumber: string; customerId?: string;
    items: Array<{ productId: string; productName: string; quantity: number; unitPrice: number }>;
    subtotal: number; discount: number; taxRate: number;
    paymentMethod: Sale["paymentMethod"]; amountPaid: number;
  }): Promise<Sale> => {
    assertBusinessWriteAccess();
    if (!user || !businessId) throw new Error("Sign in before recording a sale.");
    if (!input.invoiceNumber.trim()) throw new Error("Invoice number is required.");
    const paymentMethod = validatePaymentMethod(input.paymentMethod) as Sale["paymentMethod"];
    if (new Set(input.items.map((item) => item.productId)).size !== input.items.length) {
      throw new Error("Each product may appear only once in a sale.");
    }
    const saleId = uid();
    const firestore = db;
    if (!firebaseMode || !firestore) {
      const productsById = new Map(state.products.map((product) => [product.id, product]));
      const normalized = input.items.map((item) => {
        const product = productsById.get(item.productId);
        if (!product) throw new Error(`Product not found: ${item.productName}`);
        if (!product.isActive) throw new Error(`${product.name} is archived.`);
        if (product.quantity < item.quantity) throw new Error(`Insufficient stock for ${product.name}.`);
        return { ...item, unitPrice: product.sellingPrice, unitCost: product.costPrice };
      });
      const totals = calculateTotals({ items: normalized, priceField: "unitPrice", discount: input.discount, taxRate: input.taxRate, amountPaid: input.amountPaid });
      if (paymentMethod !== "credit" && totals.amountPaid !== totals.total) throw new Error("A non-credit sale must be paid in full.");
      if (paymentMethod === "credit" && !input.customerId) throw new Error("Select a customer for a credit sale.");
      const sale: Sale = { id: saleId, businessId, invoiceNumber: input.invoiceNumber.trim(), ...(input.customerId ? { customerId: input.customerId } : {}), items: totals.items.map((item, index) => ({ ...item, productName: normalized[index].productName, unitCost: normalized[index].unitCost })), subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax, total: totals.total, paymentMethod, amountPaid: totals.amountPaid, createdAt: now() };
      const movements: StockMovement[] = totals.items.map((item, index) => ({ id: uid(), businessId, productId: item.productId, productName: normalized[index].productName, type: "sale", quantity: -item.quantity, reference: sale.invoiceNumber, referenceType: "sale", referenceId: saleId, createdAt: now(), createdBy: user.uid }));
      setState((current) => { const next = { ...current, sales: [sale, ...current.sales], products: current.products.map((product) => { const item = totals.items.find((line) => line.productId === product.id); return item ? { ...product, quantity: roundMoney(product.quantity - item.quantity) } : product; }), movements: [...movements, ...current.movements] }; persistLocal(next); return next; });
      return sale;
    }

    const productRefs = input.items.map((item) => doc(firestore, "businesses", businessId, "products", item.productId));
    let savedSale!: Sale;
    await runTransaction(firestore, async (tx) => {
      const refsToRead = [...productRefs];
      const customerRef = input.customerId ? doc(firestore, "businesses", businessId, "customers", input.customerId) : null;
      if (customerRef) refsToRead.push(customerRef);
      const snapshots = await Promise.all(refsToRead.map((ref) => tx.get(ref)));
      const productSnapshots = snapshots.slice(0, productRefs.length);
      productSnapshots.forEach((snapshot, index) => {
        if (!snapshot.exists()) throw new Error(`Product not found: ${input.items[index].productName}`);
        if (snapshot.data()?.isActive === false) throw new Error(`${snapshot.data()?.name ?? input.items[index].productName} is archived.`);
      });
      const customerSnapshot = customerRef ? snapshots[productRefs.length] : null;
      if (customerRef && !customerSnapshot?.exists()) throw new Error("The selected customer no longer exists.");
      if (paymentMethod === "credit" && !customerRef) throw new Error("Select a customer for a credit sale.");
      const normalized = productSnapshots.map((snapshot, index) => {
        const product = snapshot.data() as Product;
        const requested = input.items[index];
        if (Number(product.quantity) < requested.quantity) throw new Error(`Insufficient stock for ${product.name}.`);
        return { productId: productRefs[index].id, productName: product.name, quantity: requested.quantity, unitPrice: product.sellingPrice, unitCost: product.costPrice };
      });
      const totals = calculateTotals({ items: normalized, priceField: "unitPrice", discount: input.discount, taxRate: input.taxRate, amountPaid: input.amountPaid });
      if (paymentMethod !== "credit" && totals.amountPaid !== totals.total) throw new Error("A non-credit sale must be paid in full.");
      const createdAt = now();
      const movements: StockMovement[] = totals.items.map((item, index) => ({ id: uid(), businessId, productId: item.productId, productName: normalized[index].productName, type: "sale", quantity: -item.quantity, reference: input.invoiceNumber.trim(), referenceType: "sale", referenceId: saleId, createdAt, createdBy: user.uid } as StockMovement));
      savedSale = { id: saleId, businessId, invoiceNumber: input.invoiceNumber.trim(), ...(input.customerId ? { customerId: input.customerId } : {}), items: totals.items.map((item, index) => ({ ...item, productName: normalized[index].productName, unitCost: roundMoney(normalized[index].unitCost) })), subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax, total: totals.total, paymentMethod, amountPaid: totals.amountPaid, createdAt };
      (savedSale as Sale & { stockMovementIds: string[] }).stockMovementIds = movements.map((movement) => movement.id);
      totals.items.forEach((item, index) => {
        tx.update(productRefs[index], { quantity: roundMoney(Number(productSnapshots[index].data()?.quantity) - item.quantity), updatedAt: createdAt, lastStockMovementId: movements[index].id });
        tx.set(doc(firestore, "businesses", businessId, "stockMovements", movements[index].id), stripUndefined(movements[index]));
      });
      // Touch the customer document in the same transaction as the sale.
      // This serializes customer-account payments against new invoices without
      // requiring query reads inside a Web SDK transaction (which are unsupported).
      if (customerRef && customerSnapshot?.exists()) {
        const revision = readAccountRevision(customerSnapshot.data()?.accountRevision);
        tx.update(customerRef, { accountRevision: revision + 1, lastTransactionAt: createdAt });
      }
      tx.set(doc(firestore, "businesses", businessId, "sales", saleId), stripUndefined(savedSale));
    });
    toast({ title: "Sale recorded", description: `${savedSale.invoiceNumber} • ${CURRENCY_SYMBOLS[state.business.currency]}${savedSale.total.toFixed(2)}` });
    return savedSale;
  }, [assertBusinessWriteAccess, businessId, firebaseMode, persistLocal, state.business.currency, state.products, toast, user]);

  const recordPurchase = useCallback(async (input: {
    invoiceNumber: string; supplierId?: string;
    items: Array<{ productId: string; productName: string; quantity: number; unitCost: number }>;
    subtotal: number; discount: number; taxRate: number;
    paymentMethod: Purchase["paymentMethod"]; amountPaid: number;
  }): Promise<Purchase> => {
    assertBusinessWriteAccess();
    if (!user || !businessId) throw new Error("Sign in before recording a purchase.");
    if (!input.invoiceNumber.trim()) throw new Error("Supplier invoice number is required.");
    const paymentMethod = validatePaymentMethod(input.paymentMethod ?? "credit") as Purchase["paymentMethod"];
    if (new Set(input.items.map((item) => item.productId)).size !== input.items.length) throw new Error("Each product may appear only once in a purchase.");
    const purchaseId = uid();
    const firestore = db;
    if (!firebaseMode || !firestore) {
      const productsById = new Map(state.products.map((product) => [product.id, product]));
      const normalized = input.items.map((item) => {
        const product = productsById.get(item.productId);
        if (!product) throw new Error(`Product not found: ${item.productName}`);
        return { ...item, productName: product.name, unitCost: item.unitCost };
      });
      const totals = calculateTotals({ items: normalized, priceField: "unitCost", discount: input.discount, taxRate: input.taxRate, amountPaid: input.amountPaid });
      if (paymentMethod !== "credit" && totals.amountPaid !== totals.total) throw new Error("A non-credit purchase must be paid in full.");
      if (totals.amountPaid < totals.total && !input.supplierId) throw new Error("Select a supplier for an outstanding purchase balance.");
      const purchase: Purchase = { id: purchaseId, businessId, invoiceNumber: input.invoiceNumber.trim(), ...(input.supplierId ? { supplierId: input.supplierId } : {}), items: totals.items.map((item, index) => ({ ...item, productName: normalized[index].productName })), subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax, total: totals.total, paymentMethod, amountPaid: totals.amountPaid, createdAt: now() };
      const movements: StockMovement[] = totals.items.map((item, index) => ({ id: uid(), businessId, productId: item.productId, productName: normalized[index].productName, type: "purchase", quantity: item.quantity, reference: purchase.invoiceNumber, referenceType: "purchase", referenceId: purchaseId, unitCost: item.unitCost, createdAt: now(), createdBy: user.uid }));
      setState((current) => { const next = { ...current, purchases: [purchase, ...current.purchases], products: current.products.map((product) => { const item = totals.items.find((line) => line.productId === product.id); return item ? { ...product, quantity: roundMoney(product.quantity + item.quantity), costPrice: item.unitCost } : product; }), movements: [...movements, ...current.movements] }; persistLocal(next); return next; });
      return purchase;
    }

    const productRefs = input.items.map((item) => doc(firestore, "businesses", businessId, "products", item.productId));
    let savedPurchase!: Purchase;
    await runTransaction(firestore, async (tx) => {
      const refsToRead = [...productRefs];
      const supplierRef = input.supplierId ? doc(firestore, "businesses", businessId, "suppliers", input.supplierId) : null;
      if (supplierRef) refsToRead.push(supplierRef);
      const snapshots = await Promise.all(refsToRead.map((ref) => tx.get(ref)));
      const productSnapshots = snapshots.slice(0, productRefs.length);
      productSnapshots.forEach((snapshot, index) => {
        if (!snapshot.exists()) throw new Error(`Product not found: ${input.items[index].productName}`);
        if (snapshot.data()?.isActive === false) throw new Error(`${snapshot.data()?.name ?? input.items[index].productName} is archived.`);
      });
      const supplierSnapshot = supplierRef ? snapshots[productRefs.length] : null;
      if (supplierRef && !supplierSnapshot?.exists()) throw new Error("The selected supplier no longer exists.");
      const normalized = productSnapshots.map((snapshot, index) => ({ productId: productRefs[index].id, productName: String(snapshot.data()?.name ?? input.items[index].productName), quantity: input.items[index].quantity, unitCost: input.items[index].unitCost }));
      const totals = calculateTotals({ items: normalized, priceField: "unitCost", discount: input.discount, taxRate: input.taxRate, amountPaid: input.amountPaid });
      if (paymentMethod !== "credit" && totals.amountPaid !== totals.total) throw new Error("A non-credit purchase must be paid in full.");
      if (totals.amountPaid < totals.total && !supplierRef) throw new Error("Select a supplier for an outstanding purchase balance.");
      const createdAt = now();
      const movements: StockMovement[] = totals.items.map((item, index) => ({ id: uid(), businessId, productId: item.productId, productName: normalized[index].productName, type: "purchase", quantity: item.quantity, reference: input.invoiceNumber.trim(), referenceType: "purchase", referenceId: purchaseId, unitCost: item.unitCost, createdAt, createdBy: user.uid } as StockMovement));
      savedPurchase = { id: purchaseId, businessId, invoiceNumber: input.invoiceNumber.trim(), ...(input.supplierId ? { supplierId: input.supplierId } : {}), items: totals.items.map((item, index) => ({ ...item, productName: normalized[index].productName })), subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax, total: totals.total, paymentMethod, amountPaid: totals.amountPaid, createdAt };
      (savedPurchase as Purchase & { stockMovementIds: string[] }).stockMovementIds = movements.map((movement) => movement.id);
      totals.items.forEach((item, index) => {
        tx.update(productRefs[index], { quantity: roundMoney(Number(productSnapshots[index].data()?.quantity) + item.quantity), costPrice: item.unitCost, updatedAt: createdAt, lastStockMovementId: movements[index].id });
        tx.set(doc(firestore, "businesses", businessId, "stockMovements", movements[index].id), stripUndefined(movements[index]));
      });
      // Serialize supplier-account payments against new purchase invoices.
      if (supplierRef && supplierSnapshot?.exists()) {
        const revision = readAccountRevision(supplierSnapshot.data()?.accountRevision);
        tx.update(supplierRef, { accountRevision: revision + 1, lastTransactionAt: createdAt });
      }
      tx.set(doc(firestore, "businesses", businessId, "purchases", purchaseId), stripUndefined(savedPurchase));
    });
    toast({ title: "Purchase recorded", description: `${savedPurchase.invoiceNumber} added to stock.` });
    return savedPurchase;
  }, [assertBusinessWriteAccess, businessId, firebaseMode, persistLocal, state.products, toast, user]);

  const recordAccountPayment = useCallback(
    async (input: Omit<AccountPayment, "id" | "businessId" | "createdAt">) => {
      assertBusinessWriteAccess();
      const amount = validatePaymentAmount(input.amount);
      if (input.partyType !== "customer" && input.partyType !== "supplier") throw new Error("Payment party type is invalid.");
      if (!input.partyId) throw new Error("Select a customer or supplier before recording a payment.");
      const paymentMethod = validatePaymentMethod(input.paymentMethod) as AccountPayment["paymentMethod"];
      const payment: AccountPayment = {
        id: uid(), businessId, partyType: input.partyType, partyId: input.partyId, amount,
        paymentMethod, createdAt: now(), ...(user?.uid ? { createdBy: user.uid } : {}),
        ...(input.reference?.trim() ? { reference: input.reference.trim() } : {}),
        ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      };
      const firestore = db;
      if (firebaseMode && firestore) {
        const partyCollection = input.partyType === "customer" ? "customers" : "suppliers";
        const transactionCollection = input.partyType === "customer" ? "sales" : "purchases";
        const partyField = input.partyType === "customer" ? "customerId" : "supplierId";
        const partyRef = doc(firestore, "businesses", businessId, partyCollection, input.partyId);
        const partyBefore = await getDoc(partyRef);
        if (!partyBefore.exists()) throw new Error(`The selected ${input.partyType} no longer exists.`);
        const revisionBefore = readAccountRevision(partyBefore.data().accountRevision);
        const transactionsQuery = query(collection(firestore, "businesses", businessId, transactionCollection), where(partyField, "==", input.partyId));
        const paymentQuery = query(collection(firestore, "businesses", businessId, "payments"), where("partyId", "==", input.partyId));
        const [transactionSnapshot, paymentSnapshot] = await Promise.all([getDocs(transactionsQuery), getDocs(paymentQuery)]);
        const outstanding = calculateOutstandingBalance(transactionSnapshot.docs.map((item) => item.data()), paymentSnapshot.docs.map((item) => item.data()), input.partyType);
        if (amount > outstanding) throw new Error(`Payment exceeds the outstanding balance of ${outstanding.toFixed(2)}.`);
        await runTransaction(firestore, async (tx) => {
          const partySnapshot = await tx.get(partyRef);
          if (!partySnapshot.exists()) throw new Error(`The selected ${input.partyType} no longer exists.`);
          const revisionNow = readAccountRevision(partySnapshot.data().accountRevision);
          if (revisionNow !== revisionBefore) {
            throw new Error("This account balance changed while the payment was being recorded. Refresh the account and try again.");
          }
          // All invoice/purchase/payment paths update accountRevision in the same
          // transaction as their ledger write. This makes the preflight query
          // stale-safe for normal concurrent use while keeping Spark compatibility.
          tx.update(partyRef, { accountRevision: revisionNow + 1, lastPaymentAt: payment.createdAt });
          tx.set(doc(firestore, "businesses", businessId, "payments", payment.id), stripUndefined(payment));
        });
      } else {
        const transactions = input.partyType === "customer" ? state.sales : state.purchases;
        const billed = transactions.filter((item) => (input.partyType === "customer" ? (item as Sale).customerId : (item as Purchase).supplierId) === input.partyId).reduce((sum, item) => sum + item.total, 0);
        const upfront = transactions.filter((item) => (input.partyType === "customer" ? (item as Sale).customerId : (item as Purchase).supplierId) === input.partyId).reduce((sum, item) => sum + Number(item.amountPaid ?? 0), 0);
        const alreadyPaid = state.payments.filter((item) => item.partyType === input.partyType && item.partyId === input.partyId).reduce((sum, item) => sum + item.amount, 0);
        if (amount > Math.max(0, billed - upfront - alreadyPaid)) throw new Error("Payment exceeds the outstanding balance.");
        setState((current) => { const next = { ...current, payments: [payment, ...current.payments] }; persistLocal(next); return next; });
      }
      toast({ title: "Payment recorded", description: `${CURRENCY_SYMBOLS[state.business.currency]}${payment.amount.toFixed(2)} received/paid.` });
    },
    [assertBusinessWriteAccess, businessId, firebaseMode, persistLocal, state.business.currency, state.payments, state.purchases, state.sales, toast, user?.uid],
  );

  const updateBusiness = useCallback(
    async (
      patch: Partial<
        Pick<
          Business,
          "name" | "phone" | "email" | "address" | "taxNumber" | "logoUrl" | "currency"
        >
      >,
    ) => {
      // Business identity/contact settings remain manageable after trial expiry.
      // Operational collections and budget changes remain subscription-gated.
      if (firebaseMode && db)
        await setDoc(doc(db, "businesses", businessId), stripUndefined(patch), { merge: true });
      else
        setState((s) => {
          const next = { ...s, business: { ...s.business, ...patch } };
          persistLocal(next);
          return next;
        });
      toast({ title: "Business profile saved" });
    },
    [businessId, firebaseMode, persistLocal, toast],
  );

  const setCurrency = useCallback(
    async (currency: Currency) => {
      if (firebaseMode && db)
        await setDoc(
          doc(db, "businesses", businessId),
          { currency },
          { merge: true },
        );
      else
        setState((s) => {
          const next = { ...s, business: { ...s.business, currency } };
          persistLocal(next);
          return next;
        });
    },
    [businessId, firebaseMode, persistLocal],
  );

  const value = useMemo<InventoryContextValue>(
    () => ({
      ...state,
      loading,
      categories: DEFAULT_CATEGORIES,
      currencySymbol: CURRENCY_SYMBOLS[state.business.currency],
      addProduct,
      updateProduct,
      deleteProduct,
      adjustStock,
      recordSale,
      recordPurchase,
      addSupplier,
      addCustomer,
      recordAccountPayment,
      setCurrency,
      updateBusiness,
    }),
    [
      state,
      loading,
      addProduct,
      updateProduct,
      deleteProduct,
      adjustStock,
      recordSale,
      recordPurchase,
      addSupplier,
      addCustomer,
      recordAccountPayment,
      setCurrency,
      updateBusiness,
    ],
  );

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const value = useContext(InventoryContext);
  if (!value)
    throw new Error("useInventory must be used inside InventoryProvider");
  return value;
}

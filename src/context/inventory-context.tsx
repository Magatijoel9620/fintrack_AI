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
  deleteDoc,
  getDoc,
  doc,
  onSnapshot,
  runTransaction,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db, functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { calculateTotals, validatePaymentAmount } from "../../functions/src/financial-integrity.js";
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
      if (!functions) throw new Error("Business provisioning is unavailable. Check the Firebase Functions configuration.");
      const provision = httpsCallable(functions, "ensureBusinessProvisioned");
      await provision({});
      initializationStage = "verifying business ownership";
      const existing = await getDoc(businessRef);
      if (!existing.exists()) throw new Error("Business provisioning did not create the expected workspace.");
      const existingData = existing.data() as Partial<Business>;
      if (existingData.ownerId !== user.uid || existingData.id !== user.uid) {
        throw new Error("The existing business record does not belong to the signed-in account. No data was changed.");
      }
      // One authenticated Firebase UID owns exactly one business. Legacy member
      // subcollections are intentionally left untouched and are no longer read.
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
              toast({ variant: "destructive", title: "Business sync failed", description: err.code === "permission-denied" ? "Firestore denied access to this business record. Verify owner-only access and deployed rules." : "The business record could not be synchronized. Check your connection and retry." });
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
              toast({ variant: "destructive", title: `${name} sync failed`, description: err.code === "permission-denied" ? `Firestore denied access to ${name}. Verify owner-only access and deployed rules.` : `The ${name} collection could not be synchronized. Check your connection and retry.` });
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
            ? "Firestore denied this operation. Check owner-only access and deployed rules; no existing business profile was overwritten."
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

  const addProduct = useCallback(
    async (
      input: Omit<Product, "id" | "businessId" | "createdAt" | "updatedAt">,
    ) => {
      if (!input.name?.trim() || !input.sku?.trim()) throw new Error("Product name and SKU are required.");
      if (![input.costPrice, input.sellingPrice, input.quantity, input.reorderLevel].every((n) => Number.isFinite(n) && n >= 0)) throw new Error("Prices, stock and reorder level must be valid non-negative numbers.");
      const normalizedSku = input.sku.trim();
      if (state.products.some((item) => item.sku.trim().toLowerCase() === normalizedSku.toLowerCase())) throw new Error("That SKU already exists. Use a unique SKU.");
      if (input.barcode?.trim() && state.products.some((item) => item.barcode?.trim() === input.barcode?.trim())) throw new Error("That barcode is already assigned to another product.");
      const product: Product = {
        ...input, name: input.name.trim(), sku: normalizedSku,
        id: uid(), businessId, createdAt: now(), updatedAt: now(),
      };
      if (firebaseMode && functions) {
        const create = httpsCallable(functions, "createProduct");
        const result = await create(product);
        toast({ title: "Product added", description: `${product.name} is now in your inventory.` });
        return result.data as Product;
      }
      const movement: StockMovement | null = product.quantity > 0 ? {
        id: uid(), businessId, productId: product.id, productName: product.name,
        type: "opening", quantity: product.quantity, reference: "Opening stock", createdAt: now(),
      } : null;
      setState((current) => {
        const next = { ...current, products: [product, ...current.products], movements: movement ? [movement, ...current.movements] : current.movements };
        persistLocal(next);
        return next;
      });
      toast({ title: "Product added", description: `${product.name} is now in your inventory.` });
      return product;
    },
    [businessId, firebaseMode, persistLocal, state.products, toast],
  );

  const updateProduct = useCallback(
    async (product: Product) => {
      if (!product.id || !product.name?.trim() || !product.sku?.trim()) throw new Error("Product name and SKU are required.");
      if (![product.costPrice, product.sellingPrice, product.quantity, product.reorderLevel].every((n) => Number.isFinite(n) && n >= 0)) throw new Error("Prices, stock and reorder level must be valid non-negative numbers.");
      if (state.products.some((item) => item.id !== product.id && item.sku.trim().toLowerCase() === product.sku.trim().toLowerCase())) throw new Error("That SKU already exists. Use a unique SKU.");
      if (product.barcode?.trim() && state.products.some((item) => item.id !== product.id && item.barcode?.trim() === product.barcode?.trim())) throw new Error("That barcode is already assigned to another product.");
      const updated = { ...product, name: product.name.trim(), sku: product.sku.trim(), updatedAt: now() };
      const previous = state.products.find((item) => item.id === product.id);
      if (!previous) throw new Error("Product not found. Refresh the inventory and try again.");
      if (firebaseMode && functions) {
        const update = httpsCallable(functions, "updateProduct");
        await update({ ...updated, expectedQuantity: previous.quantity });
      } else {
        const delta = updated.quantity - previous.quantity;
        const movement: StockMovement | null = delta !== 0 ? {
          id: uid(), businessId, productId: product.id, productName: updated.name,
          type: "adjustment", quantity: delta, reference: "Product edit stock adjustment",
          note: "Quantity changed from product editor", createdAt: now(),
        } : null;
        setState((current) => {
          const next = {
            ...current,
            products: current.products.map((item) => item.id === product.id ? updated : item),
            movements: movement ? [movement, ...current.movements] : current.movements,
          };
          persistLocal(next);
          return next;
        });
      }
      toast({ title: "Product updated", description: product.name });
    },
    [businessId, firebaseMode, persistLocal, state.products, toast],
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      const product = state.products.find((item) => item.id === id);
      if (!product) throw new Error("Product not found. Refresh the inventory and try again.");
      const hasHistory = state.sales.some((sale) => sale.items.some((item) => item.productId === id)) ||
        state.purchases.some((purchase) => purchase.items.some((item) => item.productId === id)) ||
        state.movements.some((movement) => movement.productId === id);
      if (firebaseMode && functions) {
        if (hasHistory) {
          await updateProduct({ ...product, isActive: false });
          toast({ title: "Product archived", description: `${product.name} has transaction history and remains available in reports.` });
          return;
        }
        const remove = httpsCallable(functions, "deleteProduct");
        const result = await remove({ productId: id });
        const outcome = result.data as { deleted: boolean; archived: boolean };
        if (outcome.archived) {
          toast({ title: "Product archived", description: `${product.name} has stock history and remains available in reports.` });
        } else {
          toast({ variant: "destructive", title: "Product removed", description: product.name });
        }
        return;
      }
      if (hasHistory) {
        await updateProduct({ ...product, isActive: false });
        toast({ title: "Product archived", description: `${product.name} has transaction history, so it was archived instead of permanently deleted.` });
        return;
      }
      setState((current) => {
        const next = { ...current, products: current.products.filter((item) => item.id !== id) };
        persistLocal(next);
        return next;
      });
      toast({ variant: "destructive", title: "Product removed", description: product.name });
    },
    [firebaseMode, persistLocal, state.products, state.sales, state.purchases, state.movements, toast, updateProduct],
  );

  const adjustStock = useCallback(
    async (
      productId: string,
      quantity: number,
      type: StockMovement["type"],
      note?: string,
      reference?: string,
    ) => {
      const product = state.products.find((item) => item.id === productId);
      if (!product) throw new Error("Product not found");
      const amount = Math.abs(quantity);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("Quantity must be a finite number greater than zero");
      if (firebaseMode && functions) {
        const adjust = httpsCallable(functions, "adjustStock");
        await adjust({ id: uid(), productId, quantity: amount, type, note, reference });
        toast({ title: "Stock updated", description: `${product.name} movement recorded.` });
        return;
      }
      const delta = ["stock-in", "purchase", "return", "opening"].includes(type) ? amount : -amount;
      if (product.quantity + delta < 0) throw new Error("Not enough stock available");
      const movement: StockMovement = {
        id: uid(), businessId, productId, productName: product.name,
        type, quantity: delta, note, reference, createdAt: now(),
      };
      setState((current) => {
        const next = {
          ...current,
          products: current.products.map((item) => item.id === productId ? { ...item, quantity: item.quantity + delta, updatedAt: now() } : item),
          movements: [movement, ...current.movements],
        };
        persistLocal(next);
        return next;
      });
      toast({ title: "Stock updated", description: `${product.name}: ${delta > 0 ? "+" : ""}${delta} ${product.unit}` });
    },
    [businessId, firebaseMode, persistLocal, state.products, toast],
  );

  const addSupplier = useCallback(
    async (input: Omit<Supplier, "id" | "businessId" | "createdAt">) => {
      const supplier: Supplier = {
        ...input,
        id: uid(),
        businessId,
        createdAt: now(),
      };
      if (firebaseMode && db)
        await setDoc(
          doc(db, "businesses", businessId, "suppliers", supplier.id),
          supplier,
        );
      else
        setState((s) => {
          const next = { ...s, suppliers: [supplier, ...s.suppliers] };
          persistLocal(next);
          return next;
        });
    },
    [businessId, firebaseMode, persistLocal],
  );

  const addCustomer = useCallback(
    async (input: Omit<Customer, "id" | "businessId" | "createdAt">) => {
      const customer: Customer = {
        ...input,
        id: uid(),
        businessId,
        createdAt: now(),
      };
      if (firebaseMode && db)
        await setDoc(
          doc(db, "businesses", businessId, "customers", customer.id),
          customer,
        );
      else
        setState((s) => {
          const next = { ...s, customers: [customer, ...s.customers] };
          persistLocal(next);
          return next;
        });
    },
    [businessId, firebaseMode, persistLocal],
  );

  const recordSale = useCallback(async (input: {
    invoiceNumber: string; customerId?: string;
    items: Array<{ productId: string; productName: string; quantity: number; unitPrice: number }>;
    subtotal: number; discount: number; taxRate: number;
    paymentMethod: Sale["paymentMethod"]; amountPaid: number;
  }): Promise<Sale> => {
    if (!user || !functions) throw new Error("Sign in and configure Firebase Functions before recording a sale.");
    const createSale = httpsCallable(functions, "recordSale");
    const result = await createSale({ id: uid(), ...input });
    return result.data as Sale;
  }, [user]);

  const recordPurchase = useCallback(async (input: {
    invoiceNumber: string; supplierId?: string;
    items: Array<{ productId: string; productName: string; quantity: number; unitCost: number }>;
    subtotal: number; discount: number; taxRate: number;
    paymentMethod: Purchase["paymentMethod"]; amountPaid: number;
  }): Promise<Purchase> => {
    if (!user || !functions) throw new Error("Sign in and configure Firebase Functions before recording a purchase.");
    const createPurchase = httpsCallable(functions, "recordPurchase");
    const result = await createPurchase({ id: uid(), ...input });
    return result.data as Purchase;
  }, [user]);

  const recordAccountPayment = useCallback(
    async (input: Omit<AccountPayment, "id" | "businessId" | "createdAt">) => {
      const amount = validatePaymentAmount(input.amount);
      if (!input.partyId) throw new Error("Select a customer or supplier before recording a payment.");
      if (!(["cash", "mpesa", "card", "credit", "other"] as string[]).includes(input.paymentMethod)) throw new Error("Payment method is invalid.");
      const payment: AccountPayment = { ...input, amount, id: uid(), businessId, createdAt: now(), createdBy: user?.uid };
      if (firebaseMode && functions) {
        const record = httpsCallable(functions, "recordAccountPayment");
        await record(payment);
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
    [businessId, firebaseMode, persistLocal, state.business.currency, state.payments, state.purchases, state.sales, toast, user?.uid],
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
      if (firebaseMode && db)
        await setDoc(doc(db, "businesses", businessId), patch, { merge: true });
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

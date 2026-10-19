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
  Timestamp,
  doc,
  onSnapshot,
  runTransaction,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
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
  recordSale: (
    sale: Omit<Sale, "id" | "businessId" | "createdAt">,
  ) => Promise<void>;
  recordPurchase: (
    purchase: Omit<Purchase, "id" | "businessId" | "createdAt">,
  ) => Promise<void>;
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
        "name" | "phone" | "email" | "address" | "taxNumber" | "logoUrl"
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

  // No local/demo data mode: authenticated Firestore is the source of truth.
  useEffect(() => {
    if (!user || firebaseMode) {
      if (!user) setLoading(false);
      return;
    }
  }, [user, firebaseMode]);

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
    const memberRef = doc(
      firestore,
      "businesses",
      businessId,
      "members",
      user.uid,
    );
    let initializationStage = "reading business record";
    const seedBusiness = async () => {
      const existing = await getDoc(businessRef);
      if (!existing.exists()) {
        initializationStage = "creating new business record";
        const trialStartedAt = new Date();
        const trialEndsAt = new Date(trialStartedAt.getTime() + 21 * 24 * 60 * 60 * 1000);
        await setDoc(businessRef, {
          id: businessId,
          name: user.displayName ? `${user.displayName}'s Business` : "My Business",
          currency: "KES",
          ownerId: user.uid,
          createdAt: now(),
          subscription: {
            planId: "trial",
            status: "trialing",
            trialStartedAt: Timestamp.fromDate(trialStartedAt),
            trialEndsAt: Timestamp.fromDate(trialEndsAt),
            updatedAt: Timestamp.fromDate(trialStartedAt),
          },
        });
      } else {
        const existingData = existing.data() as Partial<Business>;
        if (existingData.ownerId !== user.uid) {
          throw new Error("The existing business record does not belong to the signed-in account.");
        }
        // Existing business profile and subscription are authoritative. Do not
        // overwrite them from client defaults or attempt a client-side migration.
        // Subscription setup notices are intentionally suppressed while billing is being prepared.
        // Keep the existing business record authoritative; do not synthesize or overwrite entitlements.
      }

      initializationStage = "checking owner membership";
      const membership = await getDoc(memberRef);
      if (!membership.exists()) {
        initializationStage = "creating owner membership";
        await setDoc(memberRef, {
          userId: user.uid,
          role: "owner",
          joinedAt: Timestamp.now(),
        });
      } else if (membership.data().role !== "owner") {
        throw new Error("The existing owner membership has a non-owner role. No membership changes were made.");
      }
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
              toast({ variant: "destructive", title: "Business sync failed", description: err.code === "permission-denied" ? "Firestore denied access to this business record. Verify membership and deployed rules." : "The business record could not be synchronized. Check your connection and retry." });
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
              toast({ variant: "destructive", title: `${name} sync failed`, description: err.code === "permission-denied" ? `Firestore denied access to ${name}. Verify this member's role and deployed rules.` : `The ${name} collection could not be synchronized. Check your connection and retry.` });
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
            ? "Firestore denied this operation. Check the deployed rules and this account's membership; no existing business profile was overwritten."
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
      const p: Product = {
        ...input,
        id: uid(),
        businessId,
        createdAt: now(),
        updatedAt: now(),
      };
      const firestore = db;
      if (firebaseMode && firestore) {
        const batch = writeBatch(firestore);
        batch.set(
          doc(firestore, "businesses", businessId, "products", p.id),
          p,
        );
        if (p.quantity > 0) {
          const movement: StockMovement = {
            id: uid(),
            businessId,
            productId: p.id,
            productName: p.name,
            type: "opening",
            quantity: p.quantity,
            reference: "Opening stock",
            createdAt: now(),
            createdBy: user?.uid,
          };
          batch.set(
            doc(
              firestore,
              "businesses",
              businessId,
              "stockMovements",
              movement.id,
            ),
            movement,
          );
        }
        await batch.commit();
      } else {
        const movement: StockMovement | null =
          p.quantity > 0
            ? {
                id: uid(),
                businessId,
                productId: p.id,
                productName: p.name,
                type: "opening",
                quantity: p.quantity,
                reference: "Opening stock",
                createdAt: now(),
              }
            : null;
        setState((s) => {
          const next = {
            ...s,
            products: [p, ...s.products],
            movements: movement ? [movement, ...s.movements] : s.movements,
          };
          persistLocal(next);
          return next;
        });
      }
      toast({
        title: "Product added",
        description: `${p.name} is now in your inventory.`,
      });
      return p;
    },
    [businessId, firebaseMode, persistLocal, toast, user?.uid],
  );

  const updateProduct = useCallback(
    async (p: Product) => {
      const updated = { ...p, updatedAt: now() };
      const firestore = db;
      const previous = state.products.find((x) => x.id === p.id);
      const delta = previous ? updated.quantity - previous.quantity : 0;
      if (firebaseMode && firestore) {
        const batch = writeBatch(firestore);
        batch.set(doc(firestore, "businesses", businessId, "products", p.id), updated);
        if (previous && delta !== 0) {
          const movement: StockMovement = {
            id: uid(),
            businessId,
            productId: p.id,
            productName: p.name,
            type: "adjustment",
            quantity: delta,
            reference: "Product edit stock adjustment",
            note: "Quantity changed from product editor",
            createdAt: now(),
            createdBy: user?.uid,
          };
          batch.set(doc(firestore, "businesses", businessId, "stockMovements", movement.id), movement);
        }
        await batch.commit();
      } else
        setState((s) => {
          const movement: StockMovement | null = previous && delta !== 0 ? {
            id: uid(), businessId, productId: p.id, productName: p.name,
            type: "adjustment", quantity: delta, reference: "Product edit stock adjustment",
            note: "Quantity changed from product editor", createdAt: now(), createdBy: user?.uid,
          } : null;
          const next = {
            ...s,
            products: s.products.map((x) => (x.id === p.id ? updated : x)),
            movements: movement ? [movement, ...s.movements] : s.movements,
          };
          persistLocal(next);
          return next;
        });
      toast({ title: "Product updated", description: p.name });
    },
    [businessId, firebaseMode, persistLocal, state.products, toast, user?.uid],
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      const p = state.products.find((x) => x.id === id);
      const firestore = db;
      if (firebaseMode && firestore)
        await deleteDoc(
          doc(firestore, "businesses", businessId, "products", id),
        );
      else
        setState((s) => {
          const next = {
            ...s,
            products: s.products.filter((x) => x.id !== id),
          };
          persistLocal(next);
          return next;
        });
      toast({
        variant: "destructive",
        title: "Product removed",
        description: p?.name ?? "Product",
      });
    },
    [businessId, firebaseMode, persistLocal, state.products, toast],
  );

  const adjustStock = useCallback(
    async (
      productId: string,
      quantity: number,
      type: StockMovement["type"],
      note?: string,
      reference?: string,
    ) => {
      const p = state.products.find((x) => x.id === productId);
      if (!p) throw new Error("Product not found");
      const amount = Math.abs(quantity);
      if (!amount) throw new Error("Quantity must be greater than zero");
      const delta = ["stock-in", "purchase", "return", "opening"].includes(type)
        ? amount
        : -amount;
      if (p.quantity + delta < 0) throw new Error("Not enough stock available");
      const movement: StockMovement = {
        id: uid(),
        businessId,
        productId,
        productName: p.name,
        type,
        quantity: delta,
        note,
        reference,
        createdAt: now(),
        createdBy: user?.uid,
      };

      const firestore = db;
      if (firebaseMode && firestore) {
        await runTransaction(firestore, async (tx) => {
          const productRef = doc(
            firestore,
            "businesses",
            businessId,
            "products",
            productId,
          );
          const snap = await tx.get(productRef);
          const current = snap.data()?.quantity ?? 0;
          if (current + delta < 0)
            throw new Error("Not enough stock available");
          tx.update(productRef, {
            quantity: current + delta,
            updatedAt: now(),
          });
          tx.set(
            doc(
              firestore,
              "businesses",
              businessId,
              "stockMovements",
              movement.id,
            ),
            movement,
          );
        });
      } else
        setState((s) => {
          const next = {
            ...s,
            products: s.products.map((x) =>
              x.id === productId
                ? { ...x, quantity: x.quantity + delta, updatedAt: now() }
                : x,
            ),
            movements: [movement, ...s.movements],
          };
          persistLocal(next);
          return next;
        });
      toast({
        title: "Stock updated",
        description: `${p.name}: ${delta > 0 ? "+" : ""}${delta} ${p.unit}`,
      });
    },
    [businessId, firebaseMode, persistLocal, state.products, toast, user?.uid],
  );

  const recordSale = useCallback(
    async (input: Omit<Sale, "id" | "businessId" | "createdAt">) => {
      if (!input.items.length)
        throw new Error("A sale needs at least one item");
      const saleItems = input.items.map((item) => ({
        ...item,
        unitCost: Number(
          state.products.find((p) => p.id === item.productId)?.costPrice ??
            item.unitCost ??
            0,
        ),
      }));
      const sale: Sale = {
        ...input,
        items: saleItems,
        id: uid(),
        businessId,
        createdAt: now(),
      };
      const aggregated = Array.from(
        saleItems
          .reduce((map, item) => {
            const existing = map.get(item.productId);
            map.set(
              item.productId,
              existing
                ? { ...existing, quantity: existing.quantity + item.quantity }
                : { ...item },
            );
            return map;
          }, new Map<string, (typeof saleItems)[number]>())
          .values(),
      );
      const movements = Array.from(aggregated).map((i) => ({
        id: uid(),
        businessId,
        productId: i.productId,
        productName: i.productName,
        type: "sale" as const,
        quantity: -Math.abs(i.quantity),
        reference: sale.invoiceNumber,
        createdAt: now(),
        createdBy: user?.uid,
      }));
      const firestore = db;
      if (firebaseMode && firestore) {
        await runTransaction(firestore, async (tx) => {
          const refs = aggregated.map((i) =>
            doc(firestore, "businesses", businessId, "products", i.productId),
          );
          const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
          snaps.forEach((snap, idx) => {
            if (!snap.exists())
              throw new Error(
                `Product not found: ${aggregated[idx].productName}`,
              );
            const stock = Number(snap.data()?.quantity ?? 0);
            if (stock < aggregated[idx].quantity)
              throw new Error(
                `Insufficient stock for ${aggregated[idx].productName}`,
              );
          });
          snaps.forEach((snap, idx) => {
            const current = Number(snap.data()?.quantity ?? 0);
            tx.update(refs[idx], {
              quantity: current - aggregated[idx].quantity,
              updatedAt: now(),
            });
          });
          tx.set(
            doc(firestore, "businesses", businessId, "sales", sale.id),
            sale,
          );
          movements.forEach((m) =>
            tx.set(
              doc(firestore, "businesses", businessId, "stockMovements", m.id),
              m,
            ),
          );
        });
      } else
        setState((s) => {
          const next = {
            ...s,
            sales: [sale, ...s.sales],
            products: s.products.map((p) => {
              const i = aggregated.find((i) => i.productId === p.id);
              return i
                ? { ...p, quantity: p.quantity - i.quantity, updatedAt: now() }
                : p;
            }),
            movements: [...movements, ...s.movements],
          };
          persistLocal(next);
          return next;
        });
      toast({
        title: "Sale recorded",
        description: `${sale.invoiceNumber} • ${CURRENCY_SYMBOLS[state.business.currency]}${sale.total.toFixed(2)}`,
      });
    },
    [
      businessId,
      firebaseMode,
      persistLocal,
      state.business.currency,
      state.products,
      toast,
      user?.uid,
    ],
  );

  const recordPurchase = useCallback(
    async (input: Omit<Purchase, "id" | "businessId" | "createdAt">) => {
      if (!input.items.length)
        throw new Error("A purchase needs at least one item");
      const purchase: Purchase = {
        ...input,
        id: uid(),
        businessId,
        createdAt: now(),
      };
      const aggregated = Array.from(
        input.items
          .reduce((map, item) => {
            const existing = map.get(item.productId);
            map.set(
              item.productId,
              existing
                ? {
                    ...existing,
                    quantity: existing.quantity + item.quantity,
                    total: existing.total + item.total,
                  }
                : { ...item },
            );
            return map;
          }, new Map<string, (typeof input.items)[number]>())
          .values(),
      );
      const movements = Array.from(aggregated).map((i) => ({
        id: uid(),
        businessId,
        productId: i.productId,
        productName: i.productName,
        type: "purchase" as const,
        quantity: Math.abs(i.quantity),
        reference: purchase.invoiceNumber,
        unitCost: i.unitCost,
        createdAt: now(),
        createdBy: user?.uid,
      }));
      const firestore = db;
      if (firebaseMode && firestore) {
        await runTransaction(firestore, async (tx) => {
          const refs = aggregated.map((i) =>
            doc(firestore, "businesses", businessId, "products", i.productId),
          );
          const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));
          snaps.forEach((snap, idx) => {
            if (!snap.exists())
              throw new Error(
                `Product not found: ${aggregated[idx].productName}`,
              );
          });
          snaps.forEach((snap, idx) => {
            const current = Number(snap.data()?.quantity ?? 0);
            tx.update(refs[idx], {
              quantity: current + aggregated[idx].quantity,
              costPrice: aggregated[idx].unitCost,
              updatedAt: now(),
            });
          });
          tx.set(
            doc(firestore, "businesses", businessId, "purchases", purchase.id),
            purchase,
          );
          movements.forEach((m) =>
            tx.set(
              doc(firestore, "businesses", businessId, "stockMovements", m.id),
              m,
            ),
          );
        });
      } else
        setState((s) => {
          const next = {
            ...s,
            purchases: [purchase, ...s.purchases],
            products: s.products.map((p) => {
              const i = aggregated.find((i) => i.productId === p.id);
              return i
                ? {
                    ...p,
                    quantity: p.quantity + i.quantity,
                    costPrice: i.unitCost,
                    updatedAt: now(),
                  }
                : p;
            }),
            movements: [...movements, ...s.movements],
          };
          persistLocal(next);
          return next;
        });
      toast({
        title: "Purchase recorded",
        description: `${purchase.invoiceNumber} added to stock.`,
      });
    },
    [businessId, firebaseMode, persistLocal, toast, user?.uid],
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

  const recordAccountPayment = useCallback(
    async (input: Omit<AccountPayment, "id" | "businessId" | "createdAt">) => {
      if (!input.partyId || input.amount <= 0)
        throw new Error("Payment amount must be greater than zero");
      const payment: AccountPayment = {
        ...input,
        id: uid(),
        businessId,
        createdAt: now(),
        createdBy: user?.uid,
      };
      if (firebaseMode && db) {
        await setDoc(
          doc(db, "businesses", businessId, "payments", payment.id),
          payment,
        );
      } else {
        setState((s) => {
          const next = { ...s, payments: [payment, ...s.payments] };
          persistLocal(next);
          return next;
        });
      }
      toast({
        title: "Payment recorded",
        description: `${CURRENCY_SYMBOLS[state.business.currency]}${payment.amount.toFixed(2)} received/paid.`,
      });
    },
    [
      businessId,
      firebaseMode,
      persistLocal,
      state.business.currency,
      toast,
      user?.uid,
    ],
  );

  const updateBusiness = useCallback(
    async (
      patch: Partial<
        Pick<
          Business,
          "name" | "phone" | "email" | "address" | "taxNumber" | "logoUrl"
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

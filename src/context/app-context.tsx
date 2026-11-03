"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { Expense, Currency } from "@/types";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import { useInventory } from "@/context/inventory-context";
import { useToast } from "@/hooks/use-toast";

interface AppContextType {
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, "id">) => Promise<void>;
  updateExpense: (expense: Expense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  budget: number;
  setBudget: (amount: number) => Promise<void>;
  openAddExpense: boolean;
  setOpenAddExpense: (open: boolean) => void;
  expenseToEdit: Expense | null;
  setExpenseToEdit: (expense: Expense | null) => void;
  openScanReceipt: boolean;
  setOpenScanReceipt: (open: boolean) => void;
  currency: Currency;
  setCurrency: (currency: Currency) => Promise<void>;
  loading: boolean;
}

export const AppContext = createContext<AppContextType>({
  expenses: [], addExpense: async () => {}, updateExpense: async () => {}, deleteExpense: async () => {},
  budget: 2000, setBudget: async () => {}, openAddExpense: false, setOpenAddExpense: () => {},
  expenseToEdit: null, setExpenseToEdit: () => {}, openScanReceipt: false, setOpenScanReceipt: () => {},
  currency: "KES", setCurrency: async () => {}, loading: true,
});

const localKey = (id: string) => `finai:${id || "guest"}:finance:v1`;
type LocalFinance = { expenses: Expense[]; budget: number };

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { business, loading: inventoryLoading, setCurrency: persistCurrency } = useInventory();
  const { toast } = useToast();
  const businessId = user?.uid ?? "";
  const firebaseConfiguredForUser = Boolean(db && user && businessId);
  const cloudReady = firebaseConfiguredForUser && !inventoryLoading && business.id === businessId;
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budget, setBudgetState] = useState(2000);
  const [loading, setLoading] = useState(true);
  const [openAddExpense, setOpenAddExpense] = useState(false);
  const [openScanReceipt, setOpenScanReceipt] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const currency = business.currency || "KES";

  useEffect(() => {
    // Wait for trusted workspace provisioning and owner verification before
    // subscribing to business-scoped finance collections.
    if (firebaseConfiguredForUser && !cloudReady) {
      setLoading(true);
      return;
    }
    if (cloudReady && db) {
      setLoading(true);
      const expensesRef = collection(db, "businesses", businessId, "expenses");
      const unsubExpenses = onSnapshot(expensesRef, (snap) => {
        setExpenses(snap.docs.map((item) => ({ ...item.data(), id: item.id } as Expense)));
        setLoading(false);
      }, (error) => {
        console.error("Expense sync failed", error);
        setLoading(false);
        toast({ variant: "destructive", title: "Expenses could not sync", description: "Check your connection and workspace permissions, then retry." });
      });
      const unsubBusiness = onSnapshot(doc(db, "businesses", businessId), (snap) => {
        const value = snap.data()?.monthlyBudget;
        if (typeof value === "number" && Number.isFinite(value) && value >= 0) setBudgetState(value);
      }, (error) => console.error("Budget sync failed", error));
      return () => { unsubExpenses(); unsubBusiness(); };
    }
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(localKey(businessId));
        const parsed = saved ? JSON.parse(saved) as Partial<LocalFinance> : {};
        setExpenses(Array.isArray(parsed.expenses) ? parsed.expenses : []);
        setBudgetState(typeof parsed.budget === "number" && parsed.budget >= 0 ? parsed.budget : 2000);
      } catch { setExpenses([]); setBudgetState(2000); }
    }
    setLoading(false);
  }, [businessId, cloudReady, firebaseConfiguredForUser, toast]);

  const persistLocal = useCallback((nextExpenses: Expense[], nextBudget = budget) => {
    if (!cloudReady && typeof window !== "undefined") {
      try { localStorage.setItem(localKey(businessId), JSON.stringify({ expenses: nextExpenses, budget: nextBudget })); }
      catch (error) { console.error("Local finance persistence failed", error); throw new Error("Could not save locally. Check available browser storage."); }
    }
  }, [businessId, budget, cloudReady]);

  const addExpense = useCallback(async (input: Omit<Expense, "id">) => {
    const amount = Number(input.amount);
    const merchant = input.merchant.trim();
    if (!merchant || !Number.isFinite(amount) || amount <= 0 || !input.category || !input.date) throw new Error("Enter a merchant, category, valid date and amount greater than zero.");
    const expense: Expense = { ...input, amount, merchant, id: crypto.randomUUID() };
    if (cloudReady && db) await setDoc(doc(db, "businesses", businessId, "expenses", expense.id), expense);
    else setExpenses((current) => { const next = [expense, ...current]; persistLocal(next); return next; });
    toast({ title: "Expense added", description: `${expense.merchant} has been saved.` });
  }, [businessId, cloudReady, persistLocal, toast]);

  const updateExpense = useCallback(async (expense: Expense) => {
    const amount = Number(expense.amount);
    const merchant = expense.merchant.trim();
    if (!expense.id || !merchant || !Number.isFinite(amount) || amount <= 0 || !expense.category || !expense.date) throw new Error("Enter a merchant, category, valid date and amount greater than zero.");
    const clean = { ...expense, amount, merchant };
    if (cloudReady && db) await updateDoc(doc(db, "businesses", businessId, "expenses", expense.id), clean);
    else setExpenses((current) => { const next = current.map((item) => item.id === expense.id ? clean : item); persistLocal(next); return next; });
    toast({ title: "Expense updated", description: `${merchant} has been saved.` });
  }, [businessId, cloudReady, persistLocal, toast]);

  const deleteExpense = useCallback(async (id: string) => {
    if (!id) throw new Error("Expense ID is missing.");
    if (cloudReady && db) await deleteDoc(doc(db, "businesses", businessId, "expenses", id));
    else setExpenses((current) => { const next = current.filter((item) => item.id !== id); persistLocal(next); return next; });
    toast({ variant: "destructive", title: "Expense deleted", description: "The expense was removed." });
  }, [businessId, cloudReady, persistLocal, toast]);

  const setBudget = useCallback(async (amount: number) => {
    if (!Number.isFinite(amount) || amount < 0) throw new Error("Budget must be a valid non-negative amount.");
    if (cloudReady && db) await setDoc(doc(db, "businesses", businessId), { monthlyBudget: amount }, { merge: true });
    else { setBudgetState(amount); persistLocal(expenses, amount); }
    setBudgetState(amount);
    toast({ title: "Budget saved", description: "Your monthly budget has been saved." });
  }, [businessId, cloudReady, expenses, persistLocal, toast]);

  const value = useMemo(() => ({ expenses, addExpense, updateExpense, deleteExpense, budget, setBudget, openAddExpense, setOpenAddExpense, expenseToEdit, setExpenseToEdit, openScanReceipt, setOpenScanReceipt, currency, setCurrency: persistCurrency, loading }), [expenses, addExpense, updateExpense, deleteExpense, budget, setBudget, openAddExpense, expenseToEdit, openScanReceipt, currency, persistCurrency, loading]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => useContext(AppContext);

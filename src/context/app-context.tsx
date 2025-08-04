"use client";

import React, { createContext, useState, ReactNode } from "react";
import { Expense } from "@/types";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useToast } from "@/hooks/use-toast";

const initialExpenses: Expense[] = [
    { id: '1', amount: 75.50, merchant: 'SuperMart', category: 'Groceries', date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
    { id: '2', amount: 12.00, merchant: 'CoffeeBean', category: 'Food & Drink', date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
    { id: '3', amount: 30.00, merchant: 'Gas Station', category: 'Transport', date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
    { id: '4', amount: 200.00, merchant: 'TechStore', category: 'Shopping', date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
];


interface AppContextType {
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, "id">) => void;
  budget: number;
  setBudget: (amount: number) => void;
  openAddExpense: boolean;
  setOpenAddExpense: (open: boolean) => void;
  expenseToAdd: Omit<Expense, "id"> | null;
  setExpenseToAdd: (expense: Omit<Expense, "id"> | null) => void;
  openScanReceipt: boolean;
  setOpenScanReceipt: (open: boolean) => void;
}

export const AppContext = createContext<AppContextType>({
  expenses: [],
  addExpense: () => {},
  budget: 1000,
  setBudget: () => {},
  openAddExpense: false,
  setOpenAddExpense: () => {},
  expenseToAdd: null,
  setExpenseToAdd: () => {},
  openScanReceipt: false,
  setOpenScanReceipt: () => {},
});

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const [expenses, setExpenses] = useLocalStorage<Expense[]>("expenses", initialExpenses);
  const [budget, setBudget] = useLocalStorage<number>("budget", 2000);
  const [openAddExpense, setOpenAddExpense] = useState(false);
  const [openScanReceipt, setOpenScanReceipt] = useState(false);
  const [expenseToAdd, setExpenseToAdd] = useState<Omit<Expense, "id"> | null>(null);

  const addExpense = (expense: Omit<Expense, "id">) => {
    const newExpense = { ...expense, id: new Date().toISOString() };
    setExpenses((prevExpenses) => [newExpense, ...prevExpenses]);
    toast({
      title: "Expense Added",
      description: `${expense.merchant}: $${expense.amount.toFixed(2)}`,
    });
  };

  return (
    <AppContext.Provider
      value={{
        expenses,
        addExpense,
        budget,
        setBudget,
        openAddExpense,
        setOpenAddExpense,
        expenseToAdd,
        setExpenseToAdd,
        openScanReceipt,
        setOpenScanReceipt,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

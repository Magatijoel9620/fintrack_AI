"use client";

import React, { createContext, useState, ReactNode } from "react";
import { Expense, Currency } from "@/types";
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
  updateExpense: (expense: Expense) => void;
  deleteExpense: (id: string) => void;
  budget: number;
  setBudget: (amount: number) => void;
  openAddExpense: boolean;
  setOpenAddExpense: (open: boolean) => void;
  expenseToEdit: Expense | null;
  setExpenseToEdit: (expense: Expense | null) => void;
  openScanReceipt: boolean;
  setOpenScanReceipt: (open: boolean) => void;
  currency: Currency;
  setCurrency: (currency: Currency) => void;
}

export const AppContext = createContext<AppContextType>({
  expenses: [],
  addExpense: () => {},
  updateExpense: () => {},
  deleteExpense: () => {},
  budget: 1000,
  setBudget: () => {},
  openAddExpense: false,
  setOpenAddExpense: () => {},
  expenseToEdit: null,
  setExpenseToEdit: () => {},
  openScanReceipt: false,
  setOpenScanReceipt: () => {},
  currency: "USD",
  setCurrency: () => {},
});

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const { toast } = useToast();
  const [expenses, setExpenses] = useLocalStorage<Expense[]>("expenses", initialExpenses);
  const [budget, setBudget] = useLocalStorage<number>("budget", 2000);
  const [openAddExpense, setOpenAddExpense] = useState(false);
  const [openScanReceipt, setOpenScanReceipt] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const [currency, setCurrency] = useLocalStorage<Currency>("currency", "USD");

  const addExpense = (expense: Omit<Expense, "id">) => {
    const newExpense = { ...expense, id: new Date().toISOString() };
    setExpenses((prevExpenses) => [newExpense, ...prevExpenses]);
    toast({
      title: "Expense Added",
      description: `${expense.merchant}: $${expense.amount.toFixed(2)}`,
    });
  };
  
  const updateExpense = (updatedExpense: Expense) => {
    setExpenses(prevExpenses => prevExpenses.map(expense => expense.id === updatedExpense.id ? updatedExpense : expense));
    toast({
      title: "Expense Updated",
      description: `${updatedExpense.merchant}: $${updatedExpense.amount.toFixed(2)}`,
    });
  };

  const deleteExpense = (id: string) => {
    setExpenses(prevExpenses => prevExpenses.filter(expense => expense.id !== id));
    toast({
      variant: "destructive",
      title: "Expense Deleted",
      description: `The expense has been successfully deleted.`,
    });
  };
  
  const handleSetCurrency = (newCurrency: Currency) => {
    setCurrency(newCurrency);
    toast({
        title: "Currency Updated",
        description: `Currency has been set to ${newCurrency}.`,
    });
  }

  return (
    <AppContext.Provider
      value={{
        expenses,
        addExpense,
        updateExpense,
        deleteExpense,
        budget,
        setBudget,
        openAddExpense,
        setOpenAddExpense,
        expenseToEdit,
        setExpenseToEdit,
        openScanReceipt,
        setOpenScanReceipt,
        currency,
        setCurrency: handleSetCurrency,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

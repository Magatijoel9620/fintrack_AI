"use client";

import React, { createContext, useState, ReactNode } from "react";
import { Expense, Currency } from "@/types";
import { useToast } from "@/hooks/use-toast";

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
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budget, setBudget] = useState<number>(2000);
  const [openAddExpense, setOpenAddExpense] = useState(false);
  const [openScanReceipt, setOpenScanReceipt] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState<Expense | null>(null);
  const [currency, setCurrency] = useState<Currency>("USD");

  const addExpense = (expense: Omit<Expense, "id">) => {
    // This will be replaced with Firebase logic
    const newExpense = { ...expense, id: new Date().toISOString() };
    setExpenses((prevExpenses) => [newExpense, ...prevExpenses]);
    toast({
      title: "Expense Added",
      description: `${expense.merchant}: $${expense.amount.toFixed(2)}`,
    });
  };
  
  const updateExpense = (updatedExpense: Expense) => {
     // This will be replaced with Firebase logic
    setExpenses(prevExpenses => prevExpenses.map(expense => expense.id === updatedExpense.id ? updatedExpense : expense));
    toast({
      title: "Expense Updated",
      description: `${updatedExpense.merchant}: $${updatedExpense.amount.toFixed(2)}`,
    });
  };

  const deleteExpense = (id: string) => {
     // This will be replaced with Firebase logic
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

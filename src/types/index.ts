export type Expense = {
  id: string;
  amount: number;
  merchant: string;
  category: string;
  date: string; // YYYY-MM-DD
};

export type Currency = "USD" | "EUR" | "GBP" | "JPY";

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    JPY: "¥",
};

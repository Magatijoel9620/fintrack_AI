"use client";

import React, { useContext, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AppContext } from "@/context/app-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const expenseSchema = z.object({
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0."),
  merchant: z.string().min(1, "Merchant is required."),
  category: z.string().min(1, "Category is required."),
  date: z.date({ required_error: "A date is required." }),
});

const categories = [
  "Food & Drink",
  "Groceries",
  "Transport",
  "Shopping",
  "Entertainment",
  "Utilities",
  "Health",
  "Other",
];

export function AddExpenseModal() {
  const { openAddExpense, setOpenAddExpense, addExpense, updateExpense, expenseToEdit, setExpenseToEdit } = useContext(AppContext);

  const form = useForm<z.infer<typeof expenseSchema>>({
    resolver: zodResolver(expenseSchema),
  });

  const isEditing = !!expenseToEdit;

  useEffect(() => {
    if (isEditing) {
        form.reset({
            amount: expenseToEdit.amount,
            merchant: expenseToEdit.merchant,
            category: categories.includes(expenseToEdit.category) ? expenseToEdit.category : "Other",
            date: new Date(expenseToEdit.date),
        });
    } else {
        form.reset({
            amount: undefined,
            merchant: "",
            category: "",
            date: new Date(),
        });
    }
  }, [expenseToEdit, form, isEditing]);

  const onSubmit = (values: z.infer<typeof expenseSchema>) => {
    const expenseData = { ...values, date: format(values.date, "yyyy-MM-dd") };
    if (isEditing && expenseToEdit) {
        updateExpense({ ...expenseData, id: expenseToEdit.id });
    } else {
        addExpense(expenseData);
    }
    form.reset();
    setExpenseToEdit(null);
    setOpenAddExpense(false);
  };
  
  const handleOpenChange = (open: boolean) => {
    if(!open) {
        setExpenseToEdit(null);
        form.reset();
    }
    setOpenAddExpense(open);
  }

  return (
    <Dialog open={openAddExpense} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Expense' : 'Add New Expense'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the details of your transaction below.' : 'Enter the details of your transaction below.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount ($)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="merchant"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Merchant</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Starbucks" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">
              {isEditing ? 'Save Changes' : 'Add Expense'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

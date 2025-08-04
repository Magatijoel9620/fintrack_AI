"use client";

import React, { useContext, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AppContext } from "@/context/app-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const budgetSchema = z.object({
  budget: z.coerce
    .number({ invalid_type_error: "Please enter a valid number." })
    .min(0, "Budget must be a positive number."),
});

export default function BudgetView() {
  const { budget, setBudget, expenses } = useContext(AppContext);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof budgetSchema>>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      budget: budget,
    },
  });

  const onSubmit = (values: z.infer<typeof budgetSchema>) => {
    setBudget(values.budget);
    toast({
      title: "Budget Updated",
      description: `Your new monthly budget is $${values.budget.toFixed(2)}.`,
    });
  };

  const totalSpending = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    return expenses
      .filter((expense) => {
        const expenseDate = new Date(expense.date);
        return (
          expenseDate.getMonth() === currentMonth &&
          expenseDate.getFullYear() === currentYear
        );
      })
      .reduce((sum, expense) => sum + expense.amount, 0);
  }, [expenses]);

  const budgetProgress = budget > 0 ? (totalSpending / budget) * 100 : 0;
  const remainingBudget = budget - totalSpending;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Manage Your Budget</CardTitle>
          <CardDescription>
            Set your monthly spending limit to stay on track.
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent>
              <FormField
                control={form.control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Budget ($)</FormLabel>
                    <FormControl>
                      <Input type="number" step="10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter>
              <Button type="submit">Save Budget</Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Monthly Progress</CardTitle>
          <CardDescription>
            Here's how you're doing this month.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-base font-medium text-primary">Spent</span>
              <span className="text-sm font-medium">
                ${totalSpending.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-base font-medium">Budget</span>
              <span className="text-sm font-medium">
                ${budget.toFixed(2)}
              </span>
            </div>
            <Progress value={budgetProgress} className="w-full" />
          </div>
          <div className="border-t pt-4">
            <div className="flex justify-between">
              <span
                className={`text-lg font-bold ${
                  remainingBudget >= 0 ? "" : "text-destructive"
                }`}
              >
                {remainingBudget >= 0 ? "Remaining:" : "Over budget by:"}
              </span>
              <span
                className={`text-lg font-bold ${
                  remainingBudget >= 0 ? "" : "text-destructive"
                }`}
              >
                ${Math.abs(remainingBudget).toFixed(2)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

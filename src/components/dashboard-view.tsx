"use client";

import React, { useContext, useMemo } from "react";
import { AppContext } from "@/context/app-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { PieChart, Pie, Cell } from "recharts";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { CURRENCY_SYMBOLS } from "@/types";

export default function DashboardView() {
  const { expenses, budget, currency } = useContext(AppContext);
  const currencySymbol = CURRENCY_SYMBOLS[currency];

  const currentMonthExpenses = useMemo(() => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    return expenses.filter((expense) => {
      const expenseDate = new Date(expense.date);
      return (
        expenseDate.getMonth() === currentMonth &&
        expenseDate.getFullYear() === currentYear
      );
    });
  }, [expenses]);

  const totalSpending = useMemo(() => {
    return currentMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  }, [currentMonthExpenses]);

  const remainingBudget = budget - totalSpending;
  const budgetProgress = (totalSpending / budget) * 100;

  const categorySpending = useMemo(() => {
    const spending = new Map<string, number>();
    currentMonthExpenses.forEach((expense) => {
      spending.set(
        expense.category,
        (spending.get(expense.category) || 0) + expense.amount
      );
    });
    return Array.from(spending.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  }, [currentMonthExpenses]);

  const chartConfig = useMemo(() => {
    const config: any = {};
    categorySpending.forEach((category, index) => {
      config[category.name] = {
        label: category.name,
        color: `hsl(var(--chart-${(index % 5) + 1}))`,
      };
    });
    return config;
  }, [categorySpending]);

  const recentExpenses = useMemo(() => {
    return [...expenses]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [expenses]);

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Spending (This Month)
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currencySymbol}{totalSpending.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Your expenses for the current month.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Remaining Budget
            </CardTitle>
            {remainingBudget >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                remainingBudget >= 0 ? "text-green-500" : "text-red-500"
              }`}
            >
              {currencySymbol}{remainingBudget.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              {currencySymbol}{budget.toFixed(2)} monthly budget.
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-full lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Budget Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{budgetProgress.toFixed(1)}%</div>
            <Progress value={budgetProgress} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {categorySpending.length > 0 ? (
              <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
                <PieChart>
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel formatter={(value) => `${currencySymbol}${value.toLocaleString()}`} />}
                  />
                  <Pie data={categorySpending} dataKey="value" nameKey="name" innerRadius={50}>
                     {categorySpending.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={chartConfig[entry.name]?.color} />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                No spending data for this month.
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentExpenses.length > 0 ? (
                  recentExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="font-medium">
                        {expense.merchant}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{expense.category}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {currencySymbol}{expense.amount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground"
                    >
                      No transactions yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, CalendarRange, RefreshCcw, TrendingUp, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useInventory } from "@/context/inventory-context";
import { saleCOGS, summarize } from "@/lib/accounting";
import type { PaymentMethod } from "@/types";

const money = (value: number, symbol: string) =>
  `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const palette = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function dateValue(value: string): number {
  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : 0;
}

export default function ReportsView() {
  const { products, sales, purchases, payments, customers, suppliers, currencySymbol } = useInventory();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = (value: string) => {
    const timestamp = dateValue(value);
    return (!from || timestamp >= new Date(`${from}T00:00:00`).getTime())
      && (!to || timestamp <= new Date(`${to}T23:59:59.999`).getTime());
  };

  const filteredSales = sales.filter((sale) => filtered(sale.createdAt));
  const filteredPurchases = purchases.filter((purchase) => filtered(purchase.createdAt));
  const filteredPayments = payments.filter((payment) => filtered(payment.createdAt));
  const summary = useMemo(
    () => summarize(filteredSales, filteredPurchases, filteredPayments, products, customers, suppliers),
    [filteredSales, filteredPurchases, filteredPayments, products, customers, suppliers],
  );

  const productPerformance = useMemo(
    () => products
      .map((product) => {
        const lines = filteredSales.flatMap((sale) => sale.items.filter((item) => item.productId === product.id));
        const sold = lines.reduce((sum, item) => sum + item.quantity, 0);
        const revenue = lines.reduce((sum, item) => sum + item.total, 0);
        const cogs = filteredSales.reduce(
          (sum, sale) => sum + sale.items
            .filter((item) => item.productId === product.id)
            .reduce((lineSum, item) => lineSum + item.quantity * Number(item.unitCost ?? product.costPrice), 0),
          0,
        );
        return { ...product, sold, revenue, cogs, profit: revenue - cogs };
      })
      .filter((product) => product.sold > 0)
      .sort((a, b) => b.profit - a.profit),
    [products, filteredSales],
  );

  const trend = useMemo(() => {
    if (!filteredSales.length) return [];
    const timestamps = filteredSales.map((sale) => dateValue(sale.createdAt)).filter(Boolean);
    const span = Math.max(...timestamps) - Math.min(...timestamps);
    const daily = span <= 45 * 24 * 60 * 60 * 1000;
    const buckets = new Map<string, { label: string; revenue: number; grossProfit: number }>();

    filteredSales.forEach((sale) => {
      const date = new Date(sale.createdAt);
      if (!Number.isFinite(date.getTime())) return;
      const key = daily
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const label = daily
        ? date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : date.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
      const current = buckets.get(key) ?? { label, revenue: 0, grossProfit: 0 };
      current.revenue += sale.total - sale.tax;
      current.grossProfit += sale.total - sale.tax - saleCOGS(sale, products);
      buckets.set(key, current);
    });

    return [...buckets.entries()]
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([, value]) => ({ ...value, revenue: Number(value.revenue.toFixed(2)), grossProfit: Number(value.grossProfit.toFixed(2)) }));
  }, [filteredSales, products]);

  const paymentMix = useMemo(() => {
    const methods: PaymentMethod[] = ["cash", "mpesa", "card", "credit", "other"];
    return methods
      .map((method) => ({
        name: method === "mpesa" ? "M-Pesa" : method[0].toUpperCase() + method.slice(1),
        value: filteredSales.filter((sale) => sale.paymentMethod === method).reduce((sum, sale) => sum + sale.total, 0),
      }))
      .filter((item) => item.value > 0);
  }, [filteredSales]);

  const activeProducts = products.filter((product) => product.isActive !== false);
  const stockHealth = useMemo(() => {
    const out = activeProducts.filter((product) => product.quantity <= 0).length;
    const reorder = activeProducts.filter((product) => product.quantity > 0 && product.quantity <= product.reorderLevel).length;
    const healthy = Math.max(0, activeProducts.length - out - reorder);
    return [
      { name: "Healthy", value: healthy },
      { name: "Reorder", value: reorder },
      { name: "Out of stock", value: out },
    ].filter((item) => item.value > 0);
  }, [activeProducts]);

  const topProducts = productPerformance.slice(0, 8).reverse();
  const reportCards = [
    { label: "Net sales", value: money(summary.netSales, currencySymbol), note: "Sales less tax", Icon: TrendingUp, span: "lg:col-span-3" },
    { label: "Gross profit", value: money(summary.grossProfit, currencySymbol), note: `${summary.grossMargin.toFixed(1)}% gross margin`, Icon: Wallet, span: "lg:col-span-3" },
    { label: "Cost of goods sold", value: money(summary.cogs, currencySymbol), note: "Based on recorded unit cost", Icon: BarChart3, span: "lg:col-span-3" },
    { label: "Inventory value", value: money(summary.inventoryValue, currencySymbol), note: "Current stock valuation", Icon: CalendarRange, span: "lg:col-span-3" },
  ];

  const resetRange = () => { setFrom(""); setTo(""); };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Badge variant="outline" className="mb-2"><BarChart3 className="mr-1 h-3 w-3" />Business intelligence</Badge>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Financial reports</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            A visual view of profitability, sales mix and stock position, calculated from your recorded transactions.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2 rounded-2xl border bg-card p-3">
          <div><label htmlFor="report-from" className="mb-1 block text-xs text-muted-foreground">From</label><Input id="report-from" type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></div>
          <div><label htmlFor="report-to" className="mb-1 block text-xs text-muted-foreground">To</label><Input id="report-to" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></div>
          <Button variant="outline" className="h-10" onClick={resetRange}><RefreshCcw className="mr-2 h-4 w-4" />All time</Button>
        </div>
      </section>

      <section aria-label="Financial report metrics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
        {reportCards.map(({ label, value, note, Icon, span }) => (
          <Card key={label} className={`overflow-hidden rounded-2xl border-border/80 ${span}`}>
            <CardContent className="flex min-h-32 items-start justify-between gap-3 p-5">
              <div className="min-w-0"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 truncate text-2xl font-bold tracking-tight">{value}</p><p className="mt-2 text-xs text-muted-foreground">{note}</p></div>
              <span className="rounded-xl bg-primary/10 p-2.5 text-primary"><Icon className="h-5 w-5" /></span>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid min-w-0 gap-4 lg:grid-cols-12">
        <Card className="min-w-0 rounded-2xl lg:col-span-7">
          <CardHeader><CardTitle>Sales and gross profit trend</CardTitle><CardDescription>{trend.length > 0 ? "Daily or monthly totals for the selected reporting period." : "Trend lines will appear after sales are recorded."}</CardDescription></CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {trend.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tickLine={false} axisLine={false} width={70} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(value) => `${currencySymbol}${Number(value) >= 1000 ? `${(Number(value) / 1000).toFixed(0)}k` : value}`} />
                    <Tooltip formatter={(value) => money(Number(value), currencySymbol)} contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" name="Net sales" stroke={palette[0]} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="grossProfit" name="Gross profit" stroke={palette[1]} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <div className="grid h-full place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">No sales in this date range yet.</div>}
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 rounded-2xl lg:col-span-5">
          <CardHeader><CardTitle>Sales by payment method</CardTitle><CardDescription>Gross recorded sales grouped by tender type.</CardDescription></CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {paymentMix.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={paymentMix} dataKey="value" nameKey="name" innerRadius={66} outerRadius={100} paddingAngle={3} strokeWidth={2} stroke="hsl(var(--card))">
                      {paymentMix.map((entry, index) => <Cell key={entry.name} fill={palette[index % palette.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => money(Number(value), currencySymbol)} contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                    <Legend verticalAlign="bottom" height={32} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="grid h-full place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">Payment mix will appear after the first sale.</div>}
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 rounded-2xl lg:col-span-7">
          <CardHeader><CardTitle>Top product profitability</CardTitle><CardDescription>Highest gross profit by product in the selected period.</CardDescription></CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {topProducts.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts} layout="vertical" margin={{ top: 4, right: 18, bottom: 4, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(value) => `${currencySymbol}${Number(value) >= 1000 ? `${(Number(value) / 1000).toFixed(0)}k` : value}`} />
                    <YAxis type="category" dataKey="name" width={112} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip formatter={(value) => money(Number(value), currencySymbol)} contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill={palette[0]} radius={[0, 5, 5, 0]} />
                    <Bar dataKey="profit" name="Gross profit" fill={palette[1]} radius={[0, 5, 5, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="grid h-full place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">Product performance will appear after recorded sales.</div>}
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 rounded-2xl lg:col-span-5">
          <CardHeader><CardTitle>Inventory health</CardTitle><CardDescription>Active products by their current stock status.</CardDescription></CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {stockHealth.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stockHealth} dataKey="value" nameKey="name" innerRadius={66} outerRadius={100} paddingAngle={3} strokeWidth={2} stroke="hsl(var(--card))">
                      {stockHealth.map((entry, index) => <Cell key={entry.name} fill={entry.name === "Healthy" ? palette[1] : entry.name === "Reorder" ? palette[2] : "hsl(var(--destructive))"} />)}
                    </Pie>
                    <Tooltip formatter={(value) => `${Number(value)} product${Number(value) === 1 ? "" : "s"}`} contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                    <Legend verticalAlign="bottom" height={32} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="grid h-full place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">Add active products to see stock health.</div>}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle>Profit bridge</CardTitle><CardDescription>How recorded sales translate into gross profit.</CardDescription></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between gap-3"><span>Gross sales</span><span className="font-medium tabular-nums">{money(summary.grossSales, currencySymbol)}</span></div>
          <div className="flex justify-between gap-3"><span>Less: VAT / tax</span><span className="font-medium tabular-nums">−{money(summary.salesTax, currencySymbol)}</span></div>
          <div className="flex justify-between gap-3"><span>Net sales</span><span className="font-medium tabular-nums">{money(summary.netSales, currencySymbol)}</span></div>
          <div className="flex justify-between gap-3"><span>Less: cost of goods sold</span><span className="font-medium tabular-nums">−{money(summary.cogs, currencySymbol)}</span></div>
          <Separator />
          <div className="flex justify-between gap-3 text-lg font-bold"><span>Gross profit</span><span className="tabular-nums">{money(summary.grossProfit, currencySymbol)}</span></div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><div className="flex items-center justify-between gap-3"><div><CardTitle>Product profitability</CardTitle><CardDescription>Product-level results for this reporting period.</CardDescription></div><Badge variant="outline">{productPerformance.length} products</Badge></div></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Units sold</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">COGS</TableHead><TableHead className="text-right">Gross profit</TableHead></TableRow></TableHeader>
              <TableBody>
                {productPerformance.length ? productPerformance.map((product) => (
                  <TableRow key={product.id}><TableCell className="font-medium">{product.name}</TableCell><TableCell className="text-right">{product.sold}</TableCell><TableCell className="text-right">{money(product.revenue, currencySymbol)}</TableCell><TableCell className="text-right">{money(product.cogs, currencySymbol)}</TableCell><TableCell className="text-right font-semibold">{money(product.profit, currencySymbol)}</TableCell></TableRow>
                )) : <TableRow><TableCell colSpan={5} className="h-20 text-center text-muted-foreground">No product sales in this period.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader><CardTitle>Inventory valuation</CardTitle><CardDescription>Current product balances are shown regardless of the selected transaction date range.</CardDescription></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Qty</TableHead><TableHead>Unit cost</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
              <TableBody>
                {products.length ? products.map((product) => (
                  <TableRow key={product.id}><TableCell className="font-medium">{product.name}</TableCell><TableCell>{product.quantity} {product.unit}</TableCell><TableCell>{money(product.costPrice, currencySymbol)}</TableCell><TableCell className="text-right">{money(product.quantity * product.costPrice, currencySymbol)}</TableCell></TableRow>
                )) : <TableRow><TableCell colSpan={4} className="h-20 text-center text-muted-foreground">No products have been added.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

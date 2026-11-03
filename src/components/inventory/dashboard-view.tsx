"use client";

import { useMemo } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Boxes,
  PackageCheck,
  PackageX,
  ShoppingCart,
  Sparkles,
  Truck,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useInventory } from "@/context/inventory-context";
import { CURRENCY_SYMBOLS } from "@/types";

const money = (value: number, symbol: string) =>
  `${symbol}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function InventoryDashboard() {
  const { products, sales, purchases, movements, business } = useInventory();
  const symbol = CURRENCY_SYMBOLS[business.currency];
  const stockValue = products.reduce((sum, product) => sum + product.quantity * product.costPrice, 0);
  const today = new Date();
  const salesToday = sales
    .filter((sale) => new Date(sale.createdAt).toDateString() === today.toDateString())
    .reduce((sum, sale) => sum + sale.total, 0);

  const activeProducts = products.filter((product) => product.isActive !== false);
  const low = activeProducts.filter((product) => product.quantity > 0 && product.quantity <= product.reorderLevel);
  const out = activeProducts.filter((product) => product.quantity <= 0);
  const healthyCount = Math.max(0, activeProducts.length - low.length - out.length);
  const attentionCount = low.length + out.length;

  const chart = useMemo(
    () =>
      Array.from({ length: 14 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (13 - index));
        const day = date.toDateString();
        return {
          date: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          sales: sales
            .filter((sale) => new Date(sale.createdAt).toDateString() === day)
            .reduce((sum, sale) => sum + sale.total, 0),
        };
      }),
    [sales],
  );

  const stats = [
    {
      label: "Inventory value",
      value: money(stockValue, symbol),
      detail: "Current stock at recorded unit cost",
      Icon: Banknote,
      span: "xl:col-span-6",
      featured: true,
    },
    {
      label: "Sales today",
      value: money(salesToday, symbol),
      detail: "Revenue from today's recorded sales",
      Icon: ShoppingCart,
      span: "xl:col-span-6",
      featured: true,
    },
    {
      label: "Products",
      value: activeProducts.length.toLocaleString(),
      detail: "Active catalogue",
      Icon: Boxes,
      span: "xl:col-span-3",
    },
    {
      label: "Low stock",
      value: low.length.toLocaleString(),
      detail: "At or below reorder level",
      Icon: AlertTriangle,
      span: "xl:col-span-3",
    },
    {
      label: "Out of stock",
      value: out.length.toLocaleString(),
      detail: "Unavailable items",
      Icon: PackageX,
      span: "xl:col-span-3",
    },
    {
      label: "Purchases",
      value: purchases.length.toLocaleString(),
      detail: "Recorded purchase documents",
      Icon: Truck,
      span: "xl:col-span-3",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-[#0c1427] p-6 text-white md:p-8">
        <div className="absolute -right-8 -top-20 h-64 w-64 rounded-full bg-[#3d65c2]/30 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#b1c1e7]">Business overview</p>
            <h2 className="mt-3 max-w-2xl font-headline text-3xl font-bold tracking-tight md:text-4xl">
              Good business starts with a clear picture.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">
              A live view of stock, sales and purchasing for {business.name}.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-slate-200">Workspace connected</span>
          </div>
        </div>
      </section>

      {/* Bento KPI grid: two larger financial anchors followed by four compact signals. */}
      <section aria-label="Business key performance indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-12">
        {stats.map(({ label, value, detail, Icon, span, featured }) => (
          <Card
            key={label}
            className={`group relative overflow-hidden rounded-2xl border-border/80 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${span}`}
          >
            {featured && <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-primary/[0.06] blur-2xl" />}
            <CardContent className={`relative flex h-full items-start justify-between gap-4 ${featured ? "min-h-36 p-6" : "min-h-28 p-5"}`}>
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">{label}</p>
                <p className={`mt-2 truncate font-bold tracking-tight ${featured ? "text-3xl sm:text-4xl" : "text-2xl"}`}>
                  {value}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
              </div>
              <div className={`shrink-0 rounded-2xl bg-primary/10 text-primary transition duration-200 group-hover:scale-105 ${featured ? "p-3.5" : "p-2.5"}`}>
                <Icon className={featured ? "h-6 w-6" : "h-5 w-5"} />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <Card className="min-w-0 rounded-2xl">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Sales activity</CardTitle>
                <CardDescription>Daily recorded sales over the last 14 days.</CardDescription>
              </div>
              <Badge variant="outline"><Activity className="mr-1 h-3 w-3" />14 days</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[270px] w-full">
              {sales.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="finaiSalesFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tickLine={false} axisLine={false} width={64} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(value) => `${symbol}${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`} />
                    <Tooltip formatter={(value) => money(Number(value), symbol)} contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                    <Area type="monotone" dataKey="sales" name="Sales" stroke="hsl(var(--chart-1))" strokeWidth={2.5} fill="url(#finaiSalesFill)" activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="grid h-full place-items-center rounded-xl border border-dashed text-sm text-muted-foreground">
                  <div className="text-center"><Sparkles className="mx-auto mb-2 h-6 w-6" /><p>Sales activity will appear here.</p><p className="mt-1 text-xs">Record your first sale to begin tracking trends.</p></div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 rounded-2xl">
          <CardHeader>
            <CardTitle>Stock health</CardTitle>
            <CardDescription>Live inventory signals that deserve attention.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={`flex items-center gap-3 rounded-2xl border p-4 ${attentionCount ? "border-amber-500/25 bg-amber-500/[0.07]" : "border-emerald-500/25 bg-emerald-500/[0.07]"}`}>
              <span className={`text-3xl motion-safe:animate-bounce motion-reduce:animate-none ${attentionCount ? "" : ""}`} aria-hidden="true">
                {attentionCount ? "🚦" : "🎉"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{attentionCount ? "Stock needs a look" : "All stocked up"}</p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {attentionCount
                    ? `${out.length} out of stock · ${low.length} at reorder level`
                    : `${healthyCount} active product${healthyCount === 1 ? "" : "s"} above reorder level`}
                </p>
              </div>
              <Badge variant={attentionCount ? "outline" : "secondary"} className="shrink-0">
                {attentionCount ? `${attentionCount} alert${attentionCount === 1 ? "" : "s"}` : "Healthy"}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1.5 text-emerald-700 dark:text-emerald-300"><PackageCheck className="h-3.5 w-3.5" />{healthyCount} healthy</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1.5 text-amber-700 dark:text-amber-300"><AlertTriangle className="h-3.5 w-3.5" />{low.length} reorder</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1.5 text-destructive"><PackageX className="h-3.5 w-3.5" />{out.length} unavailable</span>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Available</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {[...out, ...low].slice(0, 7).length ? (
                  [...out, ...low].slice(0, 7).map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="max-w-[140px] truncate font-medium">{product.name}</TableCell>
                      <TableCell>{product.quantity} {product.unit}</TableCell>
                      <TableCell>{product.quantity <= 0 ? <Badge variant="destructive">🚨 Out</Badge> : <Badge variant="outline">⚠️ Reorder</Badge>}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={3} className="h-16 text-center text-sm text-muted-foreground">No stock alerts. Keep it up! ✨</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div><CardTitle>Recent stock movements</CardTitle><CardDescription>Latest adjustments, receipts and dispatches.</CardDescription></div>
            <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Movement</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Quantity</TableHead></TableRow></TableHeader>
            <TableBody>
              {movements.slice(0, 6).map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell className="font-medium">{movement.productName}</TableCell>
                  <TableCell><Badge variant="outline">{movement.type}</Badge></TableCell>
                  <TableCell>{movement.reference || movement.note || "—"}</TableCell>
                  <TableCell className="text-right font-medium">
                    <span className="inline-flex items-center justify-end gap-1">
                      {movement.quantity > 0 ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" /> : <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />}
                      {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {!movements.length && <TableRow><TableCell colSpan={4} className="h-20 text-center text-muted-foreground">Stock movements will appear here as you work.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

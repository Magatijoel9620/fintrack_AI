"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Bell, Building2, FileText, Info, Save, ShoppingBag, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useInventory } from "@/context/inventory-context";
import { useAuth } from "@/context/auth-context";
import { Currency } from "@/types";
import { db } from "@/lib/firebase";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

type AlertKey = "lowStock" | "outOfStock" | "salesRecorded" | "purchasesReceived" | "paymentDue" | "dailySummary";
type AlertPreferences = Record<AlertKey, boolean>;
const DEFAULT_ALERTS: AlertPreferences = {
  lowStock: true,
  outOfStock: true,
  salesRecorded: false,
  purchasesReceived: false,
  paymentDue: true,
  dailySummary: false,
};
const ALERT_OPTIONS: { key: AlertKey; title: string; description: string; Icon: typeof Bell }[] = [
  { key: "lowStock", title: "Low-stock reminders", description: "Highlight products that reach or fall below their reorder level.", Icon: AlertTriangle },
  { key: "outOfStock", title: "Out-of-stock alerts", description: "Flag products that have no available quantity.", Icon: AlertTriangle },
  { key: "salesRecorded", title: "Sales activity", description: "Surface a workspace alert when a sale is recorded.", Icon: ShoppingBag },
  { key: "purchasesReceived", title: "Purchase activity", description: "Surface a workspace alert when stock is received through a purchase.", Icon: Building2 },
  { key: "paymentDue", title: "Outstanding payment reminders", description: "Highlight customer balances and supplier amounts still due.", Icon: Wallet },
  { key: "dailySummary", title: "Daily business summary", description: "Opt in to a future daily snapshot of sales, stock and cash activity.", Icon: FileText },
];

function mergeAlerts(value: unknown): AlertPreferences {
  if (!value || typeof value !== "object") return DEFAULT_ALERTS;
  const source = value as Partial<Record<AlertKey, unknown>>;
  return Object.fromEntries(Object.keys(DEFAULT_ALERTS).map((key) => [
    key,
    typeof source[key as AlertKey] === "boolean" ? source[key as AlertKey] : DEFAULT_ALERTS[key as AlertKey],
  ])) as AlertPreferences;
}

export default function SettingsView() {
  const { business, updateBusiness } = useInventory();
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: business.name,
    phone: business.phone || "",
    email: business.email || "",
    address: business.address || "",
    taxNumber: business.taxNumber || "",
  });
  const [currency, setCurrency] = useState<Currency>(business.currency);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [alerts, setAlerts] = useState<AlertPreferences>(DEFAULT_ALERTS);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [savingAlerts, setSavingAlerts] = useState(false);

  useEffect(() => {
    setForm({ name: business.name, phone: business.phone || "", email: business.email || "", address: business.address || "", taxNumber: business.taxNumber || "" });
    setCurrency(business.currency);
  }, [business]);

  useEffect(() => {
    let active = true;
    const loadAlerts = async () => {
      setLoadingAlerts(true);
      try {
        if (db && user?.uid) {
          const snapshot = await getDoc(doc(db, "users", user.uid));
          const stored = snapshot.data()?.businessPreferences?.notificationPreferences;
          if (active) setAlerts(mergeAlerts(stored));
        } else if (typeof window !== "undefined") {
          const stored = localStorage.getItem(`finai:${user?.uid || "guest"}:business-alerts:v1`);
          if (active) setAlerts(mergeAlerts(stored ? JSON.parse(stored) : null));
        }
      } catch (error) {
        console.error("Business alert preferences could not be loaded", error);
        if (active) toast({ variant: "destructive", title: "Alert preferences unavailable", description: "Your business profile is still available. Try reloading this page." });
      } finally {
        if (active) setLoadingAlerts(false);
      }
    };
    void loadAlerts();
    return () => { active = false; };
  }, [user?.uid, toast]);

  const saveBusiness = async () => {
    if (savingBusiness) return;
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "Business name required", description: "Enter the name that should appear on your invoices." });
      return;
    }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast({ variant: "destructive", title: "Invalid business email", description: "Enter a valid business email address." });
      return;
    }
    setSavingBusiness(true);
    try {
      await updateBusiness({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        taxNumber: form.taxNumber.trim(),
        currency,
      });
      toast({ title: "Business profile saved", description: "Your invoice identity and workspace currency have been updated." });
    } catch (error) {
      toast({ variant: "destructive", title: "Business settings were not saved", description: error instanceof Error ? error.message : "Check your connection and permissions." });
    } finally {
      setSavingBusiness(false);
    }
  };

  const saveAlerts = async () => {
    if (savingAlerts) return;
    setSavingAlerts(true);
    try {
      if (db && user?.uid) {
        await setDoc(doc(db, "users", user.uid), {
          businessPreferences: { notificationPreferences: alerts },
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } else if (typeof window !== "undefined") {
        localStorage.setItem(`finai:${user?.uid || "guest"}:business-alerts:v1`, JSON.stringify(alerts));
      }
      toast({ title: "Alert preferences saved", description: "Your workspace alert choices have been saved." });
    } catch (error) {
      toast({ variant: "destructive", title: "Alert preferences were not saved", description: error instanceof Error ? error.message : "Check your connection and try again." });
    } finally {
      setSavingAlerts(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Workspace preferences</p>
        <h2 className="font-headline text-2xl font-bold tracking-tight sm:text-3xl">Business settings</h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Manage the business identity shown across your workspace and on future invoice documents. Personal account details live in Account profile.</p>
      </section>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" />Business profile</CardTitle>
          <CardDescription>Your business identity and contact details, kept separate from your personal sign-in profile.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-2"><Label htmlFor="business-name">Business name</Label><Input id="business-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Business or trading name" /></div>
          <div className="space-y-2"><Label htmlFor="business-phone">Business phone</Label><Input id="business-phone" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+254…" /></div>
          <div className="space-y-2"><Label htmlFor="business-email">Business email</Label><Input id="business-email" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="office@example.com" /></div>
          <div className="sm:col-span-2 space-y-2"><Label htmlFor="business-address">Business address</Label><Input id="business-address" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} placeholder="Street, town, county" /></div>
          <div className="space-y-2"><Label htmlFor="business-tax">Tax PIN / VAT number</Label><Input id="business-tax" value={form.taxNumber} onChange={(event) => setForm((current) => ({ ...current, taxNumber: event.target.value }))} placeholder="Optional tax reference" /></div>
          <div className="space-y-2"><Label htmlFor="business-currency">Workspace currency</Label><Select value={currency} onValueChange={(value) => setCurrency(value as Currency)}><SelectTrigger id="business-currency" className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{(["KES", "USD", "EUR", "GBP", "JPY"] as Currency[]).map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}</SelectContent></Select></div>
          <div className="sm:col-span-2 flex flex-col gap-3 rounded-xl border border-dashed bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-semibold">Invoice identity</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Business name, address, phone, email, tax PIN and currency are used by invoice and report views. Logo upload has been removed from this settings flow.</p></div>
            <FileText className="h-7 w-7 shrink-0 text-primary/70" />
          </div>
          <div className="sm:col-span-2 flex justify-end border-t pt-4"><Button onClick={() => void saveBusiness()} disabled={savingBusiness}><Save className="h-4 w-4" />{savingBusiness ? "Saving business…" : "Save business profile"}</Button></div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" />Notifications & alerts</CardTitle>
          <CardDescription>Choose which business signals should be highlighted for this workspace.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {ALERT_OPTIONS.map(({ key, title, description, Icon }) => (
            <div key={key} className="flex items-center justify-between gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-muted/45">
              <div className="flex min-w-0 items-start gap-3"><div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></div><div className="min-w-0"><Label htmlFor={`alert-${key}`} className="cursor-pointer text-sm font-semibold">{title}</Label><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div></div>
              <Switch id={`alert-${key}`} checked={alerts[key]} disabled={loadingAlerts || savingAlerts} onCheckedChange={(checked) => setAlerts((current) => ({ ...current, [key]: checked }))} aria-label={title} />
            </div>
          ))}
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-primary/15 bg-primary/[0.04] p-3 text-xs leading-5 text-muted-foreground"><Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p>These preferences are saved to your private account settings. They define the signals to surface as the in-app notification centre is expanded; automated email and push delivery are not enabled in this release.</p></div>
          <div className="flex justify-end border-t pt-4"><Button onClick={() => void saveAlerts()} disabled={loadingAlerts || savingAlerts}><Save className="h-4 w-4" />{savingAlerts ? "Saving preferences…" : "Save alert preferences"}</Button></div>
        </CardContent>
      </Card>
    </div>
  );
}

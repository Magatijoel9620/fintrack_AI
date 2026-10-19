"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useInventory } from "@/context/inventory-context";

export default function ContactsView() {
  const { suppliers, customers, addSupplier, addCustomer } = useInventory();
  const [tab, setTab] = useState<"suppliers" | "customers">("suppliers");
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [email, setEmail] = useState("");
  const submit = async () => { if (!name.trim()) return; if (tab === "suppliers") await addSupplier({ name: name.trim(), phone: phone || undefined, email: email || undefined, balance: 0 }); else await addCustomer({ name: name.trim(), phone: phone || undefined, email: email || undefined, balance: 0 }); setName(""); setPhone(""); setEmail(""); };
  const rows = tab === "suppliers" ? suppliers : customers;
  return <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
    <Card><CardHeader><CardTitle>Add {tab === "suppliers" ? "supplier" : "customer"}</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-2"><Button variant={tab === "suppliers" ? "default" : "outline"} onClick={() => setTab("suppliers")}>Suppliers</Button><Button variant={tab === "customers" ? "default" : "outline"} onClick={() => setTab("customers")}>Customers</Button></div>
      <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Business or person" /></div>
      <div><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="07xx xxx xxx" /></div>
      <div><Label>Email</Label><Input value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" /></div>
      <Button className="w-full" onClick={submit}>Add {tab === "suppliers" ? "supplier" : "customer"}</Button>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>{tab === "suppliers" ? "Suppliers" : "Customers"}</CardTitle></CardHeader><CardContent className="space-y-3">
      {rows.length ? rows.map(r => <div key={r.id} className="rounded-lg border p-4"><div className="font-medium">{r.name}</div><div className="text-sm text-muted-foreground">{r.phone || "No phone"}{r.email ? ` • ${r.email}` : ""}</div></div>) : <p className="py-12 text-center text-muted-foreground">No {tab} yet.</p>}
    </CardContent></Card>
  </div>;
}

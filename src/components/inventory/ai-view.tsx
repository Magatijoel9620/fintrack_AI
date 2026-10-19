"use client";
import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Sparkles, Send, AlertTriangle, TrendingUp, PackageSearch } from "lucide-react";
import { useInventory } from "@/context/inventory-context";
import { useAuth } from "@/context/auth-context";
import { inventoryAssistant } from "@/ai/flows/inventory-assistant";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";
const prompts = ["Which products should I reorder first?", "What are my best-selling products?", "Summarize inventory risks and opportunities."];
export default function AIView() {
  const { products, sales, purchases, business } = useInventory();
  const { user } = useAuth();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const lowStock = useMemo(() => products.filter(p => p.isActive && p.quantity <= p.reorderLevel), [products]);
  const ask = async (question = q) => {
    const prompt = question.trim();
    if (!prompt || loading) return;
    setLoading(true); setAnswer("");
    try {
      const currentUser = auth?.currentUser;
      if (!currentUser) throw new Error("Please sign in again to use your business assistant.");
      const idToken = await currentUser.getIdToken();
      const result = await inventoryAssistant({
        idToken,
        businessId: currentUser.uid,
        question: prompt,
        inventory: JSON.stringify(products.slice(0, 250).map(p => ({name:p.name,sku:p.sku,category:p.category,quantity:p.quantity,reorderLevel:p.reorderLevel,costPrice:p.costPrice,sellingPrice:p.sellingPrice,isActive:p.isActive}))),
        sales: JSON.stringify(sales.slice(0, 100).map(s => ({date:s.createdAt,total:s.total,items:s.items.map(i=>({name:i.productName,quantity:i.quantity,unitPrice:i.unitPrice,unitCost:i.unitCost}))}))),
        purchases: JSON.stringify(purchases.slice(0, 100).map(x=>({date:x.createdAt,total:x.total,items:x.items.map(i=>({name:i.productName,quantity:i.quantity,unitCost:i.unitCost}))}))),
      });
      setAnswer(result.answer);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again in a moment.";
      toast({variant:"destructive", title:"Couldn't complete the analysis", description: message});
    } finally { setLoading(false); }
  };
  return <div className="mx-auto max-w-6xl space-y-6">
    <section className="relative overflow-hidden rounded-3xl bg-[#0c1427] p-6 text-white md:p-8"><div className="absolute -right-10 -top-16 h-64 w-64 rounded-full bg-[#3d65c2]/30 blur-3xl"/><div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><div className="max-w-2xl"><Badge className="mb-3 border-white/15 bg-white/10 text-white"><Sparkles className="mr-1 h-3 w-3"/>Gemini-powered insights</Badge><h2 className="font-headline text-3xl font-bold tracking-tight">Make your inventory work smarter.</h2><p className="mt-2 text-sm leading-6 text-slate-300">Ask practical questions about stock, sales and purchasing. Answers use the current business data provided to the AI, not a generic demo dataset.</p></div><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><PackageSearch className="mb-2 h-5 w-5 text-[#b1c1e7]"/><p className="text-2xl font-semibold">{products.length}</p><p className="text-xs text-slate-300">Products tracked</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><AlertTriangle className="mb-2 h-5 w-5 text-amber-300"/><p className="text-2xl font-semibold">{lowStock.length}</p><p className="text-xs text-slate-300">At reorder level</p></div></div></div></section>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)]"><Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary"/>Ask your business assistant</CardTitle><CardDescription>AI suggestions support decisions; verify financial and purchasing decisions before acting.</CardDescription></CardHeader><CardContent className="space-y-4"><Textarea value={q} onChange={e=>setQ(e.target.value)} placeholder="Ask about reordering, product performance, purchasing or stock risk…" rows={4}/><div className="flex justify-end"><Button onClick={()=>ask()} disabled={loading||!q.trim()}>{loading?"Analyzing…":<><Send className="mr-2 h-4 w-4"/>Ask Gemini</>}</Button></div>{loading&&<div className="animate-pulse rounded-xl bg-muted p-5 text-sm text-muted-foreground">Reviewing business metrics…</div>}{answer&&<div className="whitespace-pre-wrap rounded-xl border bg-muted/40 p-5 text-sm leading-7">{answer}</div>}</CardContent></Card><Card className="rounded-2xl"><CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary"/>Suggested questions</CardTitle><CardDescription>Start with a useful business question.</CardDescription></CardHeader><CardContent className="space-y-3">{prompts.map((prompt,i)=><button type="button" key={prompt} onClick={()=>{setQ(prompt);void ask(prompt)}} className="flex w-full items-start gap-3 rounded-xl border p-4 text-left text-sm transition hover:border-primary/50 hover:bg-muted/60"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">{i+1}</span><span>{prompt}</span></button>)}</CardContent></Card></div>
    <p className="text-xs text-muted-foreground">Business: {business.name}. Only a bounded summary of product and transaction data is sent to Gemini for the requested analysis. Avoid entering passwords, payment credentials or other secrets into prompts.</p>
  </div>;
}

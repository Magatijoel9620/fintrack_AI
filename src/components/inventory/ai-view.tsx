"use client";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Sparkles, Send, AlertTriangle, TrendingUp, PackageSearch } from "lucide-react";
import { useInventory } from "@/context/inventory-context";
import { inventoryAssistant } from "@/ai/flows/inventory-assistant";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";
const prompts = ["Which products should I reorder first?", "What are my best-selling products?", "Summarize inventory risks and opportunities."];
const loadingMessages = [
  "Reviewing your question…",
  "Checking the available inventory summary…",
  "Comparing the supplied sales and purchase data…",
  "Preparing practical recommendations…",
];
export default function AIView() {
  const { products, sales, purchases, business } = useInventory();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  useEffect(() => {
    if (!loading) {
      setLoadingStage(0);
      return;
    }
    const timer = window.setInterval(() => {
      setLoadingStage((stage) => (stage + 1) % loadingMessages.length);
    }, 2200);
    return () => window.clearInterval(timer);
  }, [loading]);
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
  return <div className="mx-auto min-w-0 max-w-6xl space-y-4 sm:space-y-6">
    <section className="relative overflow-hidden rounded-2xl bg-[#0c1427] p-4 text-white sm:rounded-3xl sm:p-6 md:p-8"><div className="absolute -right-10 -top-16 h-64 w-64 rounded-full bg-[#3d65c2]/30 blur-3xl"/><div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><div className="max-w-2xl"><Badge className="mb-3 border-white/15 bg-white/10 text-white"><Sparkles className="mr-1 h-3 w-3"/>Gemini-powered insights</Badge><h2 className="font-headline text-2xl font-bold tracking-tight sm:text-3xl">Make your inventory work smarter.</h2><p className="mt-2 text-sm leading-6 text-slate-300">Ask practical questions about stock, sales and purchasing. Answers use the current business data provided to the AI, not a generic demo dataset.</p></div><div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><PackageSearch className="mb-2 h-5 w-5 text-[#b1c1e7]"/><p className="text-2xl font-semibold">{products.length}</p><p className="text-xs text-slate-300">Products tracked</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-4"><AlertTriangle className="mb-2 h-5 w-5 text-amber-300"/><p className="text-2xl font-semibold">{lowStock.length}</p><p className="text-xs text-slate-300">At reorder level</p></div></div></div></section>
    <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)]"><Card className="min-w-0 rounded-2xl"><CardHeader className="p-4 sm:p-6"><CardTitle className="flex items-center gap-2 text-base sm:text-lg"><Bot className="h-5 w-5 shrink-0 text-primary"/>Ask your business assistant</CardTitle><CardDescription>AI suggestions support decisions; verify financial and purchasing decisions before acting.</CardDescription></CardHeader><CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0"><Textarea className="min-h-28 resize-y text-base sm:text-sm" value={q} onChange={e=>setQ(e.target.value)} placeholder="Ask about reordering, product performance, purchasing or stock risk…" rows={4} maxLength={1200}/><div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><p className="self-center text-xs text-muted-foreground sm:mr-auto">Keep questions focused for the most useful answer.</p><Button className="min-h-11 w-full sm:w-auto" onClick={()=>ask()} disabled={loading||!q.trim()}>{loading?"Analyzing…":<><Send className="mr-2 h-4 w-4"/>Ask FinAI</>}</Button></div>{loading&&<div role="status" aria-live="polite" className="rounded-xl border bg-muted/60 p-4 text-sm text-muted-foreground"><div className="mb-2 flex items-center gap-2 font-medium text-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-primary"/>{loadingMessages[loadingStage]}</div><p className="text-xs leading-5">This can take a little while while the assistant prepares your response. You can stay on this screen.</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border"><div className="h-full w-1/3 animate-[finai-progress_1.8s_ease-in-out_infinite] rounded-full bg-primary"/></div></div>}{answer&&<div className="whitespace-pre-wrap rounded-xl border bg-muted/40 p-5 text-sm leading-7">{answer}</div>}</CardContent></Card><Card className="min-w-0 rounded-2xl"><CardHeader className="p-4 sm:p-6"><CardTitle className="flex items-center gap-2 text-base sm:text-lg"><TrendingUp className="h-5 w-5 shrink-0 text-primary"/>Suggested questions</CardTitle><CardDescription>Start with a useful business question.</CardDescription></CardHeader><CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">{prompts.map((prompt,i)=><button type="button" key={prompt} onClick={()=>{setQ(prompt);void ask(prompt)}} className="flex min-h-12 w-full items-start gap-3 rounded-xl border p-3 text-left text-sm transition hover:border-primary/50 hover:bg-muted/60 sm:p-4"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">{i+1}</span><span>{prompt}</span></button>)}</CardContent></Card></div>
    <p className="break-words text-xs leading-5 text-muted-foreground">Business: {business.name}. A bounded summary of product and transaction data is sent to Gemini for this analysis. Do not enter passwords, payment credentials or other secrets.</p>
  </div>;
}

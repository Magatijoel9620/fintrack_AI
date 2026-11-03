"use client";
import { useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Plus, Mic, Sun, Moon, Search, ChevronDown, LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "next-themes";
import { useVoiceRecognition } from "@/hooks/use-voice-recognition";
import { useToast } from "@/hooks/use-toast";

type View = "dashboard" | "products" | "stock" | "sales" | "purchases" | "reports" | "contacts" | "accounting" | "ai" | "settings" | "subscriptions" | "business-admin";
export default function AppHeader({ title, onNavigate, onOpenCommandPalette }: { title: string; onNavigate: (view: View) => void; onOpenCommandPalette: () => void }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const { isListening, startListening, stopListening } = useVoiceRecognition();
  const { toast } = useToast();
  const toggleTheme = () => setTheme((resolvedTheme || theme) === "dark" ? "light" : "dark");
  const mic = () => {
    if (isListening) stopListening();
    else {
      startListening();
      toast({ title: "Voice search started", description: "Try saying products, sales, purchases, or stock." });
    }
  };

  return <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b bg-card px-4 md:px-6">
    <div className="flex min-w-0 items-center gap-3"><SidebarTrigger className="md:hidden"/><div className="flex min-w-0 items-center gap-2.5 md:hidden"><img src="/finai.png" alt="FinAI" className="h-8 w-8 rounded-lg object-cover"/><span className="truncate text-base font-bold tracking-tight">FinAI</span></div><h1 className="hidden truncate text-xl font-semibold md:block">{title}</h1></div>
    <div className="flex shrink-0 items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onOpenCommandPalette} className="h-9 gap-2 px-2.5 sm:px-3" aria-label="Open global search and command palette"><Search className="h-4 w-4"/><span className="hidden sm:inline">Search</span><kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground md:inline">Ctrl / ⌘ K</kbd></Button>
      <Button size="icon" className="h-10 w-10 sm:h-9 sm:w-auto sm:px-3" onClick={()=>onNavigate("products")} aria-label="Add product" title="Add product"><Plus className="h-4 w-4 sm:mr-2"/><span className="hidden sm:inline">Product</span></Button>
      <Button variant="ghost" size="icon" onClick={mic} aria-label={isListening ? "Stop voice search" : "Start voice search"} title={isListening ? "Stop voice search" : "Voice search"} className={isListening?"bg-destructive text-destructive-foreground":""}><Mic className="h-4 w-4"/></Button>
      <div className="relative"><Button variant="ghost" className="gap-2 px-2" onClick={()=>setProfileOpen(v=>!v)} aria-expanded={profileOpen} aria-label="Open account menu"><Avatar className="h-8 w-8"><AvatarFallback>{(user?.displayName||user?.email||"U").charAt(0).toUpperCase()}</AvatarFallback></Avatar><ChevronDown className="h-3.5 w-3.5"/></Button>{profileOpen&&<div className="absolute right-0 top-11 z-50 w-56 rounded-xl border bg-card p-2 shadow-xl"><div className="border-b px-3 py-2"><p className="truncate text-sm font-semibold">{user?.displayName||"Your account"}</p><p className="truncate text-xs text-muted-foreground">{user?.email}</p></div><button onClick={()=>{setProfileOpen(false);onNavigate("business-admin")}} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"><UserRound className="h-4 w-4"/>Business Admin</button><button onClick={()=>{setProfileOpen(false);onNavigate("settings")}} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted">Settings</button><button onClick={()=>void logout()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-destructive hover:bg-muted"><LogOut className="h-4 w-4"/>Sign out</button></div>}</div>
      <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={`Switch to ${(resolvedTheme || theme) === "dark" ? "light" : "dark"} mode`} title={`Switch to ${(resolvedTheme || theme) === "dark" ? "light" : "dark"} mode`}>{(resolvedTheme || theme)==="dark"?<Sun className="h-4 w-4"/>:<Moon className="h-4 w-4"/>}</Button>
    </div>
  </header>;
}

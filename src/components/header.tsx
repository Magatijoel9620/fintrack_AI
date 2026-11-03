"use client";
import { useState } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Plus, Mic, Sun, Moon, Search, ChevronDown, LogOut, UserRound, Settings, Building2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "next-themes";
import { useVoiceRecognition } from "@/hooks/use-voice-recognition";
import { useToast } from "@/hooks/use-toast";

type View = "dashboard" | "products" | "stock" | "sales" | "purchases" | "reports" | "contacts" | "accounting" | "ai" | "settings" | "subscriptions" | "business-admin" | "profile";
export default function AppHeader({ title, onNavigate, onOpenCommandPalette }: { title: string; onNavigate: (view: View) => void; onOpenCommandPalette: () => void }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const { isListening, startListening, stopListening } = useVoiceRecognition();
  const { toast } = useToast();
  const isDark = (resolvedTheme || theme) === "dark";
  const displayName = user?.displayName || user?.email?.split("@")[0] || "Your account";
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");
  const navigateFromMenu = (view: View) => { setProfileOpen(false); onNavigate(view); };
  const mic = () => {
    if (isListening) stopListening();
    else {
      startListening();
      toast({ title: "Voice search started", description: "Try saying products, sales, purchases, or stock." });
    }
  };

  return <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-card/90 px-3 backdrop-blur-xl sm:px-4 md:px-6">
    <div className="flex min-w-0 items-center gap-3">
      <SidebarTrigger className="h-9 w-9 shrink-0 rounded-xl" aria-label="Toggle workspace navigation" title="Toggle workspace navigation" />
      <div className="flex min-w-0 items-center gap-2.5 md:hidden"><img src="/finai.png" alt="FinAI" className="h-8 w-8 rounded-lg object-cover"/><span className="truncate text-base font-bold tracking-tight">FinAI</span></div>
      <h1 className="hidden truncate font-headline text-lg font-bold tracking-tight md:block">{title}</h1>
    </div>
    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onOpenCommandPalette} className="h-9 gap-2 rounded-xl px-2.5 sm:px-3" aria-label="Open global search and command palette"><Search className="h-4 w-4"/><span className="hidden sm:inline">Search</span><kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground md:inline">Ctrl / ⌘ K</kbd></Button>
      <Button size="sm" className="h-9 rounded-xl px-2.5 sm:px-3" onClick={()=>onNavigate("products")} aria-label="Add product" title="Add product"><Plus className="h-4 w-4 sm:mr-1"/><span className="hidden sm:inline">Product</span></Button>
      <Button variant="ghost" size="icon" onClick={mic} aria-label={isListening ? "Stop voice search" : "Start voice search"} title={isListening ? "Stop voice search" : "Voice search"} className={`h-9 w-9 rounded-xl ${isListening ? "bg-destructive text-destructive-foreground" : ""}`}><Mic className="h-4 w-4"/></Button>
      <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={`Switch to ${isDark ? "light" : "dark"} mode`} title={`Switch to ${isDark ? "light" : "dark"} mode`} className="h-9 w-9 rounded-xl">{isDark?<Sun className="h-4 w-4"/>:<Moon className="h-4 w-4"/>}</Button>
      <div className="relative">
        <Button variant="ghost" className="h-10 gap-2 rounded-xl px-1.5 sm:px-2" onClick={()=>setProfileOpen(v=>!v)} aria-expanded={profileOpen} aria-label="Open account menu">
          <Avatar className="h-8 w-8 ring-2 ring-primary/10"><AvatarFallback className="bg-primary/10 font-semibold text-primary">{(user?.displayName||user?.email||"U").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
          <span className="hidden max-w-28 truncate text-sm font-medium lg:inline">{displayName.split(" ")[0]}</span>
          <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block"/>
        </Button>
        {profileOpen&&<>
          <button aria-label="Close account menu" className="fixed inset-0 z-40 cursor-default" onClick={()=>setProfileOpen(false)} />
          <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border bg-card p-2 shadow-2xl shadow-black/10">
            <div className="border-b px-3 py-3"><p className="truncate text-sm font-semibold">{displayName}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{user?.email}</p><p className="mt-2 text-[11px] text-muted-foreground">Personal account</p></div>
            <button onClick={()=>navigateFromMenu("profile")} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-primary/5 hover:text-primary"><UserRound className="h-4 w-4"/>Account profile</button>
            <button onClick={()=>navigateFromMenu("settings")} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-primary/5 hover:text-primary"><Settings className="h-4 w-4"/>Business settings</button>
            <button onClick={()=>navigateFromMenu("business-admin")} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-primary/5 hover:text-primary"><Building2 className="h-4 w-4"/>Business Admin</button>
            <div className="my-1 border-t" />
            <button onClick={()=>void logout()} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm text-destructive transition-colors hover:bg-destructive/5"><LogOut className="h-4 w-4"/>Sign out</button>
          </div>
        </>}
      </div>
    </div>
  </header>;
}

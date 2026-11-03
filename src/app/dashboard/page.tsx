"use client";
import * as React from "react";
import Link from "next/link";
import { Home, Boxes, ArrowDownToLine, ShoppingCart, Truck, BarChart3, Bot, Settings, LogOut, Tags, WalletCards, Building2, CreditCard, ShieldCheck, MoreHorizontal, X, UserRound } from "lucide-react";
import { getIdTokenResult } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarInset, SidebarGroup, SidebarGroupLabel, useSidebar } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import AppHeader from "@/components/header";
import InventoryDashboard from "@/components/inventory/dashboard-view";
import ProductsView from "@/components/inventory/products-view";
import StockView from "@/components/inventory/stock-view";
import TransactionsView from "@/components/inventory/transactions-view";
import ReportsView from "@/components/inventory/reports-view";
import ContactsView from "@/components/inventory/contacts-view";
import SettingsView from "@/components/inventory/settings-view";
import AIView from "@/components/inventory/ai-view";
import AccountingView from "@/components/inventory/accounting-view";
import BusinessAdminView from "@/components/inventory/business-admin-view";
import AccountProfileView from "@/components/account-profile-view";
import SubscriptionView from "@/components/inventory/subscription-view";
import { useAuth } from "@/context/auth-context";
import { useInventory } from "@/context/inventory-context";
import Login from "@/components/login";
import { useState } from "react";
import { Search, Command as CommandIcon, CornerDownLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type View="dashboard"|"business-admin"|"products"|"stock"|"sales"|"purchases"|"reports"|"contacts"|"accounting"|"ai"|"settings"|"subscriptions"|"profile";
const TITLES:Record<View,string>={dashboard:"Overview", "business-admin":"Business Admin",products:"Products",stock:"Stock management",sales:"Sales",purchases:"Purchases",reports:"Reports",contacts:"Customers & suppliers",accounting:"Accounting",ai:"Inventory intelligence",settings:"Business settings",subscriptions:"Subscription",profile:"Account profile"};
function isView(value:string|null):value is View{return Boolean(value&&value in TITLES)}

function ResponsiveSidebarController() {
 const { setOpen } = useSidebar();
 const setOpenRef = React.useRef(setOpen);
 setOpenRef.current = setOpen;
 React.useEffect(() => {
  const desktop = window.matchMedia("(min-width: 1024px)");
  const sync = () => setOpenRef.current(desktop.matches);
  sync();
  desktop.addEventListener("change", sync);
  return () => desktop.removeEventListener("change", sync);
 }, []);
 return null;
}

function EmailVerificationNotice() {
 const { user, resendVerification, refreshEmailVerification } = useAuth();
 const [message, setMessage] = useState("");
 const [sending, setSending] = useState(false);
 const isEmailPasswordUser = Boolean(user?.providerData.some((provider) => provider.providerId === "password"));
 if (!user || user.emailVerified || !isEmailPasswordUser) return null;
 const resend = async () => {
  setSending(true);
  try { await resendVerification(); setMessage("A new verification link has been sent."); }
  catch (error) { setMessage(error instanceof Error ? error.message : "Could not send the verification email."); }
  finally { setSending(false); }
 };
 const refresh = async () => {
  setSending(true);
  try { const verified = await refreshEmailVerification(); setMessage(verified ? "Email verified. Your account is up to date." : "We could not see the verification yet. Open the email link, then refresh again."); }
  catch { setMessage("Could not refresh verification status. Try again."); }
  finally { setSending(false); }
 };
 return <div className="mx-auto mb-4 flex max-w-[1600px] flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
  <div><p className="text-sm font-semibold">Verify your email address</p><p className="text-xs text-muted-foreground">Your workspace remains available. Verify your email to keep your account recovery details current.</p>{message&&<p role="status" className="mt-1 text-xs">{message}</p>}</div>
  <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={sending} onClick={()=>void resend()}>Resend email</Button><Button size="sm" disabled={sending} onClick={()=>void refresh()}>I’ve verified</Button></div>
 </div>;
}
export default function InventoryApp(){
 const [view,setView]=React.useState<View>(()=>{const v=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("view"):null;return isView(v)?v:"dashboard"});
 const [mobileMoreOpen,setMobileMoreOpen]=React.useState(false);
 const [commandOpen,setCommandOpen]=useState(false);
 const [commandQuery,setCommandQuery]=useState("");
 const {user,loading:authLoading,logout}=useAuth();
 const {business,products,customers,suppliers,sales,purchases}=useInventory(); const [platformAdmin,setPlatformAdmin]=React.useState(false);
 React.useEffect(()=>{
  const onKeyDown=(event:KeyboardEvent)=>{
   if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==="k"){
    event.preventDefault();setCommandOpen(true);setCommandQuery("");
   }
  };
  window.addEventListener("keydown",onKeyDown);
  return()=>window.removeEventListener("keydown",onKeyDown);
 },[]);
 const commandItems=React.useMemo(()=>{
  const pages:{label:string;detail:string;view:View}[]=[
   {label:"Overview",detail:"Dashboard and business performance",view:"dashboard"},
   {label:"Products",detail:"Search and manage products",view:"products"},
   {label:"Stock management",detail:"Stock levels and adjustments",view:"stock"},
   {label:"Sales & invoices",detail:"Point of sale and invoices",view:"sales"},
   {label:"Purchases",detail:"Receive supplier purchases",view:"purchases"},
   {label:"Customers & suppliers",detail:"Manage business contacts",view:"contacts"},
   {label:"Accounting",detail:"Receivables, payables and ledger",view:"accounting"},
   {label:"Reports",detail:"Business analytics and exports",view:"reports"},
   {label:"AI intelligence",detail:"Ask the FinAI business copilot",view:"ai"},
   {label:"Business settings",detail:"Profile and workspace preferences",view:"settings"},
   {label:"Subscription",detail:"Trial and subscription settings",view:"subscriptions"},
   {label:"Business Admin",detail:"Business administration",view:"business-admin"},
   {label:"Account profile",detail:"Personal name, phone and sign-in email",view:"profile"},
  ];
  const entities:{label:string;detail:string;view:View}[]=[
   ...products.map(p=>({label:p.name,detail:`Product · ${p.sku}`,view:"products" as View})),
   ...customers.map(c=>({label:c.name,detail:"Customer",view:"contacts" as View})),
   ...suppliers.map(s=>({label:s.name,detail:"Supplier",view:"contacts" as View})),
   ...sales.map(s=>({label:s.invoiceNumber,detail:`Sale · ${business.currency} ${s.total.toLocaleString()}`,view:"sales" as View})),
   ...purchases.map(p=>({label:p.invoiceNumber,detail:`Purchase · ${business.currency} ${p.total.toLocaleString()}`,view:"purchases" as View})),
  ];
  const actions=[
   {label:"Create a sale",detail:"Open the point-of-sale workspace",view:"sales" as View},
   {label:"Add a product",detail:"Create a new inventory item",view:"products" as View},
   {label:"Receive a purchase",detail:"Record supplier stock",view:"purchases" as View},
   {label:"Record a payment",detail:"Open customer and supplier accounting",view:"accounting" as View},
  ];
  const all=[...actions,...pages,...entities];
  const q=commandQuery.trim().toLowerCase();
  return (q?all.filter(item=>`${item.label} ${item.detail}`.toLowerCase().includes(q)):all.slice(0,16)).slice(0,18);
 },[commandQuery,products,customers,suppliers,sales,purchases,business.currency]);
 const navigate=(next:string)=>{if(!isView(next))return;setView(next);setMobileMoreOpen(false);const url=new URL(window.location.href);url.searchParams.set("view",next);window.history.replaceState({}, "", url.toString())};
 const openCommandPalette=()=>{setCommandQuery("");setCommandOpen(true)};
 const selectCommand=(target:View)=>{navigate(target);setCommandOpen(false)};
 React.useEffect(()=>{let alive=true; if(auth?.currentUser) void getIdTokenResult(auth.currentUser,true).then(r=>{if(alive)setPlatformAdmin(r.claims.platformAdmin===true)}).catch(()=>{if(alive)setPlatformAdmin(false)});return()=>{alive=false}},[user?.uid]);
 const render=()=>{switch(view){case"business-admin":return <BusinessAdminView onNavigate={navigate}/>;case"subscriptions":return <SubscriptionView/>;case"products":return <ProductsView/>;case"stock":return <StockView/>;case"sales":return <TransactionsView mode="sales"/>;case"purchases":return <TransactionsView mode="purchases"/>;case"reports":return <ReportsView/>;case"contacts":return <ContactsView/>;case"accounting":return <AccountingView/>;case"ai":return <AIView/>;case"settings":return <SettingsView/>;case"profile":return <AccountProfileView/>;default:return <InventoryDashboard/>}};
 if (authLoading) return <main className="grid min-h-screen place-items-center gap-3 text-sm text-muted-foreground"><img src="/finai.png" alt="FinAI" className="h-12 w-12 rounded-xl"/><span>Loading your workspace…</span></main>;
 if (!user) return <Login />;

 const item=(key:View,Icon:typeof Home,label:string)=><SidebarMenuItem key={key}><SidebarMenuButton onClick={()=>navigate(key)} isActive={view===key} tooltip={label} title={label}><Icon/><span>{label}</span></SidebarMenuButton></SidebarMenuItem>;
 return <SidebarProvider><ResponsiveSidebarController/><Sidebar collapsible="offcanvas"><SidebarHeader><div className="flex items-center gap-3 px-1 py-2"><img src="/finai.png" alt="FinAI" className="h-10 w-10 rounded-xl object-cover"/><div className="min-w-0"><h2 className="font-headline font-bold tracking-tight">FinAI</h2><p className="truncate text-xs text-sidebar-foreground/65">{business.name}</p></div></div></SidebarHeader><SidebarContent><SidebarGroup><SidebarGroupLabel>Workspace</SidebarGroupLabel><SidebarMenu>{item("dashboard",Home,"Overview")}{item("products",Boxes,"Products")}{item("stock",ArrowDownToLine,"Stock")}{item("sales",ShoppingCart,"Sales & invoices")}{item("purchases",Truck,"Purchases")}{item("contacts",Tags,"Contacts")}{item("accounting",WalletCards,"Accounting")}</SidebarMenu></SidebarGroup><SidebarGroup><SidebarGroupLabel>Insights</SidebarGroupLabel><SidebarMenu>{item("reports",BarChart3,"Reports")}{item("ai",Bot,"AI intelligence")}</SidebarMenu></SidebarGroup><SidebarGroup><SidebarGroupLabel>Administration</SidebarGroupLabel><SidebarMenu>{item("business-admin",Building2,"Business Admin")}{item("settings",Settings,"Business settings")}{item("subscriptions",CreditCard,"Subscription")}{platformAdmin&&<SidebarMenuItem><SidebarMenuButton asChild><Link href="/platform-admin"><ShieldCheck/><span>Platform Admin</span></Link></SidebarMenuButton></SidebarMenuItem>}</SidebarMenu></SidebarGroup></SidebarContent><SidebarFooter>
 <button type="button" onClick={()=>navigate("profile")} title="Open account profile" className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
  <Avatar className="h-9 w-9"><AvatarFallback className="bg-sidebar-primary/15 font-semibold text-sidebar-foreground">{(user?.displayName||user?.email||"U").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{user?.displayName||user?.email?.split("@")[0]||"Business owner"}</p><p className="truncate text-[11px] text-sidebar-foreground/65">Account profile</p></div>
  <UserRound className="h-4 w-4 shrink-0 text-sidebar-foreground/60"/>
 </button>
 <div className="flex items-center gap-2"><Button variant="ghost" size="sm" className="flex-1 justify-start text-sidebar-foreground hover:bg-sidebar-accent" onClick={()=>navigate("settings")}><Settings className="h-4 w-4"/>Business settings</Button><Button variant="ghost" size="icon" onClick={()=>void logout()} title="Sign out" aria-label="Sign out" className="text-sidebar-foreground hover:bg-sidebar-accent"><LogOut className="h-4 w-4"/></Button></div>
 </SidebarFooter></Sidebar><SidebarInset><AppHeader title={TITLES[view]} onNavigate={navigate} onOpenCommandPalette={openCommandPalette}/><main className="finai-main-content min-w-0 flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8"><EmailVerificationNotice/><section className="mx-auto mb-4 max-w-[1600px] md:mb-5"><h2 className="text-xl font-bold tracking-tight sm:text-2xl">{(() => { const hour = new Date().getHours(); return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"; })()}, {(user?.displayName || user?.email?.split("@")[0] || "there").split(" ")[0]}</h2><p className="mt-1 hidden text-sm text-muted-foreground sm:block">Here’s your business at a glance. Let’s make today count.</p></section><div className="mx-auto mb-4 flex max-w-[1600px] items-center gap-2 text-xs text-muted-foreground md:mb-5"><span>Workspace</span><span>/</span><span className="font-medium text-foreground">{TITLES[view]}</span></div><div key={view} className="finai-page-enter mx-auto max-w-[1600px]">{render()}</div></main><nav aria-label="Primary mobile navigation" className="finai-bottom-nav">
 {([{key:"dashboard",label:"Home",Icon:Home},{key:"products",label:"Products",Icon:Boxes},{key:"sales",label:"Sales",Icon:ShoppingCart},{key:"ai",label:"AI",Icon:Bot}] as const).map(({key,label,Icon})=><button key={key} type="button" onClick={()=>navigate(key)} aria-current={view===key?"page":undefined} className={view===key?"active":""}><Icon size={20} strokeWidth={view===key?2.5:2}/><span>{label}</span></button>)}
 <button type="button" onClick={()=>setMobileMoreOpen(v=>!v)} aria-expanded={mobileMoreOpen} aria-label={mobileMoreOpen?"Close more navigation":"Open more navigation"} className={mobileMoreOpen||!(['dashboard','products','sales','ai'] as string[]).includes(view)?"active":""}>{mobileMoreOpen?<X size={20}/>:<MoreHorizontal size={20}/>}<span>More</span></button>
 </nav>
 {mobileMoreOpen&&<><button aria-label="Close navigation menu" className="fixed inset-0 z-40 bg-black/25 md:hidden" onClick={()=>setMobileMoreOpen(false)}/><div className="finai-mobile-more fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] right-3 z-50 w-60 rounded-2xl border bg-card p-2 shadow-2xl md:hidden"><p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">More workspace</p>{([{key:"stock",label:"Stock management",Icon:ArrowDownToLine},{key:"purchases",label:"Purchases",Icon:Truck},{key:"reports",label:"Reports",Icon:BarChart3},{key:"contacts",label:"Customers & suppliers",Icon:Tags},{key:"accounting",label:"Accounting",Icon:WalletCards},{key:"business-admin",label:"Business Admin",Icon:Building2},{key:"settings",label:"Business settings",Icon:Settings},{key:"subscriptions",label:"Subscription",Icon:CreditCard},{key:"profile",label:"Account profile",Icon:UserRound}] as const).map(({key,label,Icon})=><button key={key} type="button" onClick={()=>navigate(key)} className={"flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm hover:bg-muted "+(view===key?"bg-muted font-semibold text-primary":"")}><Icon size={17}/>{label}</button>)}</div></>}</SidebarInset>
 <Dialog open={commandOpen} onOpenChange={setCommandOpen}>
  <DialogContent className="top-[12%] max-w-2xl translate-y-0 gap-3 p-3 sm:top-[16%] sm:p-4">
   <DialogHeader className="px-2 pt-1">
    <DialogTitle className="flex items-center gap-2"><CommandIcon className="h-4 w-4 text-primary"/>Search FinAI</DialogTitle>
    <DialogDescription>Find a workspace, product, contact, invoice or purchase. Press Ctrl/⌘ K anytime.</DialogDescription>
   </DialogHeader>
   <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input autoFocus aria-label="Search FinAI workspace" value={commandQuery} onChange={e=>setCommandQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&commandItems[0]){e.preventDefault();selectCommand(commandItems[0].view)}}} placeholder="Search products, customers, invoices…" className="h-11 pl-9"/></div>
   <div className="max-h-[min(58vh,520px)] overflow-y-auto rounded-xl border">
    {commandItems.length?commandItems.map((entry,index)=><button key={`${entry.view}-${entry.label}-${index}`} type="button" onClick={()=>selectCommand(entry.view)} className="flex min-h-14 w-full items-center justify-between gap-3 border-b px-3 py-2.5 text-left last:border-0 hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none">
     <span className="min-w-0"><span className="block truncate text-sm font-medium">{entry.label}</span><span className="block truncate text-xs text-muted-foreground">{entry.detail}</span></span><span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><span>Open</span><CornerDownLeft className="h-3.5 w-3.5"/></span>
    </button>):<p className="p-8 text-center text-sm text-muted-foreground">No matching business records or workspace actions.</p>}
   </div>
   <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground"><span>{commandItems.length} result{commandItems.length===1?"":"s"}</span><span>Enter to open · Esc to close</span></div>
  </DialogContent>
 </Dialog>
 </SidebarProvider>;
}

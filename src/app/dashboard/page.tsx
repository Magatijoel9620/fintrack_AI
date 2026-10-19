"use client";
import * as React from "react";
import Link from "next/link";
import { Package, Home, Boxes, ArrowDownToLine, ShoppingCart, Truck, BarChart3, Bot, Settings, LogOut, Tags, WalletCards, Building2, CreditCard, ShieldCheck } from "lucide-react";
import { getIdTokenResult } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarInset, SidebarGroup, SidebarGroupLabel } from "@/components/ui/sidebar";
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
import SubscriptionView from "@/components/inventory/subscription-view";
import EmployeesView from "@/components/inventory/employees-view";
import { useAuth } from "@/context/auth-context";
import { useInventory } from "@/context/inventory-context";
import Login from "@/components/login";

type View="dashboard"|"business-admin"|"products"|"stock"|"sales"|"purchases"|"reports"|"contacts"|"accounting"|"ai"|"settings"|"subscriptions"|"employees";
const TITLES:Record<View,string>={dashboard:"Overview", "business-admin":"Business Admin",products:"Products",stock:"Stock management",sales:"Sales",purchases:"Purchases",reports:"Reports",contacts:"Customers & suppliers",accounting:"Accounting",ai:"Inventory intelligence",settings:"Business settings",subscriptions:"Subscription",employees:"Employees & permissions"};
function isView(value:string|null):value is View{return Boolean(value&&value in TITLES)}
export default function InventoryApp(){
 const [view,setView]=React.useState<View>(()=>{const v=typeof window!=="undefined"?new URLSearchParams(window.location.search).get("view"):null;return isView(v)?v:"dashboard"});
 const {user,loading:authLoading,logout}=useAuth(); const {business}=useInventory(); const [platformAdmin,setPlatformAdmin]=React.useState(false);
 React.useEffect(()=>{let alive=true; if(auth?.currentUser) void getIdTokenResult(auth.currentUser,true).then(r=>{if(alive)setPlatformAdmin(r.claims.platformAdmin===true)}).catch(()=>{if(alive)setPlatformAdmin(false)});return()=>{alive=false}},[user?.uid]);
 const navigate=(next:string)=>{if(!isView(next))return;setView(next);const url=new URL(window.location.href);url.searchParams.set("view",next);window.history.replaceState({}, "", url.toString())};
 const render=()=>{switch(view){case"business-admin":return <BusinessAdminView onNavigate={navigate}/>;case"subscriptions":return <SubscriptionView/>;case"employees":return <EmployeesView/>;case"products":return <ProductsView/>;case"stock":return <StockView/>;case"sales":return <TransactionsView mode="sales"/>;case"purchases":return <TransactionsView mode="purchases"/>;case"reports":return <ReportsView/>;case"contacts":return <ContactsView/>;case"accounting":return <AccountingView/>;case"ai":return <AIView/>;case"settings":return <SettingsView/>;default:return <InventoryDashboard/>}};
 if (authLoading) return <main className="grid min-h-screen place-items-center gap-3 text-sm text-muted-foreground"><img src="/finai.png" alt="FinAI" className="h-12 w-12 rounded-xl"/><span>Loading your workspace…</span></main>;
 if (!user) return <Login />;

 const item=(key:View,Icon:typeof Home,label:string)=><SidebarMenuItem key={key}><SidebarMenuButton onClick={()=>navigate(key)} isActive={view===key}><Icon/><span>{label}</span></SidebarMenuButton></SidebarMenuItem>;
 return <SidebarProvider><Sidebar><SidebarHeader><div className="flex items-center gap-3 px-1 py-2"><img src="/finai.png" alt="FinAI" className="h-10 w-10 rounded-xl object-cover"/><div className="min-w-0"><h2 className="font-headline font-bold tracking-tight">FinAI</h2><p className="truncate text-xs text-sidebar-foreground/65">{business.name}</p></div></div></SidebarHeader><SidebarContent><SidebarGroup><SidebarGroupLabel>Workspace</SidebarGroupLabel><SidebarMenu>{item("dashboard",Home,"Overview")}{item("products",Boxes,"Products")}{item("stock",ArrowDownToLine,"Stock")}{item("sales",ShoppingCart,"Sales & invoices")}{item("purchases",Truck,"Purchases")}{item("contacts",Tags,"Contacts")}{item("accounting",WalletCards,"Accounting")}</SidebarMenu></SidebarGroup><SidebarGroup><SidebarGroupLabel>Insights</SidebarGroupLabel><SidebarMenu>{item("reports",BarChart3,"Reports")}{item("ai",Bot,"AI intelligence")}</SidebarMenu></SidebarGroup><SidebarGroup><SidebarGroupLabel>Administration</SidebarGroupLabel><SidebarMenu>{item("business-admin",Building2,"Business Admin")}{item("settings",Settings,"Business settings")}{item("subscriptions",CreditCard,"Subscription")}{platformAdmin&&<SidebarMenuItem><SidebarMenuButton asChild><Link href="/platform-admin"><ShieldCheck/><span>Platform Admin</span></Link></SidebarMenuButton></SidebarMenuItem>}</SidebarMenu></SidebarGroup></SidebarContent><SidebarFooter><div className="flex items-center gap-3"><Avatar><AvatarFallback>{user?.email?.charAt(0).toUpperCase()??"U"}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{user?.displayName??"Business owner"}</p><p className="truncate text-xs text-sidebar-foreground/65">{user?.email}</p></div><Button variant="ghost" size="icon" onClick={()=>void logout()} title="Sign out"><LogOut className="h-4 w-4"/></Button></div></SidebarFooter></Sidebar><SidebarInset><AppHeader title={TITLES[view]} onNavigate={navigate}/><main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8"><section className="mx-auto mb-5 max-w-[1600px]"><h2 className="text-2xl font-bold tracking-tight">{(() => { const hour = new Date().getHours(); return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"; })()}, {(user?.displayName || user?.email?.split("@")[0] || "there").split(" ")[0]}</h2><p className="mt-1 text-sm text-muted-foreground">Here’s your business at a glance. Let’s make today count.</p></section><div className="mx-auto mb-5 flex max-w-[1600px] items-center gap-2 text-xs text-muted-foreground"><span>Workspace</span><span>/</span><span className="font-medium text-foreground">{TITLES[view]}</span></div><div className="mx-auto max-w-[1600px]">{render()}</div></main><nav aria-label="Quick navigation" className="finai-bottom-nav">{([{key:"dashboard",label:"Home",Icon:Home},{key:"products",label:"Products",Icon:Boxes},{key:"stock",label:"Stock",Icon:ArrowDownToLine},{key:"sales",label:"Sales",Icon:ShoppingCart},{key:"reports",label:"Reports",Icon:BarChart3}] as const).map(({key,label,Icon})=><button key={key} type="button" onClick={()=>navigate(key)} aria-current={view===key?"page":undefined} className={view===key?"active":""}><Icon size={19}/><span>{label}</span></button>)}</nav></SidebarInset></SidebarProvider>;
}

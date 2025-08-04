"use client";

import * as React from "react";
import {
  BarChart2,
  CircleDollarSign,
  Home,
  Mic,
  Plus,
  ScanLine,
  Wallet,
  Bot,
} from "lucide-react";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AppHeader from "@/components/header";
import DashboardView from "@/components/dashboard-view";
import ExpensesView from "@/components/expenses-view";
import BudgetView from "@/components/budget-view";
import AdvisorView from "@/components/advisor-view";
import { AddExpenseModal } from "@/components/modals/add-expense-modal";
import { ScanReceiptModal } from "@/components/modals/scan-receipt-modal";
import { AppContext } from "@/context/app-context";

type View = "dashboard" | "expenses" | "budget" | "advisor";

export default function FinTrackApp() {
  const [activeView, setActiveView] = React.useState<View>("dashboard");
  const { setOpenAddExpense, setOpenScanReceipt } = React.useContext(AppContext);

  const renderView = () => {
    switch (activeView) {
      case "dashboard":
        return <DashboardView />;
      case "expenses":
        return <ExpensesView />;
      case "budget":
        return <BudgetView />;
      case "advisor":
        return <AdvisorView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <CircleDollarSign className="w-8 h-8 text-primary" />
            <div className="flex flex-col">
              <h2 className="text-lg font-bold font-headline">FinTrack AI</h2>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setActiveView("dashboard")}
                isActive={activeView === "dashboard"}
                tooltip="Dashboard"
              >
                <Home />
                <span>Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setActiveView("expenses")}
                isActive={activeView === "expenses"}
                tooltip="Expenses"
              >
                <Wallet />
                <span>Expenses</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setActiveView("budget")}
                isActive={activeView === "budget"}
                tooltip="Budget"
              >
                <BarChart2 />
                <span>Budget</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setActiveView("advisor")}
                isActive={activeView === "advisor"}
                tooltip="AI Advisor"
              >
                <Bot />
                <span>AI Advisor</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
           <div className="flex items-center gap-3">
             <Avatar>
               <AvatarImage src="https://placehold.co/40x40.png" alt="User" data-ai-hint="person avatar" />
               <AvatarFallback>U</AvatarFallback>
             </Avatar>
             <div className="flex flex-col">
              <span className="text-sm font-semibold">User</span>
              <span className="text-xs text-muted-foreground">user@email.com</span>
             </div>
           </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <AppHeader activeView={activeView} />
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto">
          {renderView()}
        </main>
      </SidebarInset>

      <AddExpenseModal />
      <ScanReceiptModal />
    </SidebarProvider>
  );
}

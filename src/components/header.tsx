
"use client";

import React, { useEffect, useContext } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Plus, ScanLine, Mic, Sun, Moon, DollarSign } from "lucide-react";
import { useVoiceRecognition } from "@/hooks/use-voice-recognition";
import { AppContext } from "@/context/app-context";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Currency } from "@/types";

interface AppHeaderProps {
  activeView: string;
}

const viewTitles: { [key: string]: string } = {
  dashboard: "Dashboard",
  expenses: "Expenses",
  budget: "Budget",
  advisor: "AI Financial Advisor",
  admin: "Admin",
};

export default function AppHeader({ activeView }: AppHeaderProps) {
  const { isListening, transcript, startListening, stopListening } =
    useVoiceRecognition();
  const { setOpenAddExpense, setOpenScanReceipt, currency, setCurrency } = useContext(AppContext);
  const { toast } = useToast();
  const { setTheme } = useTheme();

  useEffect(() => {
    if (transcript) {
      if (transcript.toLowerCase().includes("add expense")) {
        setOpenAddExpense(true);
        stopListening();
      } else if (transcript.toLowerCase().includes("scan receipt")) {
        setOpenScanReceipt(true);
        stopListening();
      }
    }
  }, [transcript, setOpenAddExpense, setOpenScanReceipt, stopListening]);

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
      toast({
        title: "Listening...",
        description: 'Try saying "add expense" or "scan receipt".',
      });
    }
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-4 md:px-6">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="md:hidden" />
        <h1 className="text-xl font-semibold font-headline capitalize">
          {viewTitles[activeView]}
        </h1>
      </div>
      <div className="flex items-center gap-1 sm:gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpenScanReceipt(true)}
          className="p-2 sm:px-3"
        >
          <ScanLine className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Scan Receipt</span>
        </Button>
        <Button size="sm" onClick={() => setOpenAddExpense(true)} className="p-2 sm:px-3">
          <Plus className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Add Expense</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleMicClick}
          className={isListening ? "bg-destructive text-destructive-foreground" : ""}
        >
          <Mic className="h-5 w-5" />
          <span className="sr-only">Use Voice Command</span>
        </Button>

        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <DollarSign className="h-[1.2rem] w-[1.2rem]" />
                    <span className="sr-only">Change currency</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Currency</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={currency} onValueChange={(value) => setCurrency(value as Currency)}>
                    <DropdownMenuRadioItem value="USD">USD ($)</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="EUR">EUR (€)</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="GBP">GBP (£)</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="JPY">JPY (¥)</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="KSH">KSH (Ksh)</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                    <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("light")}>
                    Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                    Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                    System
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

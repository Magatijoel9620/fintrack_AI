"use client";

import React, { useEffect, useContext } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Plus, ScanLine, Mic } from "lucide-react";
import { useVoiceRecognition } from "@/hooks/use-voice-recognition";
import { AppContext } from "@/context/app-context";
import { useToast } from "@/hooks/use-toast";

interface AppHeaderProps {
  activeView: string;
}

const viewTitles: { [key: string]: string } = {
  dashboard: "Dashboard",
  expenses: "Expenses",
  budget: "Budget",
  advisor: "AI Financial Advisor",
};

export default function AppHeader({ activeView }: AppHeaderProps) {
  const { isListening, transcript, startListening, stopListening } =
    useVoiceRecognition();
  const { setOpenAddExpense, setOpenScanReceipt } = useContext(AppContext);
  const { toast } = useToast();

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
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpenScanReceipt(true)}
        >
          <ScanLine className="mr-2 h-4 w-4" />
          Scan Receipt
        </Button>
        <Button size="sm" onClick={() => setOpenAddExpense(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Expense
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
      </div>
    </header>
  );
}

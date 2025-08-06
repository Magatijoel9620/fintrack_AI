"use client";

import React, { useState, useContext, useRef } from "react";
import { AppContext } from "@/context/app-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { scanReceipt } from "@/ai/flows/automatic-receipt-scanning";
import { Loader2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { Expense } from "@/types";

export function ScanReceiptModal() {
  const { openScanReceipt, setOpenScanReceipt, setOpenAddExpense, setExpenseToEdit } = useContext(AppContext);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScan = async () => {
    if (!selectedFile) return;

    setLoading(true);

    const reader = new FileReader();
    reader.readAsDataURL(selectedFile);
    reader.onload = async () => {
      try {
        const receiptDataUri = reader.result as string;
        const result = await scanReceipt({ receiptDataUri });

        setExpenseToEdit({
          id: '', // Empty id signifies a new expense from a scan
          amount: result.amount,
          merchant: result.merchant,
          category: result.category,
          date: result.date,
        });
        
        setOpenScanReceipt(false);
        setOpenAddExpense(true);

      } catch (error) {
        console.error("Receipt scanning failed:", error);
        toast({
          variant: "destructive",
          title: "Scan Failed",
          description: "Could not extract details from the receipt. Please try again or enter manually.",
        });
      } finally {
        setLoading(false);
        resetState();
      }
    };
    reader.onerror = (error) => {
        console.error("File reading failed:", error);
        toast({
            variant: "destructive",
            title: "File Error",
            description: "Could not read the selected file.",
        });
        setLoading(false);
    }
  };
  
  const resetState = () => {
      setSelectedFile(null);
      setPreview(null);
      if(fileInputRef.current) {
        fileInputRef.current.value = "";
      }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
        resetState();
    }
    setOpenScanReceipt(open);
  }

  return (
    <Dialog open={openScanReceipt} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Scan Receipt</DialogTitle>
          <DialogDescription>
            Upload a photo of your receipt to automatically add an expense.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full max-w-sm items-center gap-1.5">
            <Label htmlFor="receipt-image">Receipt Image</Label>
            <Input id="receipt-image" type="file" accept="image/*" onChange={handleFileChange} ref={fileInputRef}/>
          </div>
          {preview && (
            <div className="relative mt-4 h-48 w-full">
              <Image src={preview} alt="Receipt preview" layout="fill" objectFit="contain" className="rounded-md" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button onClick={handleScan} disabled={!selectedFile || loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Scan & Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

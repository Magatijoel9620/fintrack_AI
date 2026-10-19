"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

declare global { interface Window { BarcodeDetector?: any } }
export default function BarcodeScanner({ open, onOpenChange, onDetected }: { open: boolean; onOpenChange: (open:boolean)=>void; onDetected:(value:string)=>void }) {
 const videoRef=useRef<HTMLVideoElement>(null); const streamRef=useRef<MediaStream|null>(null); const [status,setStatus]=useState("Starting camera…"); const {toast}=useToast();
 useEffect(()=>{ if(!open) return; let active=true; const start=async()=>{ if(!window.BarcodeDetector){setStatus("Camera barcode detection is not supported by this browser. Use the scanner/search field instead.");return;} try{const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}}}); if(!active){stream.getTracks().forEach(t=>t.stop());return;} streamRef.current=stream; if(videoRef.current) videoRef.current.srcObject=stream; const detector=new window.BarcodeDetector(); setStatus("Point the camera at a barcode"); const scan=async()=>{if(!active||!videoRef.current)return; try{const codes=await detector.detect(videoRef.current); if(codes?.[0]?.rawValue){active=false; onDetected(codes[0].rawValue); onOpenChange(false); return;}}catch{} requestAnimationFrame(scan)}; requestAnimationFrame(scan);}catch(e){setStatus("Camera access was denied or unavailable.");toast({variant:"destructive",title:"Camera unavailable",description:e instanceof Error?e.message:"Allow camera access and try again."});}}; start(); return()=>{active=false;streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;};},[open,onDetected,onOpenChange,toast]);
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2"><Camera className="h-5 w-5"/>Scan barcode</DialogTitle></DialogHeader><div className="space-y-4"><div className="overflow-hidden rounded-xl bg-black"><video ref={videoRef} autoPlay muted playsInline className="aspect-video w-full object-cover"/></div><p className="text-center text-sm text-muted-foreground">{status}</p><Button variant="outline" className="w-full" onClick={()=>onOpenChange(false)}><X className="mr-2 h-4 w-4"/>Close</Button></div></DialogContent></Dialog>
}

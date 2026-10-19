"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInventory } from "@/context/inventory-context";
import { Currency } from "@/types";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { firebaseApp } from "@/lib/firebase";

export default function SettingsView() {
 const { business,setCurrency,updateBusiness }=useInventory();
 const [form,setForm]=useState({name:business.name,phone:business.phone||"",email:business.email||"",address:business.address||"",taxNumber:business.taxNumber||"",logoUrl:business.logoUrl||""});
 const [currency,setCurrencyLocal]=useState<Currency>(business.currency); const [saving,setSaving]=useState(false);
 const [logoUploading,setLogoUploading]=useState(false);
 const [logoError,setLogoError]=useState("");
 const uploadLogo=async(file?:File)=>{ if(!file)return; setLogoError("");
  if(!firebaseApp||!business.id){setLogoError("Your workspace is not ready yet. Try again shortly.");return;}
  if(!file.type.startsWith("image/")){setLogoError("Choose an image file.");return;}
  if(file.size>2*1024*1024){setLogoError("Choose an image smaller than 2 MB.");return;}
  setLogoUploading(true);try{const storage=getStorage(firebaseApp);const ext=(file.name.split(".").pop()||"png").toLowerCase().replace(/[^a-z0-9]/g,"");const path=`business-logos/${business.id}/logo-${Date.now()}.${ext||"png"}`;const objectRef=ref(storage,path);await uploadBytes(objectRef,file,{contentType:file.type});const logoUrl=await getDownloadURL(objectRef);setForm(prev=>({...prev,logoUrl}));}catch(e){setLogoError("Logo upload failed. Check Firebase Storage setup and storage rules.");}finally{setLogoUploading(false);}};
 useEffect(()=>{setForm({name:business.name,phone:business.phone||"",email:business.email||"",address:business.address||"",taxNumber:business.taxNumber||"",logoUrl:business.logoUrl||""});setCurrencyLocal(business.currency)},[business]);
 const save=async()=>{if(!form.name.trim()){setLogoError("Business name is required.");return;}setSaving(true);try{await updateBusiness({...form,name:form.name.trim(),phone:form.phone.trim(),email:form.email.trim(),address:form.address.trim(),taxNumber:form.taxNumber.trim()});await setCurrency(currency)}finally{setSaving(false)}};
 return <div className="max-w-3xl space-y-6"><Card><CardHeader><CardTitle>Business profile</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2">
  <div className="sm:col-span-2"><Label>Business name</Label><Input className="mt-1" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div>
  <div><Label>Phone</Label><Input className="mt-1" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="+254…"/></div>
  <div><Label>Email</Label><Input className="mt-1" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div>
  <div className="sm:col-span-2"><Label>Business address</Label><Input className="mt-1" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} placeholder="Street, town, county"/></div>
  <div><Label>Tax PIN / VAT number</Label><Input className="mt-1" value={form.taxNumber} onChange={e=>setForm({...form,taxNumber:e.target.value})}/></div>
  <div><Label>Currency</Label><Select value={currency} onValueChange={v=>setCurrencyLocal(v as Currency)}><SelectTrigger className="mt-1"><SelectValue/></SelectTrigger><SelectContent>{(["KES","USD","EUR","GBP","JPY"] as Currency[]).map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
  <div className="sm:col-span-2 space-y-3"><Label>Business logo</Label><div className="flex flex-wrap items-center gap-4">{form.logoUrl?<img src={form.logoUrl} alt="Business logo preview" className="h-20 w-20 rounded-xl border bg-white object-contain p-1"/>:<div className="grid h-20 w-20 place-items-center rounded-xl border bg-muted text-xs text-muted-foreground">No logo</div>}<div className="space-y-2"><Input aria-label="Upload business logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="max-w-xs" disabled={logoUploading} onChange={e=>void uploadLogo(e.target.files?.[0])}/><p className="text-xs text-muted-foreground">PNG, JPG, WebP or SVG · up to 2 MB.</p>{form.logoUrl&&<Button type="button" variant="outline" size="sm" onClick={()=>setForm({...form,logoUrl:""})}>Remove logo</Button>}</div></div>{logoUploading&&<p className="text-sm text-muted-foreground">Uploading logo…</p>}{logoError&&<p role="alert" className="text-sm text-destructive">{logoError}</p>}</div>
  <div className="sm:col-span-2 border-t pt-4"><h3 className="font-semibold">Invoice & tax settings</h3><p className="mt-1 text-sm text-muted-foreground">Your business name, contacts, address, tax number, currency and logo can be used on invoice documents.</p></div>
  <div className="sm:col-span-2"><Button onClick={save} disabled={saving}>{saving?"Saving…":"Save business profile"}</Button></div>
  <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Changes apply to your workspace profile and future invoice details.</p></div>
 </CardContent></Card></div>;
}

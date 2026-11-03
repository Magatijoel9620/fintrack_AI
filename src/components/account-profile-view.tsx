"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, KeyRound, Mail, ShieldCheck, UserRound, Phone, RefreshCw, Save } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";

export default function AccountProfileView() {
  const {
    user,
    accountProfile,
    updateAccountProfile,
    requestEmailChange,
    refreshAccountDetails,
    resetPassword,
  } = useAuth();
  const { toast } = useToast();
  const defaultName = user?.displayName || user?.email?.split("@")[0] || "";
  const [displayName, setDisplayName] = useState(defaultName);
  const [phoneNumber, setPhoneNumber] = useState(accountProfile.phoneNumber);
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [securityBusy, setSecurityBusy] = useState(false);

  useEffect(() => {
    setDisplayName(user?.displayName || user?.email?.split("@")[0] || "");
    setPhoneNumber(accountProfile.phoneNumber);
  }, [user?.uid, user?.displayName, accountProfile.phoneNumber]);

  const saveProfile = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await updateAccountProfile({ displayName, phoneNumber });
      toast({ title: "Account profile updated", description: "Your personal name and contact number have been saved." });
    } catch (error) {
      toast({ variant: "destructive", title: "Profile could not be saved", description: error instanceof Error ? error.message : "Check your connection and try again." });
    } finally {
      setSaving(false);
    }
  };

  const sendEmailChange = async () => {
    if (emailBusy) return;
    setEmailBusy(true);
    try {
      await requestEmailChange(newEmail);
      setNewEmail("");
      toast({ title: "Verification email sent", description: "Open the verification link sent to your new address, then refresh your account details here." });
    } catch (error) {
      toast({ variant: "destructive", title: "Email change could not be started", description: error instanceof Error ? error.message : "You may need to sign in again before changing your email." });
    } finally {
      setEmailBusy(false);
    }
  };

  const refresh = async () => {
    if (securityBusy) return;
    setSecurityBusy(true);
    try {
      await refreshAccountDetails();
      toast({ title: "Account details refreshed", description: "Your latest sign-in email and verification status are now displayed." });
    } catch (error) {
      toast({ variant: "destructive", title: "Could not refresh account", description: error instanceof Error ? error.message : "Sign in again and retry." });
    } finally {
      setSecurityBusy(false);
    }
  };

  const sendPasswordReset = async () => {
    if (!user?.email) return;
    setSecurityBusy(true);
    try {
      await resetPassword(user.email);
      toast({ title: "Password reset email sent", description: `Check ${user.email} for the secure reset link.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Password reset could not be sent", description: error instanceof Error ? error.message : "Try again shortly." });
    } finally {
      setSecurityBusy(false);
    }
  };

  const initials = (user?.displayName || user?.email || "U").trim().charAt(0).toUpperCase();
  const hasPasswordLogin = Boolean(user?.providerData.some((provider) => provider.providerId === "password"));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="relative overflow-hidden rounded-3xl border bg-card p-5 shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar className="h-16 w-16 border-2 border-background shadow-md">
            <AvatarFallback className="bg-primary/10 text-xl font-bold text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">Personal account</p>
            <h2 className="mt-1 truncate font-headline text-2xl font-bold">{user?.displayName || user?.email?.split("@")[0] || "Your profile"}</h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">{user?.email || "No sign-in email available"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Private account
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs font-medium">
              <BadgeCheck className={`h-3.5 w-3.5 ${user?.emailVerified ? "text-emerald-600" : "text-amber-600"}`} />
              {user?.emailVerified ? "Email verified" : "Email not verified"}
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserRound className="h-5 w-5 text-primary" />Personal details</CardTitle>
            <CardDescription>These details identify you as the person using FinAI. They are separate from your business profile and invoice details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="account-name">Your name</Label>
              <Input id="account-name" autoComplete="name" maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="e.g. Joel Magati" />
              <p className="text-xs text-muted-foreground">Used for greetings, your avatar menu and account identification. It does not change your business name.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-phone">Personal phone number</Label>
              <div className="relative"><Phone className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="account-phone" autoComplete="tel" className="pl-9" maxLength={32} value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="e.g. +254 7…" /></div>
            </div>
            <Button onClick={() => void saveProfile()} disabled={saving} className="w-full sm:w-auto"><Save className="h-4 w-4" />{saving ? "Saving profile…" : "Save personal details"}</Button>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" />Sign-in email</CardTitle>
              <CardDescription>Your email is managed by Firebase Authentication, not by your business settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-muted/35 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Current email</p>
                <p className="mt-1 break-all text-sm font-medium">{user?.email || "Not available"}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-account-email">Change sign-in email</Label>
                <Input id="new-account-email" type="email" autoComplete="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="new-address@example.com" />
                <p className="text-xs leading-5 text-muted-foreground">Firebase sends a verification link to the new address. Your sign-in email changes only after you confirm it. Recent sign-in may be required.</p>
              </div>
              <Button variant="outline" className="w-full" onClick={() => void sendEmailChange()} disabled={emailBusy || !newEmail.trim()}>{emailBusy ? "Sending verification…" : "Send email-change verification"}</Button>
              <Button variant="ghost" size="sm" className="w-full" onClick={() => void refresh()} disabled={securityBusy}><RefreshCw className="h-4 w-4" />Refresh account details</Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />Account security</CardTitle>
              <CardDescription>Keep control of the credentials used to access your FinAI workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between gap-3 rounded-xl border p-3">
                <div><p className="text-sm font-medium">Password</p><p className="mt-1 text-xs text-muted-foreground">{hasPasswordLogin ? "Send a secure password reset link to your current email." : "This account signs in through a linked identity provider. Manage its password with that provider."}</p></div>
                {hasPasswordLogin && <Button size="sm" variant="outline" onClick={() => void sendPasswordReset()} disabled={securityBusy || !user?.email}>Reset</Button>}
              </div>
              <p className="text-xs leading-5 text-muted-foreground">Profile details are stored in your own account document. Your business records and subscription entitlement are not changed by these actions.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

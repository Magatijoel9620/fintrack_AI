"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { useAuth } from "@/context/auth-context";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { friendlyAuthError } from "@/lib/friendly-errors";

export default function Login() {
  const { signIn, signUp, signInGoogle } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [register, setRegister] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      if (register) await signUp(email, password);
      else await signIn(email, password);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Authentication failed",
        description: friendlyAuthError(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setLoading(true);
    try {
      await signInGoogle();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Google sign-in failed",
        description: friendlyAuthError(error),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-[2rem] border bg-card shadow-sm lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative hidden flex-col justify-between overflow-hidden bg-[#0c1427] p-10 text-white lg:flex">
          <div className="absolute -right-24 -top-20 h-80 w-80 rounded-full bg-[#3d65c2]/30 blur-3xl" />
          <div className="relative flex items-center gap-3">
            <img
              src="/finai.png"
              alt="FinAI"
              className="h-12 w-12 rounded-xl object-cover"
            />
            <div>
              <p className="font-headline text-lg font-bold">FinAI</p>
              <p className="text-xs text-slate-300">
                Inventory &amp; business finance
              </p>
            </div>
          </div>
          <div className="relative">
            <img
              src="/illustrations/inventory-operations.svg"
              alt="Illustration of inventory and business performance dashboards"
              className="mx-auto w-full max-w-xl"
            />
            <h1 className="mt-4 max-w-lg font-headline text-4xl font-bold leading-tight tracking-tight">
              Know your stock. Understand your business.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
              One focused workspace for products, purchasing, sales, cash flow
              and smarter decisions.
            </p>
          </div>
          <div className="relative flex items-center gap-2 text-xs text-slate-300">
            <ShieldCheck className="h-4 w-4 text-[#b1c1e7]" />
            Your business information stays private to your account
          </div>
        </section>

        <section className="flex items-center justify-center p-5 sm:p-10">
          <div className="w-full max-w-md">
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <img
                src="/finai.png"
                alt="FinAI"
                className="h-12 w-12 rounded-xl object-cover"
              />
              <div>
                <p className="font-headline text-lg font-bold">FinAI</p>
                <p className="text-xs text-muted-foreground">
                  Inventory &amp; business finance
                </p>
              </div>
            </div>

            <div className="mb-8">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-muted/60 px-3 py-1.5 text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Your business, in focus
              </div>
              <h2 className="font-headline text-3xl font-bold tracking-tight">
                {register ? "Create your workspace" : "Welcome back"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {register
                  ? "Create an account to start your 21-day trial."
                  : "Sign in to continue to your business workspace."}
              </p>
            </div>

            <Card className="border-0 shadow-none">
              <CardHeader className="px-0 pb-4">
                <CardTitle className="text-base">
                  {register ? "Create account" : "Sign in"}
                </CardTitle>
                <CardDescription>
                  Your account keeps your workspace and business records
                  private.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-0">
                <form onSubmit={submit} className="space-y-3">
                  {isFirebaseConfigured ? (
                    <>
                      <div className="space-y-1.5">
                        <label
                          className="text-sm font-medium"
                          htmlFor="email"
                        >
                          Email address
                        </label>
                        <Input
                          id="email"
                          type="email"
                          autoComplete="email"
                          placeholder="you@business.com"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label
                          className="text-sm font-medium"
                          htmlFor="password"
                        >
                          Password
                        </label>
                        <Input
                          id="password"
                          type="password"
                          autoComplete={
                            register ? "new-password" : "current-password"
                          }
                          placeholder="At least 6 characters"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          minLength={6}
                          required
                        />
                      </div>
                      <Button className="mt-2 w-full" disabled={loading}>
                        {loading && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        {register ? "Create account" : "Sign in"}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                      Firebase is not configured.
                    </p>
                  )}
                </form>

                {isFirebaseConfigured && (
                  <>
                    <div className="relative py-1 text-center text-xs text-muted-foreground">
                      <span className="bg-card px-2">or continue with</span>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={loading}
                      onClick={() => void google()}
                    >
                      Continue with Google
                    </Button>
                    <p className="text-center text-sm text-muted-foreground">
                      {register
                        ? "Already have an account?"
                        : "New to FinAI?"}{" "}
                      <button
                        type="button"
                        className="font-semibold text-primary hover:underline"
                        onClick={() => setRegister(!register)}
                      >
                        {register ? "Sign in" : "Create an account"}
                      </button>
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
              By signing in, you can securely manage your business records.
              Only people with access to your workspace can view its
              information.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { getIdTokenResult } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/context/auth-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  ArrowLeft,
  Building2,
  CircleAlert,
  Gauge,
  ShieldCheck,
  Users,
} from "lucide-react";
type Metrics = {
  registeredBusinesses?: number;
  registeredUsers?: number;
  activeBusinesses?: number;
  trialingBusinesses?: number;
  suspendedBusinesses?: number;
  lastUpdated?: { toDate?: () => Date } | string;
  serviceStatus?: string;
};
export default function PlatformAdminPage() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [metricsState, setMetricsState] = useState<"loading"|"live"|"missing"|"error">("loading");
  useEffect(() => {
    let alive = true;
    if (!user) {
      setChecking(false);
      return () => {
        alive = false;
      };
    }
    void getIdTokenResult(user, true)
      .then((token) => {
        if (!alive) return;
        const ok = token.claims.platformAdmin === true;
        setAuthorized(ok);
        setChecking(false);
        if (!ok)
          setError(
            "This account is not authorized for platform administration.",
          );
      })
      .catch(() => {
        if (alive) {
          setChecking(false);
          setError("Could not verify platform permissions.");
        }
      });
    return () => {
      alive = false;
    };
  }, [user]);
  useEffect(() => {
    if (!authorized || !db) return;
    setMetricsState("loading");
    setError("");
    return onSnapshot(
      doc(db, "platformMetrics", "overview"),
      (snap) => {
        if (snap.exists()) { setMetrics(snap.data() as Metrics); setMetricsState("live"); setError(""); }
        else { setMetrics(null); setMetricsState("missing"); setError("Aggregate metrics have not been provisioned yet. The dashboard remains available; create platformMetrics/overview through a trusted backend job."); }
      },
      (err) => {
        setMetricsState("error");
        setError(err?.code === "permission-denied" ? "Firestore denied access to aggregate platform metrics. Check the deployed platform-admin read rule and the platformAdmin custom claim." : "Could not connect to the aggregate metrics feed. Check network status and the deployed Firestore configuration.");
      },
    );
  }, [authorized, retryKey]);
  if (loading || checking)
    return (
      <main className="grid min-h-screen place-items-center">
        Verifying platform permissions…
      </main>
    );
  if (!authorized)
    return (
      <main className="mx-auto grid min-h-screen max-w-lg content-center gap-4 p-6">
        <ShieldCheck className="h-10 w-10 text-primary" />
        <h1 className="text-2xl font-bold">Restricted platform area</h1>
        <p className="text-sm text-muted-foreground">
          {error || "This account isn't assigned platform administrator access."}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">You are still signed in to your normal workspace. Platform access is a separate permission and cannot be enabled by signing in again.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => router.replace("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return to my workspace
          </Button>
          <Button variant="outline" onClick={async () => { await logout(); router.replace("/"); }}>
            Sign out
          </Button>
        </div>
      </main>
    );
  const cards = [
    {
      label: "Registered businesses",
      value: metrics?.registeredBusinesses,
      Icon: Building2,
    },
    { label: "Registered users", value: metrics?.registeredUsers, Icon: Users },
    {
      label: "Active businesses",
      value: metrics?.activeBusinesses,
      Icon: Activity,
    },
    { label: "Suspended businesses", value: metrics?.suspendedBusinesses, Icon: CircleAlert },
  ];
  return (
    <main className="min-h-screen bg-muted/40 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <img
                src="/finai.png"
                alt="FinAI"
                className="h-10 w-10 rounded-xl"
              />
              <span className="font-headline text-lg font-bold">FinAI</span>
            </div>
            <div className="flex flex-wrap items-center gap-2"><Badge><ShieldCheck className="mr-1 h-3 w-3" />Platform Admin</Badge><Badge variant={metricsState === "live" ? "default" : "secondary"}>{metricsState === "live" ? "Live aggregate feed" : metricsState === "loading" ? "Connecting…" : metricsState === "missing" ? "Awaiting metrics" : "Feed unavailable"}</Badge></div>
            <h1 className="mt-3 font-headline text-3xl font-bold">
              Platform operations
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Aggregate service health and usage. Tenant business records are
              not exposed in this dashboard.
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Business app
          </Button>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(({ label, value, Icon }) => (
            <Card key={label} className="rounded-2xl">
              <CardContent className="flex items-start justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">{label}</p>
                  <p className="mt-2 text-3xl font-bold">{value ?? "—"}</p>
                </div>
                <Icon className="h-5 w-5 text-primary" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5" />
                System health
              </CardTitle>
              <CardDescription>
                Read-only operational summary maintained by trusted backend
                jobs.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Reported service status</span>
                <Badge
                  variant={
                    metrics?.serviceStatus === "healthy"
                      ? "default"
                      : "secondary"
                  }
                >
                  {metrics?.serviceStatus ?? "No health feed"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Trialing businesses</span>
                <span className="font-semibold">
                  {metrics?.trialingBusinesses ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Metrics last updated</span>
                <span className="text-sm text-muted-foreground">
                  {metrics?.lastUpdated &&
                  typeof metrics.lastUpdated === "object" &&
                  "toDate" in metrics.lastUpdated &&
                  metrics.lastUpdated.toDate
                    ? metrics.lastUpdated.toDate().toLocaleString()
                    : typeof metrics?.lastUpdated === "string"
                      ? metrics.lastUpdated
                      : "Not available"}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Maintenance & support</CardTitle>
              <CardDescription>
                Controls are deliberately read-only until a trusted server-side
                admin API is configured.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border p-4">
                <p className="font-medium">Maintenance mode</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Connect a server-side feature flag before enabling global
                  maintenance.
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="font-medium">Audit and security events</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Only sanitized platform events belong here. Do not store user
                  transaction contents or credentials in platform logs.
                </p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="font-medium">Privacy boundary</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  This UI reads aggregate metrics only. It does not query
                  businesses, user profiles, products, invoices or payments.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        {error && <div role="status" className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">{error}</p><Button variant="outline" onClick={() => setRetryKey((n) => n + 1)}>Retry metrics</Button></div>}
      </div>
    </main>
  );
}

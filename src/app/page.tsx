"use client";

import { useAuth } from "@/context/auth-context";
import Login from "@/components/login";
import InventoryApp from "./dashboard/page";

export default function HomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center gap-3 text-sm text-muted-foreground">
        <img src="/finai.png" alt="FinAI" className="h-12 w-12 rounded-xl" />
        <span>Loading FinAI…</span>
      </main>
    );
  }

  return user ? <InventoryApp /> : <Login />;
}

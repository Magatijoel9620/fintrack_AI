import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
// @ts-expect-error - CSS imports are handled by Next.js at build time
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/context/auth-context";
import { InventoryProvider } from "@/context/inventory-context";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
export const metadata: Metadata = {
  title: "FinAI — Inventory & Business Finance",
  description:
    "Stock, sales, purchasing and business intelligence in one clear workspace.",
  applicationName: "FinAI",
  icons: { icon: "/finai.png", shortcut: "/finai.png", apple: "/finai.png" },
  manifest: "/manifest.json",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${manrope.variable} font-body antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <InventoryProvider>
              {children}
              <Toaster />
            </InventoryProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

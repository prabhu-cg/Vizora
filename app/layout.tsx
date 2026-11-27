import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SkipLink } from "@/components/layout/skip-link";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "VIZORA — Anything in. Visual understanding out.", template: "%s · VIZORA" },
  description:
    "VIZORA is a local-first universal visualisation platform. Bring in data and ideas; get visual understanding out.",
  applicationName: "VIZORA",
};

export const viewport: Viewport = {
  themeColor: "#111827",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full">
        <SkipLink />
        {children}
        <Toaster />
      </body>
    </html>
  );
}

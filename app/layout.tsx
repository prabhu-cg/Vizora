import type { Metadata, Viewport } from "next";
import { DM_Sans, Newsreader } from "next/font/google";
import { SkipLink } from "@/components/layout/skip-link";
import { Toaster } from "@/components/ui/sonner";
import { THEME_INIT_SCRIPT } from "@/hooks/use-theme";
import "./globals.css";

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"], display: "swap" });
// One static weight (500) for headlines, as the system specifies.
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], weight: "500", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Vizora — See beyond information", template: "%s · Vizora" },
  description:
    "Vizora is a local-first universal visualisation platform. See beyond information.",
  applicationName: "VIZORA",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfaf3" },
    { media: "(prefers-color-scheme: dark)", color: "#181716" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${dmSans.variable} ${newsreader.variable} h-full`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <SkipLink />
        {children}
        <Toaster />
      </body>
    </html>
  );
}

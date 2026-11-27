import type { Metadata } from "next";
import { AppProviders } from "@/components/layout/providers";

export const metadata: Metadata = { robots: { index: false } };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}

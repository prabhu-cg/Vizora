"use client";

import { useEffect, type ReactNode } from "react";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { EntitlementProvider } from "@/features/entitlements/client";
import { StorageProvider } from "@/hooks/use-storage";
import { installGlobalErrorLogging } from "@/lib/logging";
import { entitlements } from "@/services";

/** Client providers for everything under /app. */
export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => installGlobalErrorLogging(), []);
  return (
    <ErrorBoundary title="VIZORA hit an unexpected problem">
      <EntitlementProvider service={entitlements}>
        <StorageProvider>{children}</StorageProvider>
      </EntitlementProvider>
    </ErrorBoundary>
  );
}

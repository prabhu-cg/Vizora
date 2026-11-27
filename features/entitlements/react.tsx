"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { FeatureId } from "./features";
import { createEntitlementService, type EntitlementService } from "./service";

const defaultService = createEntitlementService();
const EntitlementContext = createContext<EntitlementService>(defaultService);

export function EntitlementProvider({
  service = defaultService,
  children,
}: {
  service?: EntitlementService;
  children: ReactNode;
}) {
  return <EntitlementContext.Provider value={service}>{children}</EntitlementContext.Provider>;
}

export function useEntitlements(): EntitlementService {
  return useContext(EntitlementContext);
}

export function useFeature(feature: FeatureId): boolean {
  return useEntitlements().can(feature);
}

/** Renders children only when the feature is allowed. */
export function FeatureGate({
  feature,
  fallback = null,
  children,
}: {
  feature: FeatureId;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  return useFeature(feature) ? <>{children}</> : <>{fallback}</>;
}

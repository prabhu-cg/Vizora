import { createEntitlementService } from "@/features/entitlements";
import { createExportManager } from "@/lib/export";

/**
 * Composition root for app-wide singletons. Everything is constructed from the
 * entitlement service so plan logic stays in one place.
 */
export const entitlements = createEntitlementService();
export const exportManager = createExportManager(entitlements);

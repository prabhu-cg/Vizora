"use client";

import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { LoadingState } from "@/components/shared/loading-state";
import { getStorage, type VizoraStorage } from "@/lib/storage";

const StorageContext = createContext<VizoraStorage | null>(null);

/**
 * Supplies the storage backend. Pass `storage` in tests; in the browser the
 * IndexedDB singleton is created lazily on the client only.
 */
export function StorageProvider({ storage, children }: { storage?: VizoraStorage; children: ReactNode }) {
  const [value] = useState<VizoraStorage | null>(() =>
    storage ?? (typeof window === "undefined" ? null : getStorage()),
  );
  return <StorageContext.Provider value={value}>{children}</StorageContext.Provider>;
}

/** Null during server rendering. Consumers must only touch it inside effects/handlers. */
export function useStorage(): VizoraStorage | null {
  return useContext(StorageContext);
}

export function useRequiredStorage(): VizoraStorage {
  const storage = useStorage();
  if (!storage) throw new Error("Storage is not available yet.");
  return storage;
}

const noopSubscribe = () => () => undefined;

/**
 * Renders children only on the client, after hydration. Storage-backed views
 * live behind this so server prerendering never touches IndexedDB and the
 * server/client markup always matches (both render the loading state first).
 */
export function StorageGate({ children }: { children: ReactNode }) {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!hydrated) return <LoadingState label="Loading" rows={2} />;
  return <>{children}</>;
}

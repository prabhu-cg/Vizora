"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * State remembered in this browser (a view preference such as a sort order or
 * which panel is collapsed). It is never required: if storage is blocked the
 * value simply lasts for the session. Starts at `initial` on both server and
 * client so hydration always matches, then adopts the saved value.
 */
export function usePersistentState<T>(key: string, initial: T, valid: (v: unknown) => v is T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return;
      const parsed: unknown = JSON.parse(raw);
      // Adopting a saved preference after hydration is the point of this hook.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (valid(parsed)) setValue(parsed);
    } catch {
      /* unreadable or blocked: keep the default */
    }
    // `valid` is a constant predicate at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback(
    (next: T | ((p: T) => T)) => {
      setValue((prev) => {
        const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        try {
          localStorage.setItem(key, JSON.stringify(v));
        } catch {
          /* not saved; still applied for this session */
        }
        return v;
      });
    },
    [key],
  );
  return [value, set];
}

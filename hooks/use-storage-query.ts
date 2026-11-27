"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { ChangeEvent } from "@/lib/storage";
import type { VizoraStorage } from "@/lib/storage";
import { useStorage } from "./use-storage";

export type QueryState<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; error: Error };

type Action<T> =
  | { type: "loading" }
  | { type: "ready"; data: T }
  | { type: "error"; error: Error };

function reducer<T>(state: QueryState<T>, action: Action<T>): QueryState<T> {
  switch (action.type) {
    case "loading":
      return state.status === "ready" ? state : { status: "loading" };
    case "ready":
      return { status: "ready", data: action.data };
    case "error":
      return { status: "error", error: action.error };
  }
}

/**
 * Run a storage query and keep it fresh: refetches when relevant writes occur
 * in this tab or any other. `query` and `relevant` must be referentially stable
 * (wrap in useCallback).
 */
export function useStorageQuery<T>(
  query: (storage: VizoraStorage) => Promise<T>,
  relevant: (event: ChangeEvent) => boolean,
): QueryState<T> & { reload: () => void } {
  const storage = useStorage();
  const [state, dispatch] = useReducer(reducer<T>, { status: "loading" });
  const generation = useRef(0);

  const run = useCallback(() => {
    if (!storage) return;
    const mine = ++generation.current;
    query(storage).then(
      (data) => {
        if (mine === generation.current) dispatch({ type: "ready", data });
      },
      (error: unknown) => {
        if (mine === generation.current) {
          dispatch({ type: "error", error: error instanceof Error ? error : new Error(String(error)) });
        }
      },
    );
  }, [storage, query]);

  useEffect(() => {
    if (!storage) return;
    run();
    const off = storage.subscribe((event) => {
      if (relevant(event)) run();
    });
    return () => {
      off();
      // A counter, not a DOM ref: bumping it discards results that arrive after unmount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
    };
  }, [storage, run, relevant]);

  const reload = useCallback(() => {
    dispatch({ type: "loading" });
    run();
  }, [run]);

  return { ...state, reload };
}

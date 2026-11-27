"use client";

import { AlertTriangle, Check, CircleDot, GitMerge } from "lucide-react";
import { Spinner } from "@/components/shared/loading-state";
import type { AutosaveState } from "@/features/visualisation/autosave";
import { formatRelative } from "@/lib/utils/time";
import { cn } from "@/lib/utils/cn";

const LABELS = {
  saved: "Saved",
  unsaved: "Unsaved changes",
  saving: "Saving…",
  error: "Not saved",
  conflict: "Conflict",
} as const;

/** Polite live region so assistive tech hears save-state changes without being interrupted. */
export function SaveStatus({ state, className }: { state: AutosaveState; className?: string }) {
  const { status } = state;
  const tone =
    status === "saved"
      ? "text-success"
      : status === "error" || status === "conflict"
        ? "text-destructive"
        : "text-muted-foreground";
  return (
    <div role="status" aria-live="polite" className={cn("flex items-center gap-1.5 text-sm font-medium", tone, className)}>
      {status === "saved" && <Check className="size-4" aria-hidden="true" />}
      {status === "unsaved" && <CircleDot className="size-4" aria-hidden="true" />}
      {status === "saving" && <Spinner />}
      {status === "error" && <AlertTriangle className="size-4" aria-hidden="true" />}
      {status === "conflict" && <GitMerge className="size-4" aria-hidden="true" />}
      <span>{LABELS[status]}</span>
      {status === "saved" && state.lastSavedAt && (
        <span className="hidden font-normal text-muted-foreground md:inline">· {formatRelative(state.lastSavedAt)}</span>
      )}
    </div>
  );
}

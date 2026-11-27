"use client";

import { AlertTriangle, GitMerge } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";

export function ConflictBanner({ onKeepMine, onLoadLatest }: { onKeepMine: () => void; onLoadLatest: () => void }) {
  const [confirming, setConfirming] = useState<"mine" | "latest">();
  return (
    <div role="alert" className="flex flex-col gap-3 border-b border-border bg-warning-soft px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2 text-warning">
        <GitMerge className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          <strong>This visualisation was changed in another tab or window.</strong> Autosave is paused so nothing is overwritten. Choose
          which version to keep.
        </span>
      </p>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" variant="secondary" onClick={() => setConfirming("latest")}>
          Load the other version
        </Button>
        <Button size="sm" onClick={() => setConfirming("mine")}>
          Keep my version
        </Button>
      </div>
      <ConfirmDialog
        open={confirming !== undefined}
        onOpenChange={(o) => !o && setConfirming(undefined)}
        title={confirming === "mine" ? "Overwrite the other version?" : "Discard your changes?"}
        description={
          confirming === "mine"
            ? "Your version will replace the one saved from the other tab. Those changes will be lost."
            : "Your unsaved edits in this tab will be discarded and the version from the other tab loaded."
        }
        confirmLabel={confirming === "mine" ? "Keep my version" : "Load other version"}
        onConfirm={async () => (confirming === "mine" ? onKeepMine() : onLoadLatest())}
      />
    </div>
  );
}

export function SaveErrorBanner({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-2 border-b border-border bg-destructive-soft px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          <strong>Your latest changes are not saved.</strong> {message} They are still on screen; keep this tab open and retry.
        </span>
      </p>
      <Button size="sm" variant="destructive" onClick={onRetry}>
        Retry saving
      </Button>
    </div>
  );
}

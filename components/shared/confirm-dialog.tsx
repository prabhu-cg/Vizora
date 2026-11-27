"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/dialog";
import { errorMessage, notify } from "@/lib/notify";
import { Spinner } from "./loading-state";

/**
 * Confirmation for destructive actions. The action runs only on explicit
 * confirm; failures are reported and the dialog stays open.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  confirmVariant = "destructive",
  informOnly = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  /** Destructive for deletions; primary for ordinary confirmations. */
  confirmVariant?: "destructive" | "primary";
  /** Omit the confirm button (the dialog only informs). */
  informOnly?: boolean;
  onConfirm: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);

  const confirm = async () => {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      notify.error("Could not complete that action", errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogBody>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>{description}</div>
          </AlertDialogDescription>
        </AlertDialogBody>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{informOnly ? "Close" : "Cancel"}</AlertDialogCancel>
          {!informOnly && (
            <Button variant={confirmVariant} onClick={confirm} disabled={pending}>
              {pending && <Spinner />}
              {confirmLabel}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

import { AlertDialog as AlertPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { buttonVariants } from "./button";

/**
 * Dialogs interrupt only for destructive confirmations. Everything else that
 * collects input is a Drawer (components/ui/drawer.tsx).
 * 20px, flat 40% scrim (no blur), desk footer bar with a hairline.
 */
export const AlertDialog = AlertPrimitive.Root;

export function AlertDialogContent({ className, ...props }: React.ComponentProps<typeof AlertPrimitive.Content>) {
  return (
    <AlertPrimitive.Portal>
      <AlertPrimitive.Overlay className="vz-scrim fixed inset-0 z-50 bg-(--scrim)" />
      <AlertPrimitive.Content
        className={cn(
          "vz-dialog fixed left-1/2 top-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-card border border-border bg-popover text-body shadow-overlay",
          className,
        )}
        {...props}
      />
    </AlertPrimitive.Portal>
  );
}
export function AlertDialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("grid gap-1.5 p-6", className)} {...props} />;
}
export function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2 border-t border-border bg-surface px-6 py-4 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}
export function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof AlertPrimitive.Title>) {
  return <AlertPrimitive.Title className={cn("font-display text-xl text-foreground", className)} {...props} />;
}
export function AlertDialogDescription({ className, ...props }: React.ComponentProps<typeof AlertPrimitive.Description>) {
  return <AlertPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
export function AlertDialogCancel({ className, ...props }: React.ComponentProps<typeof AlertPrimitive.Cancel>) {
  return <AlertPrimitive.Cancel className={cn(buttonVariants({ variant: "outline" }), className)} {...props} />;
}

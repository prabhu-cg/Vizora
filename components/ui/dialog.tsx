"use client";

import { X } from "lucide-react";
import { AlertDialog as AlertPrimitive, Dialog as DialogPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { buttonVariants } from "./button";

const overlay = "fixed inset-0 z-50 bg-navy/50";
const content =
  "fixed left-1/2 top-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl border border-border bg-popover p-6 text-popover-foreground shadow-lg";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlay} />
      <DialogPrimitive.Content className={cn(content, className)} {...props}>
        {children}
        <DialogPrimitive.Close
          className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1.5 pr-8", className)} {...props} />;
}
export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}
export function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-lg font-semibold", className)} {...props} />;
}
export function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

/* Alert dialog: for destructive confirmations; cannot be dismissed by overlay click. */
export const AlertDialog = AlertPrimitive.Root;

export function AlertDialogContent({ className, ...props }: React.ComponentProps<typeof AlertPrimitive.Content>) {
  return (
    <AlertPrimitive.Portal>
      <AlertPrimitive.Overlay className={overlay} />
      <AlertPrimitive.Content className={cn(content, className)} {...props} />
    </AlertPrimitive.Portal>
  );
}
export function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof AlertPrimitive.Title>) {
  return <AlertPrimitive.Title className={cn("text-lg font-semibold", className)} {...props} />;
}
export function AlertDialogDescription({ className, ...props }: React.ComponentProps<typeof AlertPrimitive.Description>) {
  return <AlertPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />;
}
export function AlertDialogCancel({ className, ...props }: React.ComponentProps<typeof AlertPrimitive.Cancel>) {
  return <AlertPrimitive.Cancel className={cn(buttonVariants({ variant: "secondary" }), className)} {...props} />;
}

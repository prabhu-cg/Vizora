"use client";

import { X } from "lucide-react";
import { Dialog as DrawerPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

const SIZES = { sm: "sm:max-w-md", md: "sm:max-w-xl", lg: "sm:max-w-3xl" } as const;

export const Drawer = DrawerPrimitive.Root;

/**
 * Right-hand drawer: desk header bar (Newsreader title, outlined pill close),
 * paper body, optional desk footer bar. Full width below `sm`.
 * Put `.form-actions` children in <DrawerFooter>.
 */
export function DrawerContent({
  className,
  size = "md",
  children,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content> & { size?: keyof typeof SIZES }) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Overlay className="vz-scrim fixed inset-0 z-50 bg-(--scrim)" />
      <DrawerPrimitive.Content
        className={cn(
          "vz-drawer fixed inset-y-0 right-0 z-50 flex w-full flex-col overflow-hidden border-l border-border bg-background text-body shadow-drawer outline-none sm:rounded-l-card",
          SIZES[size],
          className,
        )}
        {...props}
      >
        {children}
      </DrawerPrimitive.Content>
    </DrawerPrimitive.Portal>
  );
}

export function DrawerHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border bg-surface px-6 py-5 sm:px-8 sm:py-6">
      <div className="min-w-0">
        <DrawerPrimitive.Title className="line-clamp-2 font-display text-2xl leading-tight text-foreground">{title}</DrawerPrimitive.Title>
        {description ? (
          <DrawerPrimitive.Description className="mt-1 text-sm text-muted-foreground">{description}</DrawerPrimitive.Description>
        ) : (
          <DrawerPrimitive.Description className="sr-only">{title}</DrawerPrimitive.Description>
        )}
      </div>
      <DrawerPrimitive.Close
        aria-label="Close"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border-strong bg-background text-foreground hover:bg-muted"
      >
        <X className="size-4" aria-hidden="true" />
      </DrawerPrimitive.Close>
    </div>
  );
}

export function DrawerBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8 sm:py-8", className)} {...props} />;
}

export function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2 border-t border-border bg-surface px-6 py-4 sm:flex-row sm:justify-end sm:px-8", className)}
      {...props}
    />
  );
}

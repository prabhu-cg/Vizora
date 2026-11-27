"use client";

import { ContextMenu as MenuPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

/** Right-click (or the keyboard's menu key) menu. Styled and animated like the dropdown menu. */
export const ContextMenu = MenuPrimitive.Root;
export const ContextMenuTrigger = MenuPrimitive.Trigger;

export function ContextMenuContent({ className, ...props }: React.ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        className={cn("vz-menu z-50 min-w-52 overflow-hidden rounded-menu border border-border-strong bg-popover p-1 text-body shadow-overlay", className)}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export function ContextMenuItem({ className, destructive, ...props }: React.ComponentProps<typeof MenuPrimitive.Item> & { destructive?: boolean }) {
  return (
    <MenuPrimitive.Item
      className={cn(
        "relative flex min-h-9 cursor-default select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-muted [&_svg]:size-4 [&_svg]:shrink-0",
        destructive && "text-destructive data-[highlighted]:bg-destructive-soft",
        className,
      )}
      {...props}
    />
  );
}

export function ContextMenuLabel({ className, ...props }: React.ComponentProps<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn("px-2.5 pb-1 pt-2 text-xs font-semibold text-muted-foreground", className)} {...props} />;
}

export function ContextMenuSeparator({ className, ...props }: React.ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />;
}

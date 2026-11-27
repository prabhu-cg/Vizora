"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      richColors={false}
      toastOptions={{
        classNames: {
          toast: "!rounded-lg !border !border-border !bg-popover !text-popover-foreground !shadow-md",
          description: "!text-muted-foreground",
        },
      }}
    />
  );
}

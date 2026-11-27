"use client";

import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/hooks/use-theme";

/** Bottom centre: the drawer's primary button sits bottom right, and a toast under a resting pointer never times out. */
export function Toaster() {
  const { theme } = useTheme();
  return (
    <Sonner
      position="bottom-center"
      theme={theme}
      closeButton
      toastOptions={{
        classNames: {
          toast: "!rounded-menu !border !border-border-strong !bg-popover !text-body !shadow-overlay",
          description: "!text-muted-foreground",
        },
      }}
    />
  );
}

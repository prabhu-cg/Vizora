import { Label as LabelPrimitive } from "radix-ui";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn("text-sm font-medium leading-none text-foreground", className)}
      {...props}
    />
  );
}

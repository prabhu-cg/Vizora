import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva("inline-flex h-5 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold whitespace-nowrap", {
  variants: {
    variant: {
      soft: "border-transparent bg-primary-soft text-primary-text",
      secondary: "border-transparent bg-muted text-foreground",
      outline: "border-border-strong bg-background text-foreground",
      success: "border-transparent bg-success-soft text-success",
      warning: "border-transparent bg-warning-soft text-warning",
      danger: "border-transparent bg-destructive-soft text-destructive",
      info: "border-transparent bg-info-soft text-info",
    },
  },
  defaultVariants: { variant: "secondary" },
});

export function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        neutral: "border-border bg-muted text-foreground",
        blue: "border-transparent bg-blue-soft text-accent-foreground",
        violet: "border-transparent bg-violet-soft text-[#5b34c4]",
        success: "border-transparent bg-success-soft text-success",
        warning: "border-transparent bg-orange-soft text-orange-text",
        danger: "border-transparent bg-danger-soft text-destructive",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

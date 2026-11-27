import * as React from "react";
import { cn } from "@/lib/utils/cn";

const field =
  "w-full rounded-md border border-input bg-surface px-3 text-sm text-foreground shadow-xs placeholder:text-muted-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive";

export function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(field, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(field, "min-h-20 py-2", className)} {...props} />;
}

export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select data-slot="select" className={cn(field, "h-10 pr-8", className)} {...props} />;
}

import { ChevronDown } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

const field =
  "w-full rounded-input border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive";

export function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(field, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(field, "min-h-20 py-2", className)} {...props} />;
}

/**
 * A native <select> (so keyboard, screen reader and mobile pickers all work) with
 * the browser's cramped arrow replaced by an inset chevron. A caller's `w-auto`
 * makes the control shrink to its content, for toolbars.
 */
export function Select({ className, ...props }: React.ComponentProps<"select">) {
  const fitContent = /(^|\s)w-auto(\s|$)/.test(className ?? "");
  return (
    <span className={cn("relative", fitContent ? "inline-block" : "block")}>
      <select data-slot="select" className={cn(field, "h-10 cursor-pointer appearance-none pr-10 [&_option]:bg-popover [&_option]:text-foreground", className)} {...props} />
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </span>
  );
}

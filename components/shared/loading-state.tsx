import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils/cn";

/** Accessible loading placeholder: announces once, skeleton shapes are hidden from AT. */
export function LoadingState({ label = "Loading", rows = 3, className }: { label?: string; rows?: number; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("grid gap-3", className)}>
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)}
    />
  );
}

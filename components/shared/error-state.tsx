import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  children,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-card border border-border bg-card px-6 py-12 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-destructive-soft text-destructive">
        <AlertTriangle className="size-6" aria-hidden="true" />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      {message && <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{message}</p>}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {onRetry && <Button onClick={onRetry}>Try again</Button>}
        {children}
      </div>
    </div>
  );
}

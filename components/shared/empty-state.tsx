import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-input bg-surface px-6 py-14 text-center",
        className,
      )}
    >
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-blue-soft text-primary">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

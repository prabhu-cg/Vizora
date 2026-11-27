import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-sm">{eyebrow}</div>}
        <h1 className="text-2xl font-bold sm:text-3xl [overflow-wrap:anywhere]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-muted-foreground [overflow-wrap:anywhere]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

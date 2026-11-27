import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { AVAILABILITY_LABEL, type Availability } from "@/lib/marketing/content";
import { cn } from "@/lib/utils/cn";

const STATUS_VARIANT = { available: "success", "in-development": "soft", planned: "outline" } as const;

export function StatusBadge({ status, className }: { status: Availability; className?: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className={className}>
      {AVAILABILITY_LABEL[status]}
    </Badge>
  );
}

/** A full-width band. Bands alternate desk and paper, separated by a hairline. */
export function Band({
  id,
  tone = "paper",
  children,
  className,
}: {
  id?: string;
  tone?: "desk" | "paper";
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-heading` : undefined}
      className={cn("border-t border-border", tone === "desk" ? "bg-surface" : "bg-background", className)}
    >
      <div className="mx-auto max-w-[var(--container-marketing)] px-4 py-16 sm:px-8 sm:py-20">{children}</div>
    </section>
  );
}

export function SectionHeading({ id, title, lead, className }: { id?: string; title: string; lead?: string; className?: string }) {
  return (
    <div className={cn("mb-10 max-w-3xl", className)}>
      <h2 id={id ? `${id}-heading` : undefined} className="text-4xl sm:text-5xl">
        {title}
      </h2>
      {lead && <p className="mt-4 text-lg text-muted-foreground">{lead}</p>}
    </div>
  );
}

/** Page opener on the desk ground. */
export function PageHero({ title, lead, children }: { title: ReactNode; lead: string; children?: ReactNode }) {
  return (
    <header className="bg-surface">
      <div className="mx-auto max-w-[var(--container-marketing)] px-4 py-16 sm:px-8 sm:py-24">
        <h1 className="max-w-4xl text-5xl leading-none sm:text-6xl">{title}</h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">{lead}</p>
        {children && <div className="mt-8 flex flex-wrap gap-3">{children}</div>}
      </div>
    </header>
  );
}

export function CheckList({ items, tone = "check" }: { items: string[]; tone?: "check" | "next" }) {
  return (
    <ul className="grid gap-2">
      {items.map((t) => (
        <li key={t} className="flex gap-2.5 text-body">
          <span
            aria-hidden="true"
            className={cn(
              "mt-2 size-1.5 shrink-0 rounded-full",
              tone === "check" ? "bg-success" : "border border-muted-foreground bg-transparent",
            )}
          />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

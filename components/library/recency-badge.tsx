import { Badge } from "@/components/ui/badge";
import { recency } from "@/lib/library/recency";

/** "Edited 3 hours ago", highlighted when it changed within the last day so recent work stands out. */
export function RecencyBadge({ iso, label = "Edited" }: { iso: string; label?: string }) {
  const r = recency(iso);
  const recent = r.level === "just-now" || r.level === "today";
  return recent ? (
    <Badge variant="soft" className="gap-1.5">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-primary-hover" />
      {label} {r.label}
    </Badge>
  ) : (
    <span className="text-xs text-muted-foreground">
      {label} {r.label}
    </span>
  );
}

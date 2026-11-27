export type Recency = "just-now" | "today" | "this-week" | "older";

/**
 * How recently something changed, as a level (for an indicator) and a short
 * label. "Today" means within the last 24 hours, not since midnight, so the
 * answer does not flip at an arbitrary hour.
 */
export function recency(iso: string, now: number = Date.now()): { level: Recency; label: string } {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return { level: "older", label: "unknown" };
  const mins = Math.max(0, Math.round((now - t) / 60_000));
  if (mins < 5) return { level: "just-now", label: "just now" };
  if (mins < 60) return { level: "today", label: `${mins} minutes ago` };
  const hours = Math.round(mins / 60);
  if (hours < 24) return { level: "today", label: `${hours} hour${hours === 1 ? "" : "s"} ago` };
  const days = Math.round(hours / 24);
  if (days < 7) return { level: "this-week", label: `${days} day${days === 1 ? "" : "s"} ago` };
  return { level: "older", label: new Date(t).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" }) };
}

export const isRecentlyModified = (iso: string, now: number = Date.now()): boolean => {
  const { level } = recency(iso, now);
  return level === "just-now" || level === "today";
};

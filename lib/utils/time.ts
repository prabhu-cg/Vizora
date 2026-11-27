export function nowIso(): string {
  return new Date().toISOString();
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "2 minutes ago" style label; falls back to a date for older values. */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "unknown";
  const seconds = Math.round((then - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 7 * 86_400) return rtf.format(Math.round(seconds / 86_400), "day");
  return new Date(then).toLocaleDateString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

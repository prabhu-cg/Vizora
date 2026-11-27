/**
 * Error logging strategy.
 *
 * Vizora has no server-side error collection and sends nothing off the device,
 * so errors are handled in three places only:
 *  1. shown to the person in plain language (every error page and boundary),
 *  2. written to the browser console as one structured line, for support and debugging,
 *  3. kept in a small in-memory list (this tab only) that Settings can show and copy on request.
 * Nothing is persisted or transmitted. Add a remote sink only with explicit consent and a privacy update.
 */
export interface LoggedError {
  at: string;
  where: string;
  message: string;
  name: string;
  stack?: string;
  digest?: string;
}

const MAX_KEPT = 20;
const kept: LoggedError[] = [];
const listeners = new Set<() => void>();

const clip = (s: string | undefined, n: number) => (s && s.length > n ? `${s.slice(0, n)}…` : s);

export function reportError(error: unknown, where: string, extra: { digest?: string } = {}): LoggedError {
  const e = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown error");
  const entry: LoggedError = { at: new Date().toISOString(), where, name: e.name, message: clip(e.message, 500) ?? "", stack: clip(e.stack, 2000), digest: extra.digest };
  kept.unshift(entry);
  if (kept.length > MAX_KEPT) kept.length = MAX_KEPT;
  console.error(`[vizora] ${where}: ${entry.name}: ${entry.message}`, entry.digest ? `(digest ${entry.digest})` : "");
  listeners.forEach((l) => l());
  return entry;
}

export const recentErrors = (): readonly LoggedError[] => kept;
export const clearRecentErrors = () => {
  kept.length = 0;
  listeners.forEach((l) => l());
};
export function subscribeErrors(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Text a person can copy into a bug report. Contains no project content, only error details. */
export function errorReportText(): string {
  return kept.map((e) => `${e.at} ${e.where} ${e.name}: ${e.message}${e.digest ? ` (digest ${e.digest})` : ""}${e.stack ? `\n${e.stack}` : ""}`).join("\n\n");
}

let installed = false;
/** Catch errors nobody else caught (once per page). */
export function installGlobalErrorLogging(target: Window = window): void {
  if (installed) return;
  installed = true;
  target.addEventListener("error", (ev) => reportError(ev.error ?? ev.message, "window.error"));
  target.addEventListener("unhandledrejection", (ev) => reportError(ev.reason, "unhandled promise rejection"));
}

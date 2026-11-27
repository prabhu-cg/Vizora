import { findDate, isAbsolute } from "@/lib/engine/interpret/dates";

/** Strings that mean "no value" in exports from spreadsheets and databases. */
const MISSING = new Set(["", "na", "n/a", "#n/a", "null", "none", "nan", "-", "--", "?", "nil", "#null!"]);

export function isMissing(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "number") return Number.isNaN(v);
  if (typeof v === "string") return MISSING.has(v.trim().toLowerCase());
  return false;
}

const GROUPED = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/; // 1,234.56
const EURO = /^-?\d{1,3}(\.\d{3})+,\d+$/; // 1.234,56
const PLAIN = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

export interface ParsedNumber {
  value: number;
  /** A "%" or currency symbol was removed to read the number. */
  note?: "percent" | "currency";
}

/**
 * Strict number reading. Accepts 1234, -1.5, 1e3, 1,234.50, 1.234,50, £1,200,
 * (500) as -500 and 12%. Does not guess lone comma decimals ("12,5") and keeps
 * identifiers with leading zeros ("007") as text.
 */
export function parseNumber(v: unknown): ParsedNumber | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? { value: v } : undefined;
  if (typeof v !== "string") return undefined;
  let s = v.trim();
  if (!s) return undefined;
  let note: ParsedNumber["note"];
  let negative = false;
  const paren = /^\((.*)\)$/.exec(s);
  if (paren) {
    negative = true;
    s = paren[1]!.trim();
  }
  const cur = /^([-+]?)\s*[£$€¥]\s*(.*)$|^(.*?)\s*[£$€¥]$/.exec(s);
  if (cur) {
    note = "currency";
    s = ((cur[1] ?? "") + (cur[2] ?? cur[3] ?? "")).trim();
  }
  if (s.endsWith("%")) {
    note = "percent";
    s = s.slice(0, -1).trim();
  }
  if (s.startsWith("+")) s = s.slice(1);
  if (/^-?0\d/.test(s)) return undefined; // identifiers such as 007
  if (GROUPED.test(s)) s = s.replace(/,/g, "");
  else if (EURO.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  if (!PLAIN.test(s)) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n)) return undefined;
  if (!/[.eE]/.test(s) && !Number.isSafeInteger(n)) return undefined; // would lose precision
  return { value: negative ? -n : n, note };
}

export function parseBoolean(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v !== "string") return undefined;
  const s = v.trim().toLowerCase();
  if (s === "true" || s === "yes") return true;
  if (s === "false" || s === "no") return false;
  return undefined;
}

export interface ParsedDate {
  /** 2026-03-12, 2026-03, 2026-Q3 or 2026-03-12T10:30:00. */
  value: string;
  /** Day and month could be swapped; day first was assumed. */
  ambiguous?: boolean;
}

const ISO_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

export function parseDate(v: unknown): ParsedDate | undefined {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? undefined : { value: fromJsDate(v) };
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return undefined;
  const dt = ISO_DATETIME.exec(s);
  if (dt) return Number.isNaN(Date.parse(s.replace(" ", "T"))) ? undefined : { value: s.replace(" ", "T") };
  const f = findDate(s);
  if (!f || f.index !== 0 || f.length !== s.length || !isAbsolute(f.precision)) return undefined;
  return { value: f.value, ambiguous: f.ambiguous };
}

/** Excel gives Dates in UTC; keep the calendar date (and time, if present) exactly as written. */
export function fromJsDate(d: Date): string {
  const iso = d.toISOString();
  const [date, time] = iso.split("T") as [string, string];
  return /^00:00:00(\.000)?Z$/.test(time) ? date : `${date}T${time.slice(0, 8)}`;
}

export function toText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return fromJsDate(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

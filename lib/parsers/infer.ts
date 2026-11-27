import type { Cell, Column } from "@/types/visualisation";

const NUMBER = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

export function inferColumnType(values: readonly Cell[]): Column["type"] {
  const present = values.filter((v) => v !== null);
  if (present.length === 0) return "unknown";
  if (present.every((v) => typeof v === "number")) return "number";
  if (present.every((v) => typeof v === "boolean")) return "boolean";
  if (present.every((v) => typeof v === "string" && ISO_DATE.test(v) && !Number.isNaN(Date.parse(v)))) {
    return "date";
  }
  return "string";
}

/** Convert a raw CSV text cell to a typed cell (empty → null). */
export function coerceText(raw: string): Cell {
  const v = raw.trim();
  if (v === "") return null;
  if (NUMBER.test(v)) {
    // Identifiers such as "007" stay text; integers beyond 2^53 stay text to avoid silent precision loss.
    const leadingZero = /^-?0\d/.test(v);
    const n = Number(v);
    const isInteger = !/[.eE]/.test(v);
    if (!leadingZero && Number.isFinite(n) && (!isInteger || Number.isSafeInteger(n))) return n;
    return v;
  }
  const lower = v.toLowerCase();
  if (lower === "true") return true;
  if (lower === "false") return false;
  return v;
}

/** Make header names usable as unique, non-empty keys. */
export function normaliseHeaders(headers: readonly string[]): { key: string; label: string }[] {
  const used = new Set<string>();
  return headers.map((raw, i) => {
    const label = raw.trim() || `Column ${i + 1}`;
    let key = label;
    let n = 2;
    while (used.has(key)) key = `${label}_${n++}`;
    used.add(key);
    return { key, label };
  });
}

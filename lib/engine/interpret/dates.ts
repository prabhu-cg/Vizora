/**
 * Deterministic date recognition for timelines. Recognises ISO dates, written
 * dates, day-first numeric dates (UK style), quarters, bare years (only when
 * asked) and relative markers such as "Week 2". Nothing is guessed: invalid
 * calendar dates are not dates.
 */
export type DatePrecision = "day" | "month" | "year" | "quarter" | "relative";

export interface FoundDate {
  /** Canonical value: 2026-03-12, 2026-03, 2026, 2026-Q3, or "Week 2" for relative. */
  value: string;
  precision: DatePrecision;
  /** Comparable number for ordering (days since epoch); for relative markers a position hint only. */
  sortKey: number;
  /** The text as written. */
  label: string;
  /** Start/end offsets of the match in the source string. */
  index: number;
  length: number;
  /** True for dd/mm/yyyy where month/day could be swapped; day-first was assumed. */
  ambiguous?: boolean;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MON_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";

function monthIndex(name: string): number {
  const n = name.toLowerCase().replace(".", "");
  return MONTHS.findIndex((m) => m.startsWith(n.slice(0, 3)));
}

const pad = (n: number, w = 2) => String(n).padStart(w, "0");

function validDay(y: number, m: number, d: number): boolean {
  const t = new Date(Date.UTC(y, m, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m && t.getUTCDate() === d;
}
const days = (y: number, m: number, d: number) => Math.floor(Date.UTC(y, m, d) / 86_400_000);

type Matcher = { re: RegExp; make: (m: RegExpExecArray) => Omit<FoundDate, "index" | "length" | "label"> | null };

const MATCHERS: Matcher[] = [
  {
    // 2026-03-12, 2026-03
    re: /\b(\d{4})-(\d{2})(?:-(\d{2}))?\b/,
    make: (m) => {
      const y = +m[1]!, mo = +m[2]! - 1;
      if (mo < 0 || mo > 11) return null;
      if (m[3]) {
        const d = +m[3];
        return validDay(y, mo, d) ? { value: `${y}-${pad(mo + 1)}-${pad(d)}`, precision: "day", sortKey: days(y, mo, d) } : null;
      }
      return { value: `${y}-${pad(mo + 1)}`, precision: "month", sortKey: days(y, mo, 1) };
    },
  },
  {
    // 12 March 2026, 12th Mar 2026
    re: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MON_RE}\\s*,?\\s+(\\d{4})\\b`, "i"),
    make: (m) => {
      const d = +m[1]!, mo = monthIndex(m[2]!), y = +m[3]!;
      return mo >= 0 && validDay(y, mo, d) ? { value: `${y}-${pad(mo + 1)}-${pad(d)}`, precision: "day", sortKey: days(y, mo, d) } : null;
    },
  },
  {
    // March 12, 2026 / March 12th 2026
    re: new RegExp(`\\b${MON_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*,?\\s+(\\d{4})\\b`, "i"),
    make: (m) => {
      const mo = monthIndex(m[1]!), d = +m[2]!, y = +m[3]!;
      return mo >= 0 && validDay(y, mo, d) ? { value: `${y}-${pad(mo + 1)}-${pad(d)}`, precision: "day", sortKey: days(y, mo, d) } : null;
    },
  },
  {
    // March 2026
    re: new RegExp(`\\b${MON_RE}\\s+(\\d{4})\\b`, "i"),
    make: (m) => {
      const mo = monthIndex(m[1]!), y = +m[2]!;
      return mo >= 0 ? { value: `${y}-${pad(mo + 1)}`, precision: "month", sortKey: days(y, mo, 1) } : null;
    },
  },
  {
    // 12/03/2026 (day first)
    re: /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/,
    make: (m) => {
      const a = +m[1]!, b = +m[2]!, y = +m[3]!;
      if (!validDay(y, b - 1, a)) return null;
      return {
        value: `${y}-${pad(b)}-${pad(a)}`,
        precision: "day",
        sortKey: days(y, b - 1, a),
        ambiguous: a <= 12 && b <= 12 && a !== b,
      };
    },
  },
  {
    // Q3 2026 / 2026 Q3
    re: /\b(?:Q([1-4])\s*,?\s*(\d{4})|(\d{4})\s*Q([1-4]))\b/i,
    make: (m) => {
      const q = +(m[1] ?? m[4]!), y = +(m[2] ?? m[3]!);
      return { value: `${y}-Q${q}`, precision: "quarter", sortKey: days(y, (q - 1) * 3, 1) };
    },
  },
];

const RELATIVE = /\b(week|day|month|phase|sprint|stage|year|quarter)\s+(\d{1,3})\b/i;

/** Find the earliest date expression in `text`. `allowBareYear` additionally accepts a lone year like 2026. */
export function findDate(text: string, opts: { allowBareYear?: boolean; allowRelative?: boolean } = {}): FoundDate | undefined {
  let best: FoundDate | undefined;
  const consider = (f: FoundDate | undefined) => {
    if (f && (!best || f.index < best.index || (f.index === best.index && f.length > best.length))) best = f;
  };
  for (const { re, make } of MATCHERS) {
    const m = re.exec(text);
    if (!m) continue;
    const made = make(m);
    if (made) consider({ ...made, label: m[0], index: m.index, length: m[0].length });
  }
  if (opts.allowBareYear) {
    const m = /\b(19|20)\d{2}\b/.exec(text);
    if (m) {
      const y = +m[0];
      consider({ value: String(y), precision: "year", sortKey: days(y, 0, 1), label: m[0], index: m.index, length: m[0].length });
    }
  }
  if (opts.allowRelative) {
    const m = RELATIVE.exec(text);
    if (m) {
      const label = `${m[1]![0]!.toUpperCase()}${m[1]!.slice(1).toLowerCase()} ${+m[2]!}`;
      consider({ value: label, precision: "relative", sortKey: +m[2]!, label: m[0], index: m.index, length: m[0].length });
    }
  }
  return best;
}

export function isAbsolute(p: DatePrecision): boolean {
  return p !== "relative";
}

/** Human display for a stored date value. */
export function formatDateValue(value: string): string {
  const q = /^(\d{4})-Q([1-4])$/.exec(value);
  if (q) return `Q${q[2]} ${q[1]}`;
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (d) return `${+d[3]!} ${MONTHS[+d[2]! - 1]!.slice(0, 3).replace(/^./, (c) => c.toUpperCase())} ${d[1]}`;
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (m) return `${MONTHS[+m[2]! - 1]!.replace(/^./, (c) => c.toUpperCase())} ${m[1]}`;
  return value;
}

/** Sort key for a stored value, or undefined when it is not an absolute date. */
export function sortKeyOf(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const f = findDate(value, { allowBareYear: true });
  return f && isAbsolute(f.precision) && f.index === 0 && f.length === value.length ? f.sortKey : undefined;
}

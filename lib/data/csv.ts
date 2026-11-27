/** Minimal RFC 4180 parser: quoted fields, escaped quotes, embedded newlines, CRLF, BOM. */
export function parseCsv(input: string, delimiter: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"' && field === "") inQuotes = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (inQuotes) throw new Error("Unterminated quoted field.");
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/** Pick the delimiter that gives the most consistent multi-column first lines. */
export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 8).filter(Boolean);
  let best = ",";
  let bestScore = 0;
  for (const candidate of ["\t", ",", ";", "|"]) {
    const counts = sample.map((line) => line.split(candidate).length - 1);
    const first = counts[0] ?? 0;
    if (first === 0) continue;
    const score = counts.filter((c) => c === first).length * 1000 + first;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

/** A markdown/ASCII pipe table: "| a | b |" with an optional "---|---" rule. */
export function parsePipeTable(text: string): string[][] | undefined {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2 || !lines.every((l) => l.includes("|"))) return undefined;
  const rows = lines
    .filter((l) => !/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(l))
    .map((l) => l.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim()));
  return rows.length ? rows : undefined;
}

/** RFC 4180 writer. Quotes fields that need it and neutralises spreadsheet formula injection. */
export function toCsv(rows: readonly (readonly unknown[])[]): string {
  const cell = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    let s = typeof v === "number" ? String(v) : String(v);
    // A leading = + - @ can run as a formula when the file is opened in a spreadsheet.
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

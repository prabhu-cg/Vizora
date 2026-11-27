"use client";

import { Select } from "@/components/ui/input";
import { WarningList, type NoteLike } from "@/features/editor/source-panel";
import type { ColumnType, DataWarning, IngestPreview } from "@/lib/data";
import { cn } from "@/lib/utils/cn";

const INFO = new Set(["empty-rows", "empty-columns", "duplicate-headers", "duplicates-removed", "duplicates"]);
export const toNotes = (w: readonly DataWarning[]): NoteLike[] => w.map((x) => ({ code: x.code, message: x.message, severity: INFO.has(x.code) ? "info" : "warning" }));

const TYPES: { value: ColumnType; label: string }[] = [
  { value: "string", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Yes/No" },
];

/** First rows with the type found for each column (changeable), plus what the importer noticed. */
export function DataPreview({ preview, onType }: { preview: IngestPreview; onType?: (columnIndex: number, type: ColumnType) => void }) {
  const { dataset, profile, previewRows } = preview;
  return (
    <section aria-label="Preview of the data" className="grid gap-3">
      <p className="text-sm text-body" aria-live="polite">
        <strong>{profile.rows.toLocaleString()}</strong> row{profile.rows === 1 ? "" : "s"} · <strong>{dataset.columns.length}</strong> column{dataset.columns.length === 1 ? "" : "s"} ·{" "}
        {profile.completeness}% complete
        {profile.duplicateRows > 0 && <> · {profile.duplicateRows} duplicate row{profile.duplicateRows === 1 ? "" : "s"}</>}
        {preview.header ? "" : " · no header row found, so columns are numbered"}
      </p>
      {preview.warnings.length > 0 && <WarningList warnings={toNotes(preview.warnings)} />}
      <div className="max-h-80 overflow-auto rounded-card border border-border" tabIndex={0} role="region" aria-label={`First ${previewRows.length} rows, scrollable`}>
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">First {previewRows.length} rows. Use the selector above each column to change how it is read.</caption>
          <thead className="sticky top-0 bg-surface align-bottom">
            <tr>
              {dataset.columns.map((c, i) => (
                <th key={c.key} scope="col" className="min-w-32 border-b border-border p-2 text-left font-semibold">
                  <span className="block truncate" title={c.label}>{c.label}</span>
                  {onType ? (
                    <Select aria-label={`How to read column ${c.label}`} value={c.type === "unknown" ? "string" : c.type} onChange={(e) => onType(i, e.target.value as ColumnType)} className="mt-1 h-8 text-xs font-normal">
                      {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </Select>
                  ) : (
                    <span className="text-xs font-normal text-muted-foreground">{c.type}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((r, i) => (
              <tr key={i} className="odd:bg-card even:bg-surface/60">
                {dataset.columns.map((c) => {
                  const v = r[c.key] ?? null;
                  return (
                    <td key={c.key} className={cn("max-w-48 truncate px-2 py-1.5", c.type === "number" && "text-right tabular-nums")}>
                      {v === null ? <span aria-label="empty" className="text-muted-foreground">—</span> : String(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

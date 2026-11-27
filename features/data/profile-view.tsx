import type { DatasetProfile } from "@/lib/data";
import { WarningList, type NoteLike } from "@/features/editor/source-panel";

const fmt = (v: number | string | undefined) => (v === undefined ? "—" : typeof v === "number" ? String(Math.round(v * 1000) / 1000) : v.length > 18 ? `${v.slice(0, 17)}…` : v);

/** Counts, completeness and per-column statistics for a dataset. */
export function ProfileView({ profile, notes = [] }: { profile: DatasetProfile; notes?: NoteLike[] }) {
  return (
    <div className="grid gap-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Rows", profile.rows.toLocaleString()],
          ["Columns", String(profile.columns.length)],
          ["Complete", `${profile.completeness}%`],
          ["Duplicate rows", profile.duplicateRows.toLocaleString()],
        ].map(([k, v]) => (
          <div key={k} className="rounded-card border border-border bg-surface p-3">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="text-lg font-semibold tabular-nums text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      {notes.length > 0 && <WarningList warnings={notes} />}
      <div className="overflow-auto rounded-card border border-border" tabIndex={0} role="region" aria-label="Column profile, scrollable">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Profile of each column</caption>
          <thead className="bg-surface text-left">
            <tr>
              {["Column", "Type", "Missing", "Distinct", "Min", "Max", "Mean", "Median", "Most common"].map((h) => (
                <th key={h} scope="col" className="border-b border-border px-3 py-2 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profile.columns.map((c) => (
              <tr key={c.key} className="odd:bg-card even:bg-surface/60 align-top">
                <th scope="row" className="px-3 py-1.5 text-left font-medium">{c.label}</th>
                <td className="px-3 py-1.5">{c.type}</td>
                <td className="px-3 py-1.5 tabular-nums">{c.missing} <span className="text-muted-foreground">({c.missingPct}%)</span></td>
                <td className="px-3 py-1.5 tabular-nums">{c.distinct}</td>
                <td className="px-3 py-1.5 tabular-nums">{fmt(c.min)}</td>
                <td className="px-3 py-1.5 tabular-nums">{fmt(c.max)}</td>
                <td className="px-3 py-1.5 tabular-nums">{fmt(c.mean)}</td>
                <td className="px-3 py-1.5 tabular-nums">{fmt(c.median)}</td>
                <td className="px-3 py-1.5">{c.top.slice(0, 3).map((t) => `${fmt(t.value)} (${t.count})`).join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {profile.columns.some((c) => c.notes.length) && (
        <ul className="grid gap-1 text-sm text-muted-foreground">
          {profile.columns.flatMap((c) => c.notes.map((n) => <li key={`${c.key}-${n}`}><strong className="text-foreground">{c.label}:</strong> {n}</li>))}
        </ul>
      )}
    </div>
  );
}

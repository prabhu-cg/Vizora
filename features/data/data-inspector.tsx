"use client";

import { useId, useMemo, useState } from "react";
import { Drawer, DrawerBody, DrawerContent, DrawerHeader } from "@/components/ui/drawer";
import { cn } from "@/lib/utils/cn";
import { profileDataset } from "@/lib/data";
import type { Dataset } from "@/types/visualisation";
import { DataTable } from "./data-table";
import { ProfileView } from "./profile-view";

export interface ChartTableData {
  headers: string[];
  rows: (string | number | null)[][];
}

/**
 * Look at the data behind a chart: what is plotted, the rows it came from,
 * and a profile of each column. Read-only.
 */
export function DataInspector({ dataset, chartTable, open, onOpenChange }: { dataset?: Dataset; chartTable?: ChartTableData; open: boolean; onOpenChange: (o: boolean) => void }) {
  const id = useId();
  const tabs = [...(chartTable ? ([["chart", "Chart data"]] as const) : []), ...(dataset ? ([["rows", "Source rows"], ["profile", "Profile"]] as const) : [])];
  // Only an explicit choice is remembered; otherwise the first tab, whatever data exists when the drawer opens.
  const [tab, setTab] = useState<string>();
  const active = tab && tabs.some((t) => t[0] === tab) ? tab : tabs[0]?.[0];
  const profile = useMemo(() => (dataset && open ? profileDataset(dataset) : undefined), [dataset, open]);
  const chartRows = useMemo(() => chartTable?.rows.map((r) => Object.fromEntries(r.map((v, i) => [String(i), v]))) ?? [], [chartTable]);

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) setTab(undefined); onOpenChange(o); }}>
      <DrawerContent size="lg">
        <DrawerHeader title={dataset ? dataset.name : "Chart data"} description="Read-only. Your data is not changed here." />
        <DrawerBody className="grid content-start gap-5">
          <div role="tablist" aria-label="Data views" className="flex gap-1 border-b border-border">
            {tabs.map(([key, label]) => (
              <button key={key} role="tab" id={`${id}-${key}`} aria-selected={active === key} aria-controls={`${id}-panel`} tabIndex={active === key ? 0 : -1} onClick={() => setTab(key)}
                onKeyDown={(e) => { const i = tabs.findIndex((t) => t[0] === active); const n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : undefined; if (n !== undefined) { const t = tabs[(n + tabs.length) % tabs.length]![0]; setTab(t); requestAnimationFrame(() => document.getElementById(`${id}-${t}`)?.focus()); } }}
                className={cn("min-h-10 border-b-2 px-4 text-sm font-medium", active === key ? "border-primary text-primary-text" : "border-transparent text-muted-foreground hover:text-foreground")}>
                {label}
              </button>
            ))}
          </div>
          <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${active}`}>
            {active === "chart" && chartTable && <DataTable caption="Values as plotted" columns={chartTable.headers.map((h, i) => ({ key: String(i), label: h, numeric: i > 0 && chartTable.rows.some((r) => typeof r[i] === "number") }))} rows={chartRows} />}
            {active === "rows" && dataset && <DataTable caption={`Rows of ${dataset.name}`} columns={dataset.columns.map((c) => ({ key: c.key, label: c.label, numeric: c.type === "number" }))} rows={dataset.rows} />}
            {active === "profile" && profile && <ProfileView profile={profile} />}
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

"use client";

import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TYPE_META } from "@/components/visualisations/type-meta";
import { formatRelative } from "@/lib/utils/time";
import type { VisualisationIR } from "@/types/visualisation";

export function DetailsPanel({
  document: doc,
  onChange,
}: {
  document: VisualisationIR;
  onChange: (updater: (d: VisualisationIR) => VisualisationIR) => void;
}) {
  const id = useId();
  const rows: [string, string][] = [
    ["Nodes", String(doc.nodes.length)],
    ["Connections", String(doc.edges.length)],
    ["Datasets", String(doc.data.datasets.length)],
    ["Source", doc.source.name ?? doc.source.kind],
    ["Created", formatRelative(doc.createdAt)],
    ["Schema", `v${doc.schemaVersion}`],
  ];
  return (
    <section aria-labelledby={`${id}-h`} className="grid gap-4 p-4">
      <h3 id={`${id}-h`} className="text-[15px] font-semibold">
        Details
      </h3>
      <Badge variant="soft" className="w-fit">
        {TYPE_META[doc.type].label}
      </Badge>

      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-d`}>Description</Label>
        <Textarea
          id={`${id}-d`}
          value={doc.description}
          maxLength={2000}
          rows={4}
          onChange={(e) => onChange((d) => ({ ...d, description: e.target.value }))}
        />
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="truncate text-right font-medium" title={v}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

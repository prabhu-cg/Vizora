"use client";

import { useEffect, useState } from "react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useRequiredStorage } from "@/hooks/use-storage";
import { copyEmbedCode, downloadBlob, type Exporter } from "@/lib/export";
import { errorMessage, notify } from "@/lib/notify";
import { exportManager } from "@/services";
import type { VisualisationIR } from "@/types/visualisation";

/**
 * Export entries for one saved visualisation. They load the document when the
 * menu opens, so only the formats that genuinely apply to it are offered
 * (a dashboard can be a PDF; a flowchart cannot).
 */
export function ExportMenuItems({ visualisationId }: { visualisationId: string }) {
  const storage = useRequiredStorage();
  const [state, setState] = useState<{ doc?: VisualisationIR; exporters: Exporter[]; error?: string }>({ exporters: [] });

  useEffect(() => {
    let live = true;
    storage.visualisations.get(visualisationId).then(
      (rec) => live && setState(rec ? { doc: rec.document, exporters: exportManager.available(rec.document) } : { exporters: [], error: "Not found" }),
      (e: unknown) => live && setState({ exporters: [], error: errorMessage(e) }),
    );
    return () => {
      live = false;
    };
  }, [storage, visualisationId]);

  if (state.error) return <DropdownMenuItem disabled>Export unavailable</DropdownMenuItem>;
  if (!state.doc) return <DropdownMenuItem disabled>Loading export options…</DropdownMenuItem>;
  const doc = state.doc;
  return (
    <>
      {state.exporters.map((e) => (
        <DropdownMenuItem
          key={e.id}
          onSelect={async () => {
            try {
              const { filename, blob } = await exportManager.export(e.id, doc);
              downloadBlob(filename, blob);
              notify.success("Exported", filename);
            } catch (err) {
              notify.error("Export failed", errorMessage(err));
            }
          }}
        >
          Export as {e.label}
        </DropdownMenuItem>
      ))}
      {state.exporters.some((e) => e.id === "html-embed") && (
        <DropdownMenuItem
          onSelect={async () => {
            try {
              if (await copyEmbedCode(doc)) notify.success("Embed code copied", "Paste it into any web page. It is a static picture and will not update.");
              else notify.error("Could not copy", "Your browser blocked clipboard access. Use “Export as HTML embed page” instead.");
            } catch (err) {
              notify.error("Embed failed", errorMessage(err));
            }
          }}
        >
          Copy embed code
        </DropdownMenuItem>
      )}
    </>
  );
}

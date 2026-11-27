import type { VisualisationIR } from "@/types/visualisation";
import { slugify } from "./slug";
import type { Exporter } from "./types";

/** Lossless, editable export of the IR. Carries schemaVersion so future imports can migrate it. */
export const jsonExporter: Exporter = {
  id: "vizora-json",
  label: "Vizora JSON (editable)",
  description: "Complete, lossless copy that keeps everything editable.",
  feature: "export.json",
  run(document: VisualisationIR) {
    return {
      filename: `${slugify(document.title)}.vizora.json`,
      blob: new Blob([JSON.stringify(document, null, 2)], { type: "application/json" }),
    };
  },
};

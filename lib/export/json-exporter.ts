import type { VisualisationIR } from "@/types/visualisation";
import { slugify } from "./slug";
import type { Exporter } from "./types";

/** Lossless export of the IR. Carries schemaVersion so future imports can migrate it. */
export const jsonExporter: Exporter = {
  id: "vizora-json",
  label: "VIZORA JSON",
  description: "Complete, lossless copy of this visualisation.",
  feature: "export.json",
  run(document: VisualisationIR) {
    return {
      filename: `${slugify(document.title)}.vizora.json`,
      blob: new Blob([JSON.stringify(document, null, 2)], { type: "application/json" }),
    };
  },
};

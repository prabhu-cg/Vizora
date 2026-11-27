import type { IRLayout, IRViewport, VisualisationType } from "@/types/visualisation";

export const DEFAULT_LAYOUT: IRLayout = {
  algorithm: "manual",
  direction: "TB",
  spacing: { x: 80, y: 80 },
};

export const DEFAULT_VIEWPORT: IRViewport = { x: 0, y: 0, zoom: 1 };

/** How each type is laid out until the user says otherwise. */
export function defaultLayoutFor(type: VisualisationType): IRLayout {
  switch (type) {
    case "flowchart":
      return { algorithm: "layered", direction: "TB", spacing: { x: 70, y: 70 } };
    case "mindmap":
      return { algorithm: "tree", direction: "LR", spacing: { x: 90, y: 28 } };
    case "conceptmap":
      return { algorithm: "layered", direction: "TB", spacing: { x: 90, y: 110 } };
    case "timeline":
      return { algorithm: "linear", direction: "LR", spacing: { x: 40, y: 40 } };
    case "dashboard":
      return { algorithm: "grid", direction: "TB", spacing: { x: 16, y: 16 } };
    default:
      return { ...DEFAULT_LAYOUT, spacing: { ...DEFAULT_LAYOUT.spacing } };
  }
}

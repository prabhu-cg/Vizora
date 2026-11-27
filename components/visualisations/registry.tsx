import { isEngineType } from "@/lib/engine/semantics";
import type { VisualisationType } from "@/types/visualisation";

/** Every type that has an editor today. */
export function hasRenderer(type: VisualisationType): boolean {
  return isEngineType(type) || type === "chart" || type === "dashboard";
}

/** Types a person can create today, in the order they are offered. */
export function creatableTypes(): VisualisationType[] {
  return ["flowchart", "mindmap", "conceptmap", "timeline", "chart", "dashboard"];
}

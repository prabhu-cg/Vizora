import { BarChart3, GitBranch, Network, Table2, GanttChart, type LucideIcon } from "lucide-react";
import type { VisualisationType } from "@/types/visualisation";

export const TYPE_META: Record<VisualisationType, { label: string; description: string; icon: LucideIcon }> = {
  diagram: { label: "Diagram", description: "Nodes and connections: flows, systems, relationships.", icon: GitBranch },
  chart: { label: "Chart", description: "Bar and line charts from imported data.", icon: BarChart3 },
  table: { label: "Table", description: "Tabular view of a dataset.", icon: Table2 },
  timeline: { label: "Timeline", description: "Events over time.", icon: GanttChart },
  mindmap: { label: "Mind map", description: "Ideas branching from a centre.", icon: Network },
};

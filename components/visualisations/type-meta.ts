import { BarChart3, Users, GanttChart, GitBranch, LayoutDashboard, Network, Share2, Table2, type LucideIcon } from "lucide-react";
import type { VisualisationType } from "@/types/visualisation";

export const TYPE_META: Record<VisualisationType, { label: string; description: string; icon: LucideIcon }> = {
  flowchart: { label: "Flowchart", description: "Steps, decisions and branches in a process.", icon: GitBranch },
  mindmap: { label: "Mind map", description: "Ideas branching from a central topic.", icon: Network },
  orgchart: { label: "Org chart", description: "People and teams, with who reports to whom.", icon: Users },
  conceptmap: { label: "Concept map", description: "Concepts joined by labelled relationships.", icon: Share2 },
  timeline: { label: "Timeline", description: "Events and milestones in order over time.", icon: GanttChart },
  chart: { label: "Chart", description: "Turn a table of data into a chart, with recommendations.", icon: BarChart3 },
  dashboard: { label: "Dashboard", description: "Several charts from your data on one page.", icon: LayoutDashboard },
  table: { label: "Table", description: "Your data as a sortable, filterable table, with shaded numbers.", icon: Table2 },
};

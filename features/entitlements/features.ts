import type { PlanId } from "./plans";

/**
 * The single catalogue of gated capabilities. To add a feature: add it here
 * with its minimum plan, then check it via the entitlement service. Never
 * compare plan names anywhere else in the app.
 *
 * `released: false` marks capabilities that are reserved but not built; they
 * are denied for every plan until implemented.
 */
export const FEATURE_CATALOGUE = {
  "projects.manage": { label: "Projects", minPlan: "FREE", released: true },
  "visualisation.diagram": { label: "Diagrams", minPlan: "FREE", released: true },
  "visualisation.chart": { label: "Charts", minPlan: "FREE", released: true },
  "data.import.csv": { label: "CSV import", minPlan: "FREE", released: true },
  "data.import.json": { label: "JSON import", minPlan: "FREE", released: true },
  "export.json": { label: "JSON export", minPlan: "FREE", released: true },
  "backup.local": { label: "Local backup & restore", minPlan: "FREE", released: true },

  "sync.cloud": { label: "Cloud synchronisation", minPlan: "PRO", released: false },
  "ai.assist": { label: "AI assistance", minPlan: "PRO", released: false },
  "workspace.team": { label: "Team workspaces", minPlan: "TEAM", released: false },
} as const satisfies Record<string, { label: string; minPlan: PlanId; released: boolean }>;

export type FeatureId = keyof typeof FEATURE_CATALOGUE;

export const FEATURE_IDS = Object.keys(FEATURE_CATALOGUE) as FeatureId[];

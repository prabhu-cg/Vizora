/** Plan identifiers. Only FREE is live; PRO and TEAM are reserved. */
export const PLAN_IDS = ["FREE", "PRO", "TEAM"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const PLAN_LABELS: Record<PlanId, string> = {
  FREE: "Free",
  PRO: "Pro",
  TEAM: "Team",
};

/** Ascending capability order; a plan includes everything below it. */
export function planRank(plan: PlanId): number {
  return PLAN_IDS.indexOf(plan);
}

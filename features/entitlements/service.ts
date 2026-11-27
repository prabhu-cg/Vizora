import { FEATURE_CATALOGUE, FEATURE_IDS, type FeatureId } from "./features";
import { planRank, type PlanId } from "./plans";

/**
 * Source of the active plan. Free edition uses a constant. A later edition can
 * supply one backed by an account without changing any caller.
 */
export interface PlanProvider {
  getPlan(): PlanId;
}

export const freePlanProvider: PlanProvider = { getPlan: () => "FREE" };

export type EntitlementDecision =
  | { allowed: true }
  | { allowed: false; reason: "not-released" }
  | { allowed: false; reason: "requires-plan"; requiredPlan: PlanId };

export interface EntitlementService {
  plan(): PlanId;
  can(feature: FeatureId): boolean;
  check(feature: FeatureId): EntitlementDecision;
  /** Throws EntitlementError when denied. For service-layer enforcement. */
  assert(feature: FeatureId): void;
  featuresFor(plan?: PlanId): { id: FeatureId; label: string; allowed: boolean }[];
}

export class EntitlementError extends Error {
  override name = "EntitlementError";
  constructor(readonly feature: FeatureId, readonly decision: EntitlementDecision) {
    super(
      decision.allowed
        ? "Allowed"
        : decision.reason === "not-released"
          ? `${FEATURE_CATALOGUE[feature].label} is not available yet.`
          : `${FEATURE_CATALOGUE[feature].label} requires a higher plan.`,
    );
  }
}

export function createEntitlementService(provider: PlanProvider = freePlanProvider): EntitlementService {
  const decide = (feature: FeatureId, plan: PlanId): EntitlementDecision => {
    const def = FEATURE_CATALOGUE[feature];
    if (!def.released) return { allowed: false, reason: "not-released" };
    if (planRank(plan) < planRank(def.minPlan)) {
      return { allowed: false, reason: "requires-plan", requiredPlan: def.minPlan };
    }
    return { allowed: true };
  };

  return {
    plan: () => provider.getPlan(),
    check: (feature) => decide(feature, provider.getPlan()),
    can: (feature) => decide(feature, provider.getPlan()).allowed,
    assert(feature) {
      const decision = decide(feature, provider.getPlan());
      if (!decision.allowed) throw new EntitlementError(feature, decision);
    },
    featuresFor: (plan = provider.getPlan()) =>
      FEATURE_IDS.map((id) => ({
        id,
        label: FEATURE_CATALOGUE[id].label,
        allowed: decide(id, plan).allowed,
      })),
  };
}

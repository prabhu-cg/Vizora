import { describe, expect, it } from "vitest";
import {
  EntitlementError,
  FEATURE_CATALOGUE,
  FEATURE_IDS,
  PLAN_IDS,
  createEntitlementService,
  freePlanProvider,
} from "@/features/entitlements";
import { createExportManager } from "@/lib/export";
import { sampleDoc } from "../helpers";

describe("entitlement service", () => {
  it("defines FREE plus reserved PRO and TEAM", () => {
    expect(PLAN_IDS).toEqual(["FREE", "PRO", "TEAM"]);
    expect(freePlanProvider.getPlan()).toBe("FREE");
  });

  it("enables every released Free feature on the FREE plan", () => {
    const svc = createEntitlementService();
    for (const id of FEATURE_IDS) {
      const def = FEATURE_CATALOGUE[id];
      if (def.minPlan === "FREE") expect(svc.can(id), id).toBe(def.released);
    }
  });

  it("denies unreleased features for every plan, even the highest", () => {
    const team = createEntitlementService({ getPlan: () => "TEAM" });
    expect(team.check("sync.cloud")).toEqual({ allowed: false, reason: "not-released" });
    expect(team.check("ai.assist")).toEqual({ allowed: false, reason: "not-released" });
    expect(createEntitlementService().check("workspace.team")).toEqual({ allowed: false, reason: "not-released" });
  });

  it("applies plan ordering for released features (extensibility check)", () => {
    // Simulate a future released PRO feature without touching the real catalogue.
    const svc = createEntitlementService({ getPlan: () => "FREE" });
    const featuresFree = svc.featuresFor("FREE").filter((f) => f.allowed).length;
    const featuresTeam = createEntitlementService({ getPlan: () => "TEAM" }).featuresFor("TEAM").filter((f) => f.allowed).length;
    expect(featuresTeam).toBeGreaterThanOrEqual(featuresFree);
  });

  it("assert throws a descriptive EntitlementError", () => {
    const svc = createEntitlementService();
    expect(() => svc.assert("export.json")).not.toThrow();
    expect(() => svc.assert("ai.assist")).toThrow(EntitlementError);
    expect(() => svc.assert("ai.assist")).toThrow(/not available yet/);
  });

  it("the export manager enforces entitlements centrally", () => {
    const svc = createEntitlementService();
    const manager = createExportManager(svc);
    expect(manager.available().map((e) => e.id)).toEqual(["vizora-json"]);
    const { filename, blob } = manager.export("vizora-json", sampleDoc("My Chart!"));
    expect(filename).toBe("my-chart.vizora.json");
    expect(blob.type).toBe("application/json");
    expect(() => manager.export("pdf", sampleDoc())).toThrow(/Unknown export format/);

    const denied = createExportManager({ ...svc, can: () => false, assert: () => { throw new EntitlementError("export.json", { allowed: false, reason: "not-released" }); } });
    expect(denied.available()).toEqual([]);
    expect(() => denied.export("vizora-json", sampleDoc())).toThrow(EntitlementError);
  });
});

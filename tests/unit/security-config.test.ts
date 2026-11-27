import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "@/lib/security/csp";

describe("content security policy", () => {
  const directives = Object.fromEntries(contentSecurityPolicy.split("; ").map((d) => [d.split(" ")[0], d.split(" ").slice(1)]));
  it("allows no other origin for connections, scripts, frames or plugins", () => {
    expect(directives["connect-src"]).toEqual(["'self'"]);
    expect(directives["script-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    expect(directives["script-src"]).not.toContain("'unsafe-eval'");
    expect(directives["object-src"]).toEqual(["'none'"]);
    expect(directives["frame-ancestors"]).toEqual(["'none'"]);
    expect(directives["base-uri"]).toEqual(["'self'"]);
    expect(directives["form-action"]).toEqual(["'self'"]);
  });
  it("still allows what exports need: blob and data images, and workers", () => {
    expect(directives["img-src"]).toEqual(expect.arrayContaining(["blob:", "data:"]));
    expect(directives["worker-src"]).toContain("blob:");
  });
  it("names no external host anywhere", () => {
    expect(contentSecurityPolicy).not.toMatch(/https?:|\*\./);
  });
});

describe("app code makes no network requests", () => {
  it("has no fetch, XHR, beacon, socket or analytics in application code", async () => {
    const { execSync } = await import("node:child_process");
    const out = execSync(`grep -rEn "fetch\\(|XMLHttpRequest|sendBeacon|new WebSocket|EventSource\\(" app components features lib hooks services || true`, { cwd: process.cwd(), encoding: "utf8" });
    expect(out.trim()).toBe("");
  });
});

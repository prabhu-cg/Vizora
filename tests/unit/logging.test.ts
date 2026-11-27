import { afterEach, describe, expect, it, vi } from "vitest";
import { clearRecentErrors, errorReportText, recentErrors, reportError } from "@/lib/logging";

afterEach(() => { clearRecentErrors(); vi.restoreAllMocks(); });

describe("error logging", () => {
  it("logs one structured console line and keeps the error in memory only", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    reportError(new Error("boom"), "test", { digest: "d1" });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![0]).toMatch(/^\[vizora\] test: Error: boom/);
    expect(recentErrors()[0]).toMatchObject({ where: "test", message: "boom", digest: "d1" });
    expect(localStorage.length).toBe(0); // nothing persisted
  });
  it("accepts non-Error values, caps what it keeps, and produces report text", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (let i = 0; i < 30; i++) reportError(`oops ${i}`, "loop");
    expect(recentErrors()).toHaveLength(20);
    expect(recentErrors()[0]!.message).toBe("oops 29");
    reportError({ weird: true }, "obj");
    expect(errorReportText()).toMatch(/obj Error: Unknown error/);
  });
  it("truncates very long messages", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(reportError(new Error("x".repeat(5000)), "long").message.length).toBeLessThan(600);
  });
});

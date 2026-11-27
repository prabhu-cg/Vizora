import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { APP_HREF, MARKETING_ROUTES, NAV } from "@/lib/marketing/routes";
import { getContactEmail, getSiteUrl } from "@/lib/site";

const pageFile = (path: string) => resolve(process.cwd(), "app/(marketing)", path === "/" ? "" : path.slice(1), "page.tsx");

describe("site URL configuration", () => {
  it("prefers NEXT_PUBLIC_SITE_URL, then Vercel, then localhost; never a hardcoded domain", () => {
    expect(getSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://example.test", VERCEL_URL: "x.vercel.app" }).origin).toBe("https://example.test");
    expect(getSiteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "prod.example.test" }).origin).toBe("https://prod.example.test");
    expect(getSiteUrl({ VERCEL_URL: "preview.vercel.app" }).origin).toBe("https://preview.vercel.app");
    expect(getSiteUrl({}).origin).toBe("http://localhost:3000");
  });
  it("contact email is only returned when configured", () => {
    expect(getContactEmail({})).toBeUndefined();
    expect(getContactEmail({ NEXT_PUBLIC_CONTACT_EMAIL: " hi@example.test " })).toBe("hi@example.test");
  });
});

describe("routes, sitemap and robots", () => {
  it("every registered marketing route has a page", () => {
    for (const r of Object.values(MARKETING_ROUTES)) expect(existsSync(pageFile(r.path)), r.path).toBe(true);
  });
  it("the required pages exist", () => {
    const paths = Object.values(MARKETING_ROUTES).map((r) => r.path);
    for (const p of ["/", "/features", "/how-it-works", "/use-cases", "/pricing", "/about", "/faq", "/privacy", "/terms"]) expect(paths).toContain(p);
  });
  it("navigation only points at registered routes", () => {
    const known = new Set(Object.values(MARKETING_ROUTES).map((r) => r.path));
    for (const r of [...NAV.product.items, ...NAV.primary, ...NAV.resources.items]) expect(known.has(r.path), r.path).toBe(true);
  });
  it("the Start free target is the working dashboard", () => {
    expect(APP_HREF).toBe("/app/dashboard");
    expect(existsSync(resolve(process.cwd(), "app/app/(shell)/dashboard/page.tsx"))).toBe(true);
  });
  it("sitemap lists every marketing page and nothing from the app", () => {
    const urls = sitemap().map((s) => new URL(s.url).pathname);
    expect(urls.sort()).toEqual(Object.values(MARKETING_ROUTES).map((r) => r.path).sort());
    expect(urls.some((u) => u.startsWith("/app"))).toBe(false);
  });
  it("robots blocks the app and API and points at the sitemap", () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0]! : r.rules;
    expect(rule.disallow).toEqual(["/app/", "/api/"]);
    expect(r.sitemap).toMatch(/\/sitemap\.xml$/);
  });
});

describe("page metadata", () => {
  const all = import.meta.glob("../../app/**/page.tsx");
  const modules = Object.fromEntries(Object.entries(all).filter(([f]) => f.includes("(marketing)")));
  it("every marketing page has a title, a sensible description, a canonical path and social cards", async () => {
    expect(Object.keys(modules).length).toBe(Object.keys(MARKETING_ROUTES).length);
    for (const [file, load] of Object.entries(modules)) {
      const mod = (await load()) as { metadata: import("next").Metadata };
      const m = mod.metadata;
      expect(m.title, file).toBeTruthy();
      expect(m.description?.length ?? 0, file).toBeGreaterThan(50);
      expect(m.description!.length, file).toBeLessThanOrEqual(160);
      expect(typeof m.alternates?.canonical, file).toBe("string");
      expect(m.openGraph, file).toBeTruthy();
      expect((m.twitter as { card?: string }).card, file).toBe("summary_large_image");
    }
  });
});

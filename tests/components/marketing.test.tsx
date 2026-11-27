import { render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import AboutPage from "@/app/(marketing)/about/page";
import FaqPage from "@/app/(marketing)/faq/page";
import FeaturesPage from "@/app/(marketing)/features/page";
import HomePage from "@/app/(marketing)/page";
import HowItWorksPage from "@/app/(marketing)/how-it-works/page";
import PricingPage from "@/app/(marketing)/pricing/page";
import PrivacyPage from "@/app/(marketing)/privacy/page";
import TermsPage from "@/app/(marketing)/terms/page";
import UseCasesPage from "@/app/(marketing)/use-cases/page";
import { MarketingFooter, MarketingHeader } from "@/components/layout/marketing-header";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { AVAILABILITY_LABEL, CAPABILITIES, FAQS, PLANS, USE_CASES, WORKSPACE_FEATURES } from "@/lib/marketing/content";
import { APP_HREF, MARKETING_ROUTES } from "@/lib/marketing/routes";

vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }) }));

const PAGES: [string, () => ReactElement][] = [
  ["home", () => <HomePage />],
  ["features", () => <FeaturesPage />],
  ["how-it-works", () => <HowItWorksPage />],
  ["use-cases", () => <UseCasesPage />],
  ["pricing", () => <PricingPage />],
  ["about", () => <AboutPage />],
  ["faq", () => <FaqPage />],
  ["privacy", () => <PrivacyPage />],
  ["terms", () => <TermsPage />],
];

const knownPaths = new Set<string>([...Object.values(MARKETING_ROUTES).map((r) => r.path), APP_HREF]);

describe("every marketing page", () => {
  it.each(PAGES)("%s renders one h1 and only working links", (_name, page) => {
    const { container } = render(page());
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const ids = new Set([...container.querySelectorAll("[id]")].map((e) => e.id));
    for (const a of container.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href")!;
      expect(href, `empty/placeholder link "${a.textContent}"`).not.toBe("#");
      if (href.startsWith("#")) expect(ids.has(href.slice(1)), `missing anchor ${href}`).toBe(true);
      else if (href.startsWith("/")) expect(knownPaths.has(href.split("#")[0]!), `unknown route ${href}`).toBe(true);
      else if (href.startsWith("mailto:")) continue;
      else throw new Error(`external or malformed link ${href}`);
    }
  });

  it.each(PAGES)("%s has no unlabeled images, buttons or illustrations", (_name, page) => {
    const { container } = render(page());
    for (const svg of container.querySelectorAll("svg[role=img]")) expect(svg.getAttribute("aria-label")).toBeTruthy();
    for (const b of container.querySelectorAll("button")) expect((b.textContent ?? "") + (b.getAttribute("aria-label") ?? "")).not.toBe("");
  });
});

describe("header and footer", () => {
  it("expose the requested navigation and a working Start free CTA", () => {
    render(<MarketingHeader />);
    const main = screen.getByRole("navigation", { name: "Main" });
    for (const label of ["Product", "Features", "Use cases", "Pricing", "Resources"]) expect(within(main).getByText(label)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Start free" }).every((a) => a.getAttribute("href") === APP_HREF)).toBe(true);
  });
  it("Sign in is a notice, not a fake link or button", () => {
    render(<MarketingHeader />);
    expect(screen.queryByRole("link", { name: /sign in/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /sign in/i })).toBeNull();
    expect(screen.getAllByText(/sign in/i).length).toBeGreaterThan(0);
  });
  it("footer links to every required page including legal", () => {
    render(<MarketingFooter />);
    for (const name of ["Features", "How it works", "Use cases", "Pricing", "About", "FAQ", "Privacy policy", "Terms of service"]) {
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    }
  });
});

describe("homepage content", () => {
  it("uses the specified headline, CTAs and sections", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Turn anything into a visual.");
    expect(screen.getAllByRole("link", { name: /Start visualising — Free/ })[0]).toHaveAttribute("href", APP_HREF);
    expect(screen.getByRole("link", { name: "See how it works" })).toHaveAttribute("href", "/how-it-works");
    for (const h of ["One platform. Endless possibilities.", "How Vizora works", "What can you visualise?", "Built for different ways of thinking", "Free to get started", "Pricing preview", "Make your ideas visible."]) {
      expect(screen.getByRole("heading", { name: h })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Start visualising for free" })).toHaveAttribute("href", APP_HREF);
  });
  it("labels the hero as an illustration, not a screenshot", () => {
    render(<HomePage />);
    expect(screen.getByText(/Illustration, not a screenshot/)).toBeInTheDocument();
  });
});

describe("pricing honesty", () => {
  it("only Free is purchasable-looking; Pro and Team are 'Coming soon' with no buttons or links", () => {
    render(<PricingCards />);
    expect(screen.getAllByText("Coming soon")).toHaveLength(2);
    expect(screen.getByText("Available now")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByRole("link")).toHaveAttribute("href", APP_HREF);
    expect(screen.queryByRole("button")).toBeNull();
    // No purchase-style controls anywhere (the "nothing to subscribe to" note is plain text, not a control).
    expect(screen.queryByRole("link", { name: /subscribe|buy|checkout|upgrade|get pro|get team|waitlist/i })).toBeNull();
  });
  it("shows the specified prices, marking paid ones indicative", () => {
    expect(PLANS.map((p) => [p.id, p.price, p.available])).toEqual([["FREE", "£0", true], ["PRO", "£9", false], ["TEAM", "£19", false]]);
    render(<PricingCards />);
    expect(screen.getByText("per month, indicative")).toBeInTheDocument();
    expect(screen.getByText("per user per month, indicative")).toBeInTheDocument();
    expect(screen.getByText("forever")).toBeInTheDocument();
  });
  it("Free lists only what works today", () => {
    expect(PLANS[0]!.items.every((i) => i.status === "available")).toBe(true);
    expect(PLANS[0]!.items.map((i) => i.text).join(" ")).toMatch(/Mind maps.*Concept maps.*Timelines/);
  });
  it("every Pro and Team item is planned", () => {
    for (const p of PLANS.filter((p) => p.id !== "FREE")) expect(p.items.every((i) => i.status === "planned")).toBe(true);
  });
});

describe("no misleading claims", () => {
  it("exactly what is built is marked available", () => {
    const available = [...CAPABILITIES, ...WORKSPACE_FEATURES].filter((c) => c.status === "available").map((c) => c.id).sort();
    expect(available).toEqual(["charts", "conceptmaps", "dashboards", "diagrams", "editing", "exporting", "generation", "mindmaps", "projects", "timelines"]);
  });
  it("never claims AI: generation is described as rule-based and AI stays under 'not built'", () => {
    const gen = WORKSPACE_FEATURES.find((c) => c.id === "generation")!;
    expect(gen.today.join(" ")).not.toMatch(/\bAI\b/);
    expect(gen.today.join(" ")).toMatch(/never invents/);
    expect(gen.next.join(" ")).toMatch(/AI-assisted.*planned for Pro; not built/);
  });
  it("things that do not exist are not claimed as working", () => {
    const claimed = [...CAPABILITIES, ...WORKSPACE_FEATURES].flatMap((c) => c.today).join("\n");
    expect(claimed).not.toMatch(/\bAI\b|\.xls\b|combination chart|dashboard-wide|live data|real-time|cloud/i);
    // PDF is only claimed for dashboards, which is the only place it exists.
    for (const line of claimed.split("\n").filter((l) => /PDF/.test(l))) expect(line).toMatch(/dashboard/i);
  });
  it("what is still missing is listed as 'not built'", () => {
    const next = CAPABILITIES.find((c) => c.id === "charts")!.next.join(" ");
    expect(next).toMatch(/bars and lines/);
    expect(next).toMatch(/\.xls/);
    expect(CAPABILITIES.find((c) => c.id === "dashboards")!.next.join(" ")).toMatch(/Dashboard-wide filters/);
  });
  it("every capability and use case separates what works today from what is not built", () => {
    for (const c of [...CAPABILITIES, ...WORKSPACE_FEATURES]) expect(AVAILABILITY_LABEL[c.status]).toBeTruthy();
    for (const u of USE_CASES) {
      expect(u.today.length).toBeGreaterThan(0);
      expect(u.next.length).toBeGreaterThan(0);
    }
  });
  it("contains no fake testimonials or customer logos", () => {
    for (const [, page] of PAGES) {
      const { container, unmount } = render(page());
      expect(container.textContent).not.toMatch(/trusted by|testimonial|loved by|customers say|“[^”]{40,}” —/i);
      unmount();
    }
  });
});

describe("features page", () => {
  it("covers every requested topic", () => {
    render(<FeaturesPage />);
    for (const t of ["Diagram generation", "Mind maps", "Concept maps", "Timelines", "Data visualisation", "Dashboard creation", "Editing and customisation", "Exporting"]) {
      expect(screen.getByRole("heading", { level: 2, name: t })).toBeInTheDocument();
    }
  });
});

describe("FAQ", () => {
  it("answers every required question and publishes valid FAQPage JSON-LD", () => {
    const { container } = render(<FaqPage />);
    for (const q of [
      "What is Vizora?", "Is Vizora free?", "Do I need an AI subscription?", "What can I visualise?", "Can I edit generated diagrams?", "Can I upload data?",
      "Where are my projects stored?", "Can I export my visualisations?", "Is my data sent to external services?", "Will Vizora support AI?",
      "What is included in Pro?", "Is Vizora suitable for business use?",
    ]) expect(FAQS.some((f) => f.q === q), q).toBe(true);
    const ld = JSON.parse(container.querySelector('script[type="application/ld+json"]')!.textContent!);
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity).toHaveLength(FAQS.length);
  });
});

describe("structured data", () => {
  it("home and pricing publish only the Free offer", () => {
    for (const page of [<HomePage key="h" />, <PricingPage key="p" />]) {
      const { container, unmount } = render(page);
      const text = container.querySelector('script[type="application/ld+json"]')!.textContent!;
      JSON.parse(text);
      expect(text).toContain('"price":"0"');
      expect(text).not.toMatch(/"price":"(9|19)"/);
      unmount();
    }
  });
});

describe("legal pages", () => {
  it("state accurately that nothing is uploaded and no analytics are used", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/not uploaded to Vizora/)).toBeInTheDocument();
    expect(screen.getByText(/does not currently use analytics/)).toBeInTheDocument();
    expect(screen.queryByText(/mailto/)).toBeNull();
  });
});

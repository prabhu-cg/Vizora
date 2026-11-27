import { BarChart3, Briefcase, Check, Code2, Compass, GraduationCap, Palette } from "lucide-react";
import Link from "next/link";
import { Visual, WorkspaceIllustration } from "@/components/marketing/illustrations";
import { JsonLd } from "@/components/marketing/json-ld";
import { exploreCapabilities, SecondaryCta, seeHowItWorks, StartFreeButton } from "@/components/marketing/cta";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { Band, SectionHeading, StatusBadge } from "@/components/marketing/section";
import { StepVisual } from "@/components/marketing/step-visuals";
import { Badge } from "@/components/ui/badge";
import { AUDIENCES, CAPABILITIES, EXAMPLES, FREE_PROMISES, STEPS } from "@/lib/marketing/content";
import { MARKETING_ROUTES } from "@/lib/marketing/routes";
import { pageMetadata } from "@/lib/marketing/seo";
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const metadata = pageMetadata({
  absoluteTitle: "Vizora — Turn anything into a visual",
  description: "Transform ideas, information, data and complex content into visuals you can understand, explore and edit. Free, local-first, no account needed.",
  path: "/",
});

const AUDIENCE_ICONS = [Palette, BarChart3, Compass, Code2, Briefcase, GraduationCap];

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
            { "@type": "WebSite", name: SITE_NAME, url: absoluteUrl("/"), description: SITE_DESCRIPTION },
            {
              "@type": "SoftwareApplication",
              name: SITE_NAME,
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web browser",
              description: SITE_DESCRIPTION,
              url: absoluteUrl("/"),
              offers: { "@type": "Offer", price: "0", priceCurrency: "GBP", description: "Free edition" },
            },
          ],
        }}
      />

      {/* Hero */}
      <header className="bg-surface">
        <div className="mx-auto grid max-w-[var(--container-marketing)] items-center gap-12 px-4 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <Badge variant="soft" className="mb-6 gap-2">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
              Free edition · Local-first
            </Badge>
            <h1 className="text-5xl leading-none sm:text-7xl">
              Turn <span className="text-primary-text">anything</span> into a visual.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted-foreground">
              From ideas and information to data and complex processes, Vizora helps you transform the things you know into visuals you can understand,
              explore and edit.
            </p>
            <p className="mt-3 max-w-xl text-muted-foreground">One workspace. Endless ways to visualise.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <StartFreeButton />
              <SecondaryCta {...seeHowItWorks} />
            </div>
          </div>
          <WorkspaceIllustration />
        </div>
      </header>

      {/* One platform */}
      <Band id="platform">
        <SectionHeading
          id="platform"
          title="One platform. Endless possibilities."
          lead="Vizora is a universal visualisation platform, not a single-purpose chart maker. Here is every kind of visual it is built around, and where each one stands today."
        />
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c) => (
            <li key={c.id} className="flex flex-col rounded-card border border-border bg-card p-5">
              <Visual kind={c.visual!} />
              <div className="mt-4 flex items-center justify-between gap-3">
                <h3 className="text-[15px] font-semibold">{c.title}</h3>
                <StatusBadge status={c.status} />
              </div>
              <p className="mt-1.5 text-body">{c.summary}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8">
          <Link href={exploreCapabilities.href} className="font-semibold text-primary-text underline underline-offset-4 hover:no-underline">
            See what each one can do
          </Link>
        </p>
      </Band>

      {/* How it works */}
      <Band id="how" tone="desk">
        <SectionHeading id="how" title="How Vizora works" lead="Three steps from information to something you can see." />
        <ol className="grid gap-8 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <StepVisual step={(i + 1) as 1 | 2 | 3} />
              <p className="mt-5 flex items-center gap-3">
                <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <span className="font-display text-2xl font-medium text-foreground">{s.title}</span>
              </p>
              <p className="mt-2 text-body">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-10">
          <Link href={MARKETING_ROUTES.howItWorks.path} className="font-semibold text-primary-text underline underline-offset-4 hover:no-underline">
            The full workflow, step by step
          </Link>
        </p>
      </Band>

      {/* What can you visualise */}
      <Band id="examples">
        <SectionHeading id="examples" title="What can you visualise?" lead="Practical starting points. Where a visual type is still planned, the card says so." />
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {EXAMPLES.map((e) => (
            <li key={e.title} className="rounded-card border border-border bg-card p-5">
              <Visual kind={e.visual} className="mb-4" />
              <h3 className="text-[15px] font-semibold">{e.title}</h3>
              <p className="mt-1 text-body">{e.body}</p>
            </li>
          ))}
        </ul>
      </Band>

      {/* Audiences */}
      <Band id="audiences" tone="desk">
        <SectionHeading id="audiences" title="Built for different ways of thinking" />
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {AUDIENCES.map((a, i) => {
            const Icon = AUDIENCE_ICONS[i]!;
            return (
              <li key={a.title} className="rounded-card border border-border bg-card p-5">
                <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary-text">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="text-[15px] font-semibold">{a.title}</h3>
                <p className="mt-1 text-body">{a.body}</p>
              </li>
            );
          })}
        </ul>
      </Band>

      {/* Free */}
      <Band id="free">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          <SectionHeading id="free" title="Free to get started" lead="No subscription, no sign-up and no AI service. Open it and start." className="mb-0" />
          <ul className="grid gap-4">
            {FREE_PROMISES.map((p) => (
              <li key={p.title} className="flex gap-3 rounded-card border border-border bg-card p-4">
                <Check className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
                <div>
                  <h3 className="text-[15px] font-semibold">{p.title}</h3>
                  <p className="text-body">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Band>

      {/* Pricing preview */}
      <Band id="pricing-preview" tone="desk">
        <SectionHeading
          id="pricing-preview"
          title="Pricing preview"
          lead="Only Free is available today. Pro and Team are planned, their prices are indicative, and there is nothing to buy yet."
        />
        <PricingCards />
        <p className="mt-6">
          <Link href={MARKETING_ROUTES.pricing.path} className="font-semibold text-primary-text underline underline-offset-4 hover:no-underline">
            Compare plans
          </Link>
        </p>
      </Band>

      {/* Final CTA */}
      <Band id="final">
        <div className="text-center">
          <h2 id="final-heading" className="text-4xl sm:text-5xl">
            Make your ideas visible.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">Create a project and start. Your work is saved as you go, on your device.</p>
          <div className="mt-8 flex justify-center">
            <StartFreeButton label="Start visualising for free" />
          </div>
        </div>
      </Band>
    </>
  );
}

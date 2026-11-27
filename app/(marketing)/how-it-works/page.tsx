import { ArrowRight, HardDrive, Globe, FileDown } from "lucide-react";
import { exploreCapabilities, SecondaryCta, StartFreeButton } from "@/components/marketing/cta";
import { Band, CheckList, PageHero, SectionHeading, StatusBadge } from "@/components/marketing/section";
import { StepVisual } from "@/components/marketing/step-visuals";
import { STEPS } from "@/lib/marketing/content";
import { MARKETING_ROUTES } from "@/lib/marketing/routes";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata = pageMetadata({
  title: "How it works",
  description: "From input to visual: import data or start blank, choose a diagram or chart, then edit and export. See what runs today and what AI features are planned.",
  path: MARKETING_ROUTES.howItWorks.path,
});

const EXPORT_EXAMPLE = `{
  "id": "…",
  "schemaVersion": 1,
  "title": "Quarterly review",
  "type": "chart",
  "source": { "kind": "csv", "name": "sales-2026.csv" },
  "nodes": [],
  "edges": [],
  "data": { "datasets": [ { "name": "sales-2026", "columns": […], "rows": […] } ] },
  "layout": { … },
  "viewport": { … },
  "createdAt": "…",
  "updatedAt": "…"
}`;

const CSV_EXAMPLE = `Month,Revenue,Costs
Jan,120,80
Feb,150,90
Mar,170,95`;

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        title="From input to visual in three steps."
        lead="Vizora keeps your information separate from how it is drawn, so you can edit a visualisation, save it and take it with you."
      >
        <StartFreeButton />
        <SecondaryCta {...exploreCapabilities} />
      </PageHero>

      <Band id="steps">
        <SectionHeading id="steps" title="The workflow" />
        <ol className="grid gap-12">
          {STEPS.map((s, i) => (
            <li key={s.title} className="grid items-center gap-8 md:grid-cols-2">
              <div className={i % 2 === 1 ? "md:order-2" : undefined}>
                <p className="flex items-center gap-3">
                  <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  <span className="font-display text-3xl font-medium text-foreground">{s.title}</span>
                </p>
                <p className="mt-3 text-lg text-body">{s.body}</p>
                {i === 0 && <p className="mt-3 text-sm text-muted-foreground">Supported today: CSV and JSON files up to 25 MB.</p>}
                {i === 1 && <p className="mt-3 text-sm text-muted-foreground">Today: diagrams and bar or line charts. Mind maps, concept maps, timelines and dashboards are planned.</p>}
                {i === 2 && <p className="mt-3 text-sm text-muted-foreground">Changes are saved automatically. Export a JSON file or a full backup at any time.</p>}
              </div>
              <div className={i % 2 === 1 ? "md:order-1" : undefined}>
                <StepVisual step={(i + 1) as 1 | 2 | 3} />
                <p className="mt-2 text-sm text-muted-foreground">Illustration of the interface, not a screenshot.</p>
              </div>
            </li>
          ))}
        </ol>
      </Band>

      <Band id="local" tone="desk">
        <SectionHeading
          id="local"
          title="Where your information goes"
          lead="Nothing is uploaded. Files are read by your browser and projects are saved on your device."
        />
        <ol className="grid items-stretch gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr]" aria-label="Data flow">
          {[
            { icon: Globe, title: "Your file", body: "You choose a CSV or JSON file in the browser." },
            { icon: HardDrive, title: "Your device", body: "Vizora reads it locally and saves the project in IndexedDB, in your browser." },
            { icon: FileDown, title: "Your export", body: "You download JSON or a backup whenever you like." },
          ].flatMap((n, i, arr) => [
            <li key={n.title} className="rounded-card border border-border bg-card p-5">
              <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-primary-soft text-primary-text">
                <n.icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="text-[15px] font-semibold">{n.title}</h3>
              <p className="mt-1 text-body">{n.body}</p>
            </li>,
            i < arr.length - 1 ? (
              <li key={`a${i}`} aria-hidden="true" className="hidden items-center justify-center text-muted-foreground md:flex">
                <ArrowRight className="size-5" />
              </li>
            ) : null,
          ])}
        </ol>
      </Band>

      <Band id="example">
        <SectionHeading id="example" title="An example, end to end" lead="A small CSV in, a chart out, and a file you can keep." />
        <div className="grid gap-6 lg:grid-cols-2">
          <figure>
            <figcaption className="mb-2 text-sm font-semibold text-foreground">1. A CSV you import</figcaption>
            <pre className="overflow-x-auto rounded-card border border-border bg-surface p-4 font-mono text-sm text-body" tabIndex={0}>
              <code>{CSV_EXAMPLE}</code>
            </pre>
            <p className="mt-2 text-sm text-muted-foreground">Month is detected as text; Revenue and Costs as numbers, so a bar or line chart with two series is offered.</p>
          </figure>
          <figure>
            <figcaption className="mb-2 text-sm font-semibold text-foreground">2. The file you can export (abbreviated)</figcaption>
            <pre className="overflow-x-auto rounded-card border border-border bg-surface p-4 font-mono text-sm text-body" tabIndex={0}>
              <code>{EXPORT_EXAMPLE}</code>
            </pre>
            <p className="mt-2 text-sm text-muted-foreground">It stores your information and layout, not a picture, so it stays editable and future versions can still open it.</p>
          </figure>
        </div>
      </Band>

      <Band id="rules-and-ai" tone="desk">
        <SectionHeading
          id="rules-and-ai"
          title="Rule-based today, AI-assisted later"
          lead="Everything in the Free edition works without AI. AI-assisted features are planned for Pro and are not available yet."
        />
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-card border border-border bg-card p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-display text-2xl font-medium">Rule-based, no AI</h3>
              <StatusBadge status="available" />
            </div>
            <CheckList
              items={[
                "You build diagrams yourself on the canvas",
                "Imported tables are parsed by fixed rules (types, headers, delimiters)",
                "Charts are built directly from your columns",
                "Nothing leaves your browser",
              ]}
            />
          </div>
          <div className="rounded-card border border-border bg-card p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-display text-2xl font-medium">AI-assisted</h3>
              <StatusBadge status="planned" />
            </div>
            <CheckList
              tone="next"
              items={[
                "Describe a process in plain language and get a diagram",
                "Pull structure out of documents",
                "Suggest the best visual for your data",
                "Planned for Pro; not built, and the Free edition will not depend on it",
              ]}
            />
          </div>
        </div>
      </Band>
    </>
  );
}

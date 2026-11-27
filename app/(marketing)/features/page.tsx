import { Visual } from "@/components/marketing/illustrations";
import { SecondaryCta, StartFreeButton } from "@/components/marketing/cta";
import { Band, CheckList, PageHero, StatusBadge } from "@/components/marketing/section";
import { CAPABILITIES, WORKSPACE_FEATURES, type Capability } from "@/lib/marketing/content";
import { MARKETING_ROUTES } from "@/lib/marketing/routes";
import { pageMetadata } from "@/lib/marketing/seo";
import { cn } from "@/lib/utils/cn";

export const metadata = pageMetadata({
  title: "Features",
  description: "What Vizora does today: diagrams, 13 chart types, dashboards, data import, projects with backup, and PNG, SVG, PDF, JSON and embed export. AI is planned.",
  path: MARKETING_ROUTES.features.path,
});

const byId = (list: Capability[], id: string) => list.find((c) => c.id === id)!;

// Order follows the product story: generate, draw, map, plan, chart, combine, refine, organise, export.
const SECTIONS: { cap: Capability; heading?: string }[] = [
  { cap: byId(WORKSPACE_FEATURES, "generation") },
  { cap: byId(CAPABILITIES, "diagrams") },
  { cap: byId(CAPABILITIES, "mindmaps") },
  { cap: byId(CAPABILITIES, "conceptmaps") },
  { cap: byId(CAPABILITIES, "timelines") },
  { cap: byId(CAPABILITIES, "charts") },
  { cap: byId(CAPABILITIES, "dashboards"), heading: "Dashboard creation" },
  { cap: byId(WORKSPACE_FEATURES, "editing") },
  { cap: byId(WORKSPACE_FEATURES, "projects") },
  { cap: byId(WORKSPACE_FEATURES, "exporting") },
];


export default function FeaturesPage() {
  return (
    <>
      <PageHero
        title="What Vizora can do, honestly."
        lead="Every capability below is labelled with where it really stands: available now, in development or planned. What you read as available works in the app today."
      >
        <StartFreeButton />
        <SecondaryCta href={MARKETING_ROUTES.howItWorks.path} label="See how it works" />
      </PageHero>

      <div id="capabilities" />
      {SECTIONS.map(({ cap, heading }, i) => {
        const id = cap.id;
        const flip = i % 2 === 1;
        return (
          <Band key={id} id={id} tone={i % 2 === 0 ? "paper" : "desk"}>
            <div className="grid items-start gap-10 lg:grid-cols-2">
              <div className={cn(flip && "lg:order-2")}>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 id={`${id}-heading`} className="text-3xl sm:text-4xl">
                    {heading ?? cap.title}
                  </h2>
                  <StatusBadge status={cap.status} />
                </div>
                <p className="mt-4 text-lg text-muted-foreground">{cap.summary}</p>

                {cap.today.length > 0 && (
                  <>
                    <h3 className="mt-6 mb-2 text-sm font-semibold">{cap.status === "available" ? "Works today" : "What exists today"}</h3>
                    <CheckList items={cap.today} />
                  </>
                )}
                {cap.next.length > 0 && (
                  <>
                    <h3 className="mt-6 mb-2 text-sm font-semibold">Not built yet</h3>
                    <CheckList items={cap.next} tone="next" />
                  </>
                )}
              </div>
              <div className={cn(flip && "lg:order-1")}>
                {cap.visual ? (
                  <figure>
                    <Visual kind={cap.visual} />
                    <figcaption className="mt-2 text-sm text-muted-foreground">Illustration of the idea, not a screenshot.</figcaption>
                  </figure>
                ) : (
                  <EditingPanel id={id} />
                )}
              </div>
            </div>
          </Band>
        );
      })}

      <Band id="try" tone="desk">
        <div className="text-center">
          <h2 id="try-heading" className="text-4xl sm:text-5xl">
            Try what works today
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">It is free and opens straight into your workspace.</p>
          <div className="mt-8 flex justify-center">
            <StartFreeButton />
          </div>
        </div>
      </Band>
    </>
  );
}

function EditingPanel({ id }: { id: string }) {
  const rows =
    id === "editing"
      ? [
          ["Undo and redo", "Step back and forward through your edits."],
          ["Keyboard and Inspector", "Everything the pointer can do, you can do without it."],
          ["Safe in two tabs", "Vizora asks which version to keep rather than overwriting."],
        ]
      : [
          ["PNG, SVG and PDF", "Images (and a dashboard PDF) that keep your colours, shapes and labels."],
          ["CSV", "The data behind a chart, or the dataset itself."],
          ["Vizora JSON", "A lossless, editable copy of one visualisation."],
          ["Full backup", "All projects in one file, restorable without overwriting."],
        ];
  return (
    <ul className="grid gap-3 rounded-card border border-border bg-surface p-4" aria-label={id === "editing" ? "Editing highlights" : "Export options"}>
      {rows.map(([t, d]) => (
        <li key={t} className="rounded-input border border-border bg-card px-4 py-3">
          <p className="text-sm font-semibold text-foreground">{t}</p>
          <p className="text-sm text-muted-foreground">{d}</p>
        </li>
      ))}
    </ul>
  );
}

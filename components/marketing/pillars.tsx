import { Database, Lock, Workflow } from "lucide-react";

const PILLARS = [
  {
    icon: Database,
    title: "Bring data in",
    body: "Import CSV or JSON, or start from a blank canvas. Files are read in your browser and never leave it.",
  },
  {
    icon: Workflow,
    title: "See it clearly",
    body: "Diagrams and charts share one renderer-independent model, so your work is never locked to a single library.",
  },
  {
    icon: Lock,
    title: "Keep it yours",
    body: "Work saves automatically to local storage, survives refreshes, and exports to a backup file you control.",
  },
];

/** White band under the desk hero, separated by a hairline. */
export function Pillars() {
  return (
    <section aria-labelledby="pillars-heading" className="border-t border-border bg-background">
      <div className="mx-auto max-w-[var(--container-marketing)] px-4 py-16 sm:px-8 sm:py-20">
        <h2 id="pillars-heading" className="text-4xl sm:text-5xl">
          Local-first by design
        </h2>
        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {PILLARS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-card border border-border bg-card p-6">
              <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary-text">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="font-display text-2xl font-medium">{title}</h3>
              <p className="mt-2 text-body">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

import { Database, Lock, Workflow } from "lucide-react";

const PILLARS = [
  {
    icon: Database,
    title: "Bring data in",
    body: "Import CSV or JSON, or start from a blank canvas. Files are read in your browser and never leave it.",
    tone: "bg-blue-soft text-primary",
  },
  {
    icon: Workflow,
    title: "See it clearly",
    body: "Diagrams and charts share one renderer-independent model, so your work is never locked to a single library.",
    tone: "bg-violet-soft text-brand-violet",
  },
  {
    icon: Lock,
    title: "Keep it yours",
    body: "Work saves automatically to local storage, survives refreshes, and exports to a backup file you control.",
    tone: "bg-cyan-soft text-[#0a6d78]",
  },
];

export function Pillars() {
  return (
    <section aria-labelledby="pillars-heading" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <h2 id="pillars-heading" className="text-2xl font-bold sm:text-3xl">
        Local-first by design
      </h2>
      <ul className="mt-8 grid gap-5 md:grid-cols-3">
        {PILLARS.map(({ icon: Icon, title, body, tone }) => (
          <li key={title} className="rounded-xl border border-border bg-surface p-6 shadow-xs">
            <span className={`mb-4 flex size-11 items-center justify-center rounded-lg ${tone}`}>
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="mt-1.5 text-body">{body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

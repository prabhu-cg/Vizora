import Link from "next/link";
import { Visual } from "@/components/marketing/illustrations";
import { StartFreeButton } from "@/components/marketing/cta";
import { Band, CheckList, PageHero } from "@/components/marketing/section";
import { USE_CASES } from "@/lib/marketing/content";
import { MARKETING_ROUTES } from "@/lib/marketing/routes";
import { pageMetadata } from "@/lib/marketing/seo";
import { cn } from "@/lib/utils/cn";

export const metadata = pageMetadata({
  title: "Use cases",
  description: "How to use Vizora for product design, processes, data analysis, project management, software development and research, with what works today.",
  path: MARKETING_ROUTES.useCases.path,
});

export default function UseCasesPage() {
  return (
    <>
      <PageHero
        title="Made for the work you already do."
        lead="Practical ways to use Vizora, each with what works today and what is still to come."
      />
      <nav aria-label="Use cases" className="border-t border-border bg-background">
        <ul className="mx-auto flex max-w-[var(--container-marketing)] flex-wrap gap-2 px-4 py-5 sm:px-8">
          {USE_CASES.map((u) => (
            <li key={u.id}>
              <Link href={`#${u.id}`} className="inline-flex min-h-10 items-center rounded-full border border-border-strong px-4 text-sm font-medium text-foreground hover:bg-muted">
                {u.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {USE_CASES.map((u, i) => (
        <Band key={u.id} id={u.id} tone={i % 2 === 0 ? "desk" : "paper"}>
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <div className={cn(i % 2 === 1 && "lg:order-2")}>
              <h2 id={`${u.id}-heading`} className="text-3xl sm:text-4xl">
                {u.title}
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">{u.intro}</p>
              <p className="mt-4 rounded-input border border-border bg-card p-4 text-body">
                <span className="font-semibold text-foreground">For example: </span>
                {u.example}
              </p>
              <h3 className="mt-6 mb-2 text-sm font-semibold">Works today</h3>
              <CheckList items={u.today} />
              <h3 className="mt-6 mb-2 text-sm font-semibold">Not built yet</h3>
              <CheckList items={u.next} tone="next" />
            </div>
            <figure className={cn(i % 2 === 1 && "lg:order-1")}>
              <Visual kind={u.visual} />
              <figcaption className="mt-2 text-sm text-muted-foreground">Illustration of the kind of visual involved.</figcaption>
            </figure>
          </div>
        </Band>
      ))}

      <Band id="start">
        <div className="text-center">
          <h2 id="start-heading" className="text-4xl sm:text-5xl">
            Start with what you have
          </h2>
          <div className="mt-8 flex justify-center">
            <StartFreeButton />
          </div>
        </div>
      </Band>
    </>
  );
}

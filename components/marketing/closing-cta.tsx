import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Desk band; the closing call to action is never an amber block. */
export function ClosingCta() {
  return (
    <section aria-labelledby="cta-heading" className="border-t border-border bg-surface">
      <div className="mx-auto max-w-[var(--container-marketing)] px-4 py-16 text-center sm:px-8 sm:py-20">
        <h2 id="cta-heading" className="text-4xl sm:text-5xl">
          Start with a blank page
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">Create a project, add a diagram or a chart, and your work is saved as you go.</p>
        <div className="mt-8">
          <Button asChild size="lg">
            <Link href="/app/dashboard">
              Open Vizora <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

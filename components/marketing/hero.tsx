import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Desk band. The headline carries exactly one ochre phrase. */
export function Hero() {
  return (
    <section className="bg-surface">
      <div className="mx-auto max-w-[var(--container-marketing)] px-4 py-20 sm:px-8 sm:py-28">
        <Badge variant="soft" className="mb-6 gap-2">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
          Free edition
        </Badge>
        <h1 className="max-w-4xl text-5xl leading-none sm:text-7xl">
          See <span className="text-primary-text">beyond</span>
          <br />
          information
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Vizora turns data and ideas into diagrams and charts you can explore, refine and keep. It runs entirely in your browser: no account,
          no upload, no cloud.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
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

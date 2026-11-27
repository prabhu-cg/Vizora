import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-navy text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60rem 30rem at 85% -10%, rgb(128 85 232 / 0.35), transparent 60%), radial-gradient(50rem 28rem at 0% 110%, rgb(40 120 240 / 0.3), transparent 60%)",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-brand-cyan">Free edition</p>
        <h1 className="max-w-3xl text-4xl font-bold !text-white sm:text-5xl lg:text-[3.25rem]">
          Anything in.
          <br />
          Visual understanding out.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-[#d1d5db]">
          VIZORA turns data and ideas into diagrams and charts you can explore, refine and keep. It runs entirely in your browser: no account, no
          upload, no cloud.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg" className="bg-white text-navy hover:bg-[#e5e7eb] active:bg-[#d1d5db]">
            <Link href="/app/dashboard">
              Open VIZORA <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

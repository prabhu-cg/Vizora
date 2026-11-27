"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { reportError } from "@/lib/logging";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error, "route error", { digest: error.digest });
  }, [error]);
  return (
    <main id="main" className="mx-auto grid min-h-dvh max-w-xl place-items-center p-6">
      <ErrorState title="This page hit a problem" message="Your saved work is not affected." onRetry={reset}>
        <Button asChild variant="secondary">
          <Link href="/">Go home</Link>
        </Button>
      </ErrorState>
    </main>
  );
}

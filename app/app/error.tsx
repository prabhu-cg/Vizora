"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { reportError } from "@/lib/logging";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error, "app route error", { digest: error.digest });
  }, [error]);
  return (
    <div className="mx-auto grid min-h-dvh max-w-xl place-items-center p-6">
      <ErrorState title="Something went wrong" message="Your saved work is not affected." onRetry={reset}>
        <Button asChild variant="secondary">
          <Link href="/app/dashboard">Back to dashboard</Link>
        </Button>
      </ErrorState>
    </div>
  );
}

import { Compass } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto grid min-h-dvh max-w-xl place-items-center p-6">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="That address doesn’t lead anywhere in VIZORA."
        action={
          <Button asChild>
            <Link href="/app/dashboard">Go to dashboard</Link>
          </Button>
        }
      />
    </main>
  );
}

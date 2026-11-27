"use client";

import { Check, Minus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FEATURE_CATALOGUE, PLAN_LABELS, useEntitlements } from "@/features/entitlements/client";
import { CURRENT_BACKUP_VERSION, CURRENT_PROJECT_SCHEMA_VERSION, CURRENT_VISUALISATION_SCHEMA_VERSION } from "@/lib/validation";
import { StoragePanel } from "./storage-panel";

export function SettingsView() {
  return (
    <>
      <PageHeader title="Settings" description="Your plan, your data and how it is stored." />
      <div className="grid gap-6">
        <PlanSection />
        <StoragePanel />
        <AboutSection />
      </div>
    </>
  );
}

function PlanSection() {
  const entitlements = useEntitlements();
  const plan = entitlements.plan();
  const features = entitlements.featuresFor();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Plan <Badge variant="soft">{PLAN_LABELS[plan]}</Badge>
        </CardTitle>
        <CardDescription>
          Every feature in the {PLAN_LABELS[plan]} edition is enabled. There is no account, billing or cloud service in this edition.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {features.map((f) => {
            const planned = !FEATURE_CATALOGUE[f.id].released;
            return (
              <li key={f.id} className="flex items-center gap-2">
                {f.allowed ? (
                  <Check className="size-4 text-success" aria-hidden="true" />
                ) : (
                  <Minus className="size-4 text-muted-foreground" aria-hidden="true" />
                )}
                <span className={f.allowed ? undefined : "text-muted-foreground"}>
                  {f.label}
                  {f.allowed && <span className="sr-only"> (enabled)</span>}
                  {planned && " — planned"}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function AboutSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>About</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">App version</dt>
          <dd>{process.env.NEXT_PUBLIC_APP_VERSION ?? "dev"}</dd>
          <dt className="text-muted-foreground">Visualisation schema</dt>
          <dd>v{CURRENT_VISUALISATION_SCHEMA_VERSION}</dd>
          <dt className="text-muted-foreground">Project schema</dt>
          <dd>v{CURRENT_PROJECT_SCHEMA_VERSION}</dd>
          <dt className="text-muted-foreground">Backup format</dt>
          <dd>v{CURRENT_BACKUP_VERSION}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}

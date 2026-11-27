"use client";

import { Badge } from "@/components/ui/badge";
import { PLAN_LABELS, useEntitlements } from "@/features/entitlements/client";

export function PlanBadge() {
  const plan = useEntitlements().plan();
  return <Badge variant="blue">{PLAN_LABELS[plan]} edition</Badge>;
}

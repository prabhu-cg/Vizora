"use client";

import { AlertTriangle, Check } from "lucide-react";
import { useMemo } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { TYPE_META } from "@/components/visualisations/type-meta";
import { planConversion, type EngineType } from "@/lib/engine";
import type { VisualisationIR } from "@/types/visualisation";

/**
 * Shows exactly what switching type will change, before anything is applied.
 * Applying is one undoable step.
 */
export function ConvertDialog({
  doc,
  target,
  onClose,
  onApply,
}: {
  doc: VisualisationIR;
  target: EngineType | undefined;
  onClose: () => void;
  onApply: (result: VisualisationIR) => void;
}) {
  const plan = useMemo(() => (target ? planConversion(doc, target) : undefined), [doc, target]);
  const from = TYPE_META[doc.type].label.toLowerCase();
  const to = target ? TYPE_META[target].label.toLowerCase() : "";
  const blocked = plan?.blocked;
  const losses = plan?.changes.filter((c) => c.severity === "loss") ?? [];

  return (
    <ConfirmDialog
      open={Boolean(target)}
      onOpenChange={(o) => !o && onClose()}
      title={blocked ? `Can’t switch to a ${to}` : `Switch to a ${to}?`}
      confirmLabel={`Switch to ${to}`}
      confirmVariant="primary"
      informOnly={Boolean(blocked)}
      description={
        plan ? (
          blocked ? (
            <p>{blocked}</p>
          ) : (
            <div className="grid gap-3">
              <p>
                {plan.lossless
                  ? `Nothing is lost: your ${from} keeps all its content and only its form changes.`
                  : `Your ${from} cannot become a ${to} without losing some structure. Here is what changes:`}
              </p>
              <ul className="grid gap-2">
                {plan.changes.map((c, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    {c.severity === "loss" ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" /> : <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />}
                    <span>
                      <span className="sr-only">{c.severity === "loss" ? "Lost: " : "Changed: "}</span>
                      {c.text}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted-foreground">
                {losses.length ? "You can undo this straight away, and switching back restores shapes and labels that were set aside." : "You can undo this at any time."}
              </p>
            </div>
          )
        ) : null
      }
      onConfirm={async () => {
        if (plan?.result) onApply(plan.result);
      }}
    />
  );
}

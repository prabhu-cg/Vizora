"use client";

import { AlertTriangle, Info, Wand2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ENGINE_TYPES, documentFromInterpretation, interpret, readInputText, readWarnings, type EngineType } from "@/lib/engine";
import { TYPE_META } from "@/components/visualisations/type-meta";
import { notify } from "@/lib/notify";
import type { UpdateOptions } from "@/features/visualisation/use-visualisation-editor";
import type { VisualisationIR } from "@/types/visualisation";

type Update = (updater: (d: VisualisationIR) => VisualisationIR, options?: UpdateOptions) => void;

export interface NoteLike {
  code: string;
  message: string;
  severity: "info" | "warning";
  line?: number;
}

/** Warnings and notes as an accessible list. Used before creating and after. */
export function WarningList({ warnings }: { warnings: readonly NoteLike[] }) {
  if (warnings.length === 0) return <p className="text-sm text-muted-foreground">Nothing was unclear.</p>;
  return (
    <ul className="grid gap-2">
      {warnings.map((w, i) => (
        <li key={`${w.code}-${i}`} className={`flex gap-2 rounded-input p-2.5 text-sm ${w.severity === "warning" ? "bg-warning-soft text-warning" : "bg-info-soft text-info"}`}>
          {w.severity === "warning" ? <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
          <span>
            <span className="sr-only">{w.severity === "warning" ? "Warning: " : "Note: "}</span>
            {w.message}
            {w.line ? <span className="opacity-80"> (line {w.line})</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Notes about how the text was read; shown so nothing the engine skipped or assumed is hidden. */
export function InterpretationNotes({ doc }: { doc: VisualisationIR }) {
  const warnings = readWarnings(doc);
  const info = doc.configuration.options.interpretation as { detected?: string; confidence?: number; chosen?: boolean } | undefined;
  if (!info && warnings.length === 0) return null;
  return (
    <section aria-label="How your text was read" className="grid gap-2">
      <h3 className="text-[15px] font-semibold">How your text was read</h3>
      {info?.detected && (
        <p className="text-sm text-muted-foreground">
          {info.chosen ? "Type chosen by you." : `Type detected from the text${typeof info.confidence === "number" ? ` (${Math.round(info.confidence * 100)}% confident)` : ""}.`}
        </p>
      )}
      <WarningList warnings={warnings} />
    </section>
  );
}

/**
 * The text a visualisation was made from, so it can be refined and read again.
 * Manual edits stay possible at any time; regenerating replaces the content
 * and is a single undoable step.
 */
export function SourcePanel({ doc, update }: { doc: VisualisationIR; update: Update }) {
  const id = useId();
  const saved = readInputText(doc) ?? "";
  const [text, setText] = useState(saved);
  const [type, setType] = useState<EngineType | "auto">(doc.type as EngineType);
  const [confirm, setConfirm] = useState(false);
  const preview = useMemo(() => (text.trim() ? interpret(text, { type }) : undefined), [text, type]);
  const hasContent = doc.nodes.length > 0;

  const regenerate = () => {
    const it = interpret(text, { type });
    update((d) => {
      const next = documentFromInterpretation(text, it, d);
      // Keep a title you chose; adopt the one from the request only when the text named a topic.
      const named = !it.graph.title.startsWith("Untitled ");
      return { ...next, title: named ? it.graph.title : d.title };
    });
    notify.success("Generated from your text", it.warnings.some((w) => w.severity === "warning") ? "Some things were unclear. See the notes." : undefined);
  };

  return (
    <section aria-labelledby={`${id}-h`} className="grid gap-4 p-4">
      <div>
        <h3 id={`${id}-h`} className="text-[15px] font-semibold">Source text</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">Describe or paste content, then generate. You can keep editing by hand afterwards.</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-t`}>What would you like to visualise?</Label>
        <Textarea id={`${id}-t`} rows={9} value={text} onChange={(e) => setText(e.target.value)} placeholder={"1. First step\n2. If approved, continue, otherwise stop\n3. Finish"} maxLength={20000} className="font-mono text-[13px]" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-ty`}>Read it as</Label>
        <Select id={`${id}-ty`} value={type} onChange={(e) => setType(e.target.value as EngineType | "auto")}>
          <option value="auto">Detect automatically</option>
          {ENGINE_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_META[t].label}</option>
          ))}
        </Select>
      </div>
      {preview && preview.detection.type !== doc.type && (
        <p className="rounded-input bg-warning-soft p-2.5 text-sm text-warning">
          This would produce a {TYPE_META[preview.detection.type].label.toLowerCase()}, not a {TYPE_META[doc.type].label.toLowerCase()}. The visualisation will change type.
        </p>
      )}
      <Button disabled={!text.trim()} onClick={() => (hasContent ? setConfirm(true) : regenerate())}>
        <Wand2 aria-hidden="true" /> {hasContent ? "Regenerate from text" : "Generate from text"}
      </Button>
      <InterpretationNotes doc={doc} />
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Replace the current content?"
        description="Generating again rebuilds the visualisation from this text, so manual edits to its content and layout are replaced. You can undo this."
        confirmLabel="Regenerate"
        confirmVariant="primary"
        onConfirm={async () => regenerate()}
      />
    </section>
  );
}

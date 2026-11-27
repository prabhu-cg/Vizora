"use client";

import { useDeferredValue, useId, useMemo, useState } from "react";
import { Spinner } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader } from "@/components/ui/drawer";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { creatableTypes } from "@/components/visualisations/registry";
import { TYPE_META } from "@/components/visualisations/type-meta";
import { EXAMPLE_PROMPTS } from "@/features/editor/examples";
import { WarningList } from "@/features/editor/source-panel";
import { ENGINE_TYPES, documentFromInterpretation, interpret, type EngineType } from "@/lib/engine";
import { errorMessage, notify } from "@/lib/notify";
import { cn } from "@/lib/utils/cn";
import { createVisualisation } from "@/lib/visualisation/factory";
import type { VisualisationIR, VisualisationType } from "@/types/visualisation";

type Mode = "describe" | "manual";

export function NewVisualisationDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (doc: VisualisationIR) => Promise<void>;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent size="lg">
        <Form onCancel={() => onOpenChange(false)} onCreate={onCreate} onDone={() => onOpenChange(false)} />
      </DrawerContent>
    </Drawer>
  );
}

function Segmented<T extends string>({ label, value, onChange, options, name }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; name: string }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium text-foreground">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "inline-flex min-h-10 cursor-pointer items-center rounded-full border px-4 text-sm font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
              value === o.value ? "border-primary bg-accent font-semibold text-accent-foreground" : "border-border-strong bg-background text-foreground hover:bg-muted",
            )}
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Form({ onCreate, onCancel, onDone }: { onCreate: (doc: VisualisationIR) => Promise<void>; onCancel: () => void; onDone: () => void }) {
  const id = useId();
  const [mode, setMode] = useState<Mode>("describe");
  const [text, setText] = useState("");
  const [type, setType] = useState<EngineType | "auto">("auto");
  const [title, setTitle] = useState("");
  const [manualType, setManualType] = useState<VisualisationType>("flowchart");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const deferred = useDeferredValue(text);
  const preview = useMemo(() => (deferred.trim() ? interpret(deferred, { type, title }) : undefined), [deferred, type, title]);
  const stats = preview && { items: preview.graph.items.length, links: preview.graph.links.length };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(undefined);
    let doc: VisualisationIR;
    if (mode === "manual") {
      if (!title.trim()) return setError("Title is required");
      doc = createVisualisation({ title: title.trim(), type: manualType });
    } else {
      if (!text.trim()) return setError("Describe or paste something to visualise, or choose Start manually.");
      const it = interpret(text, { type, title });
      doc = documentFromInterpretation(text, it, createVisualisation({ title: it.graph.title, type: it.graph.type }));
    }
    setPending(true);
    try {
      await onCreate(doc);
      onDone();
    } catch (e) {
      notify.error("Could not create visualisation", errorMessage(e));
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DrawerHeader title="New visualisation" description="Describe it, paste it, or start from a blank canvas. No AI is involved." />
      <DrawerBody className="grid content-start gap-6">
        <Segmented name={`${id}-mode`} label="How do you want to start?" value={mode} onChange={setMode} options={[{ value: "describe", label: "Describe or paste" }, { value: "manual", label: "Start manually" }]} />

        {mode === "describe" ? (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-text`} className="text-base">What would you like to visualise?</Label>
              <Textarea
                id={`${id}-text`}
                rows={9}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={20000}
                autoFocus
                aria-invalid={error ? true : undefined}
                aria-describedby={`${id}-help${error ? ` ${id}-err` : ""}`}
                placeholder={"Paste steps, an outline, dated events or relationships, for example:\n1. Customer signs up\n2. If verified, activate, otherwise resend"}
                className="font-mono text-[13px]"
              />
              <p id={`${id}-help`} className="text-xs text-muted-foreground">
                Vizora arranges the structure it can see (steps, if/otherwise, outlines, dates, “A depends on B”). It does not write content for you.
                {text.length > 0 && <span className="ml-1 tabular-nums">{text.length.toLocaleString()} / 20,000</span>}
              </p>
              {error && <p id={`${id}-err`} role="alert" className="text-sm text-destructive">{error}</p>}
            </div>

            <div className="grid gap-2">
              <p className="text-sm font-medium text-foreground">Try an example</p>
              <ul className="flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((ex) => (
                  <li key={ex.id}>
                    <Button variant="outline" size="sm" onClick={() => { setText(ex.text); setType("auto"); setError(undefined); }}>
                      {ex.label}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>

            <Segmented
              name={`${id}-type`}
              label="Visualisation type"
              value={type}
              onChange={setType}
              options={[{ value: "auto", label: "Detect automatically" }, ...ENGINE_TYPES.map((t) => ({ value: t, label: TYPE_META[t].label }))]}
            />

            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-title`}>Title <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id={`${id}-title`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={preview?.graph.title ?? "Taken from your request when it names a topic"} />
            </div>

            <section aria-live="polite" aria-label="How Vizora will read this" className="grid gap-3 rounded-card border border-border bg-surface p-4">
              <h3 className="text-[15px] font-semibold">How Vizora will read this</h3>
              {!preview ? (
                <p className="text-sm text-muted-foreground">Type or paste something above to see a preview of what will be created.</p>
              ) : (
                <>
                  <p className="text-sm text-body">
                    <strong>{TYPE_META[preview.detection.type].label}</strong>
                    {preview.detection.chosen ? " (your choice)" : ` (detected: ${preview.detection.reason})`}
                    {stats && !preview.requestOnly ? ` · ${stats.items} item${stats.items === 1 ? "" : "s"} · ${stats.links} connection${stats.links === 1 ? "" : "s"}` : ""}
                  </p>
                  <WarningList warnings={preview.warnings} />
                  {preview.warnings.length > 0 && <p className="text-xs text-muted-foreground">You can refine everything by hand after it is created, or edit the text and generate again.</p>}
                </>
              )}
            </section>
          </>
        ) : (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor={`${id}-mt`}>Title</Label>
              <Input id={`${id}-mt`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-err` : undefined} />
              {error && <p id={`${id}-err`} role="alert" className="text-sm text-destructive">{error}</p>}
            </div>
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">Type</legend>
              {creatableTypes().map((t) => {
                const meta = TYPE_META[t];
                const Icon = meta.icon;
                const selected = manualType === t;
                return (
                  <label key={t} className={cn("flex min-h-14 cursor-pointer items-center gap-3 rounded-card border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring", selected ? "border-primary bg-accent" : "border-border hover:bg-muted")}>
                    <input type="radio" name={`${id}-manual`} value={t} checked={selected} onChange={() => setManualType(t)} className="sr-only" />
                    <Icon className="size-5 shrink-0 text-primary-text" aria-hidden="true" />
                    <span>
                      <span className="block text-sm font-medium">{meta.label}</span>
                      <span className="block text-sm text-muted-foreground">{meta.description}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
          </>
        )}
      </DrawerBody>
      <DrawerFooter>
        <Button variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner />}
          Create visualisation
        </Button>
      </DrawerFooter>
    </form>
  );
}

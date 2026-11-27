"use client";

import { useId, useState } from "react";
import { Spinner } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { creatableTypes } from "@/components/visualisations/registry";
import { TYPE_META } from "@/components/visualisations/type-meta";
import { errorMessage, notify } from "@/lib/notify";
import { cn } from "@/lib/utils/cn";
import type { NewVisualisationInput } from "@/lib/visualisation/factory";
import type { VisualisationType } from "@/types/visualisation";

export function NewVisualisationDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: NewVisualisationInput) => Promise<void>;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <Form onCancel={() => onOpenChange(false)} onCreate={onCreate} onDone={() => onOpenChange(false)} />
      </DrawerContent>
    </Drawer>
  );
}

function Form({
  onCreate,
  onCancel,
  onDone,
}: {
  onCreate: (input: NewVisualisationInput) => Promise<void>;
  onCancel: () => void;
  onDone: () => void;
}) {
  const id = useId();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<VisualisationType>("diagram");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title is required");
      return;
    }
    setError(undefined);
    setPending(true);
    try {
      await onCreate({ title: trimmed, type });
      onDone();
    } catch (e) {
      notify.error("Could not create visualisation", errorMessage(e));
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DrawerHeader title="New visualisation" description="Choose a type. You can import data after it opens." />
      <DrawerBody className="grid content-start gap-5">

      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-title`}>Title</Label>
        <Input
          id={`${id}-title`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          autoFocus
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
        />
        {error && (
          <p id={`${id}-err`} className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Type</legend>
        {creatableTypes().map((t) => {
          const meta = TYPE_META[t];
          const Icon = meta.icon;
          const selected = type === t;
          return (
            <label
              key={t}
              className={cn(
                "flex min-h-14 cursor-pointer items-center gap-3 rounded-card border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                selected ? "border-primary bg-accent" : "border-border hover:bg-muted",
              )}
            >
              <input type="radio" name={`${id}-type`} value={t} checked={selected} onChange={() => setType(t)} className="sr-only" />
              <Icon className="size-5 shrink-0 text-primary-text" aria-hidden="true" />
              <span>
                <span className="block text-sm font-medium">{meta.label}</span>
                <span className="block text-sm text-muted-foreground">{meta.description}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      </DrawerBody>
      <DrawerFooter>
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner />}
          Create visualisation
        </Button>
      </DrawerFooter>
    </form>
  );
}

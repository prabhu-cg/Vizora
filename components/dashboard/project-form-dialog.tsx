"use client";

import { useId, useState } from "react";
import { Spinner } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader } from "@/components/ui/drawer";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage, notify } from "@/lib/notify";
import { projectDescriptionSchema, projectNameSchema } from "@/lib/validation";
import type { Project, ProjectInput } from "@/types/project";

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Provide to edit; omit to create. */
  project?: Project;
  onSubmit: (input: ProjectInput) => Promise<void>;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <ProjectForm project={project} onCancel={() => onOpenChange(false)} onSubmit={onSubmit} onDone={() => onOpenChange(false)} />
      </DrawerContent>
    </Drawer>
  );
}

function ProjectForm({
  project,
  onSubmit,
  onCancel,
  onDone,
}: {
  project?: Project;
  onSubmit: (input: ProjectInput) => Promise<void>;
  onCancel: () => void;
  onDone: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [nameError, setNameError] = useState<string>();
  const [descError, setDescError] = useState<string>();
  const [pending, setPending] = useState(false);
  const editing = Boolean(project);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const n = projectNameSchema.safeParse(name);
    const d = projectDescriptionSchema.safeParse(description);
    setNameError(n.success ? undefined : n.error.issues[0]?.message);
    setDescError(d.success ? undefined : d.error.issues[0]?.message);
    if (!n.success || !d.success) return;
    setPending(true);
    try {
      await onSubmit({ name: n.data, description: d.data });
      onDone();
    } catch (error) {
      notify.error(editing ? "Could not save project" : "Could not create project", errorMessage(error));
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <DrawerHeader
        title={editing ? "Edit project" : "New project"}
        description={editing ? "Rename the project or update its description." : "A project groups related visualisations."}
      />
      <DrawerBody className="grid content-start gap-5">

      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-name`}>Name</Label>
        <Input
          id={`${id}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          autoFocus
          required
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? `${id}-name-err` : undefined}
        />
        {nameError && (
          <p id={`${id}-name-err`} className="text-sm text-destructive">
            {nameError}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-desc`}>
          Description <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id={`${id}-desc`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          aria-invalid={descError ? true : undefined}
          aria-describedby={descError ? `${id}-desc-err` : undefined}
        />
        {descError && (
          <p id={`${id}-desc-err`} className="text-sm text-destructive">
            {descError}
          </p>
        )}
      </div>

      </DrawerBody>
      <DrawerFooter>
        <Button variant="secondary" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Spinner />}
          {editing ? "Save changes" : "Create project"}
        </Button>
      </DrawerFooter>
    </form>
  );
}

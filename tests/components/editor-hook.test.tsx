import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { useVisualisationEditor } from "@/features/visualisation/use-visualisation-editor";
import { StorageProvider } from "@/hooks/use-storage";
import { createNode, createVisualisation } from "@/lib/visualisation/factory";
import { createTestStorage } from "../helpers";

async function setup() {
  const storage = createTestStorage();
  const project = await storage.projects.create({ name: "P" });
  const record = await storage.visualisations.create(project.id, createVisualisation({ title: "Doc", type: "diagram" }));
  const wrapper = ({ children }: { children: ReactNode }) => <StorageProvider storage={storage}>{children}</StorageProvider>;
  const open = () => renderHook(() => useVisualisationEditor(record.id), { wrapper });
  return { storage, record, open };
}

describe("useVisualisationEditor", () => {
  it("loads, autosaves edits, and recovers them after a 'refresh' (fresh mount)", async () => {
    const { storage, record, open } = await setup();
    const first = open();
    await waitFor(() => expect(first.result.current.editor.phase).toBe("ready"));
    expect(first.result.current.save.status).toBe("saved");

    act(() => first.result.current.update((d) => ({ ...d, title: "Renamed", nodes: [createNode({ id: "n", position: { x: 5, y: 6 } })] })));
    expect(first.result.current.save.status).toBe("unsaved");
    await act(() => first.result.current.saveNow());
    await waitFor(() => expect(first.result.current.save.status).toBe("saved"));
    first.unmount();

    const second = open(); // simulates reload: all React state gone, only IndexedDB remains
    await waitFor(() => expect(second.result.current.editor.phase).toBe("ready"));
    const editor = second.result.current.editor;
    if (editor.phase !== "ready") throw new Error("not ready");
    expect(editor.document.title).toBe("Renamed");
    expect(editor.document.nodes[0]?.position).toEqual({ x: 5, y: 6 });
    expect((await storage.visualisations.get(record.id))?.revision).toBe(2);
  });

  it("flushes pending edits on unmount so navigating away loses nothing", async () => {
    const { storage, record, open } = await setup();
    const view = open();
    await waitFor(() => expect(view.result.current.editor.phase).toBe("ready"));
    act(() => view.result.current.update((d) => ({ ...d, description: "typed just before leaving" })));
    view.unmount();
    await waitFor(async () => expect((await storage.visualisations.get(record.id))?.document.description).toBe("typed just before leaving"));
  });

  it("detects an edit made elsewhere and never overwrites it until the user chooses", async () => {
    const { storage, record, open } = await setup();
    const view = open();
    await waitFor(() => expect(view.result.current.editor.phase).toBe("ready"));

    // Another tab saves first.
    await storage.visualisations.save(record.id, { ...record.document, title: "Other tab" }, { expectedRevision: 1 });

    act(() => view.result.current.update((d) => ({ ...d, title: "This tab" })));
    await act(() => view.result.current.saveNow());
    await waitFor(() => expect(view.result.current.save.status).toBe("conflict"));
    expect((await storage.visualisations.get(record.id))?.document.title).toBe("Other tab");

    // Choosing the other version adopts it and clears the conflict.
    act(() => view.result.current.loadLatest());
    await waitFor(() => expect(view.result.current.save.status).toBe("saved"));
    const editor = view.result.current.editor;
    expect(editor.phase === "ready" && editor.document.title).toBe("Other tab");
  });

  it("keep-mine overwrites only after the explicit decision", async () => {
    const { storage, record, open } = await setup();
    const view = open();
    await waitFor(() => expect(view.result.current.editor.phase).toBe("ready"));
    await storage.visualisations.save(record.id, { ...record.document, title: "Other tab" }, { expectedRevision: 1 });
    act(() => view.result.current.update((d) => ({ ...d, title: "Mine" })));
    await act(() => view.result.current.saveNow());
    await waitFor(() => expect(view.result.current.save.status).toBe("conflict"));

    act(() => view.result.current.keepMine());
    await waitFor(() => expect(view.result.current.save.status).toBe("saved"));
    expect((await storage.visualisations.get(record.id))?.document.title).toBe("Mine");
  });

  it("reports a missing visualisation", async () => {
    const storage = createTestStorage();
    const wrapper = ({ children }: { children: ReactNode }) => <StorageProvider storage={storage}>{children}</StorageProvider>;
    const view = renderHook(() => useVisualisationEditor("nope"), { wrapper });
    await waitFor(() => expect(view.result.current.editor.phase).toBe("not-found"));
  });
});

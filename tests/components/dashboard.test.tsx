import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { ProjectView } from "@/components/dashboard/project-view";
import { StorageProvider } from "@/hooks/use-storage";
import { createVisualisation } from "@/lib/visualisation/factory";
import { createTestStorage } from "../helpers";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/app/dashboard",
}));

function renderWith(storage: ReturnType<typeof createTestStorage>, ui: ReactNode) {
  return render(<StorageProvider storage={storage}>{ui}</StorageProvider>);
}

describe("DashboardView", () => {
  it("shows an empty state, then creates a project that appears in the list", async () => {
    const storage = createTestStorage();
    renderWith(storage, <DashboardView />);
    expect(await screen.findByRole("heading", { name: "Create your first project" })).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: /new project/i })[0]!);
    const dialog = await screen.findByRole("dialog", { name: "New project" });
    await userEvent.type(within(dialog).getByLabelText("Name"), "Quarterly review");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create project" }));

    expect(await screen.findByRole("link", { name: "Quarterly review" })).toHaveAttribute("href", expect.stringMatching(/^\/app\/dashboard\/.+/));
    expect((await storage.projects.list()).map((p) => p.name)).toEqual(["Quarterly review"]);
  });

  it("validates the name inline and writes nothing", async () => {
    const storage = createTestStorage();
    renderWith(storage, <DashboardView />);
    await userEvent.click((await screen.findAllByRole("button", { name: /new project/i }))[0]!);
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Name"), "   ");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create project" }));
    const input = within(dialog).getByLabelText("Name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(within(dialog).getByText("Name is required")).toBeInTheDocument();
    expect(await storage.projects.list()).toEqual([]);
  });

  it("requires confirmation before deleting a project and its visualisations", async () => {
    const storage = createTestStorage();
    const p = await storage.projects.create({ name: "Doomed" });
    await storage.visualisations.create(p.id, createVisualisation({ title: "Child", type: "flowchart" }));
    renderWith(storage, <DashboardView />);

    await userEvent.click(await screen.findByRole("button", { name: "Actions for Doomed" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /delete project/i }));

    // Cancel first: nothing is deleted.
    let confirm = await screen.findByRole("alertdialog");
    expect(confirm).toHaveTextContent("1 visualisation");
    await userEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(await storage.projects.get(p.id)).toBeDefined();

    // Confirm: deleted, cascade included.
    await userEvent.click(screen.getByRole("button", { name: "Actions for Doomed" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /delete project/i }));
    confirm = await screen.findByRole("alertdialog");
    await userEvent.click(within(confirm).getByRole("button", { name: "Delete project" }));
    await waitFor(async () => expect(await storage.projects.get(p.id)).toBeUndefined());
    expect(await storage.visualisations.listAll()).toEqual([]);
    expect(await screen.findByRole("heading", { name: "Create your first project" })).toBeInTheDocument();
  });

  it("surfaces storage failures with a retry instead of crashing", async () => {
    const storage = createTestStorage();
    const spy = vi.spyOn(storage.projects, "list").mockRejectedValueOnce(new Error("disk on fire"));
    renderWith(storage, <DashboardView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("disk on fire");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Create your first project" })).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe("ProjectView", () => {
  it("manual path: creates a blank visualisation of the chosen type and opens it", async () => {
    push.mockClear();
    const storage = createTestStorage();
    const p = await storage.projects.create({ name: "P" });
    renderWith(storage, <ProjectView projectId={p.id} />);

    await userEvent.click((await screen.findAllByRole("button", { name: /new visualisation/i }))[0]!);
    const dialog = await screen.findByRole("dialog", { name: "New visualisation" });
    await userEvent.click(within(dialog).getByRole("radio", { name: "Start manually" }));
    await userEvent.type(within(dialog).getByLabelText("Title"), "Flow");
    await userEvent.click(within(dialog).getByRole("radio", { name: /^Chart/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Create visualisation" }));

    await waitFor(() => expect(push).toHaveBeenCalled());
    const [saved] = await storage.visualisations.listByProject(p.id);
    expect(saved).toMatchObject({ title: "Flow", type: "chart" });
    expect(push).toHaveBeenCalledWith(`/app/workspace/${saved!.id}`);
  });

  it("describe path: an example previews how it will be read, then creates a populated flowchart that remembers its text", async () => {
    push.mockClear();
    const storage = createTestStorage();
    const p = await storage.projects.create({ name: "P" });
    renderWith(storage, <ProjectView projectId={p.id} />);

    await userEvent.click((await screen.findAllByRole("button", { name: /new visualisation/i }))[0]!);
    const dialog = await screen.findByRole("dialog", { name: "New visualisation" });
    expect(within(dialog).getByLabelText("What would you like to visualise?")).toBeInTheDocument();
    expect(within(dialog).getByText(/Type or paste something above/)).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Flowchart for customer onboarding" }));
    const preview = await within(dialog).findByLabelText("How Vizora will read this");
    await waitFor(() => expect(preview).toHaveTextContent(/Flowchart.*detected/));
    expect(preview).toHaveTextContent(/\d+ items · \d+ connections/);

    await userEvent.click(within(dialog).getByRole("button", { name: "Create visualisation" }));
    await waitFor(() => expect(push).toHaveBeenCalled());
    const [summary] = await storage.visualisations.listByProject(p.id);
    expect(summary).toMatchObject({ type: "flowchart", title: "Customer onboarding" });
    expect(summary!.nodeCount).toBeGreaterThan(5);
    const rec = await storage.visualisations.get(summary!.id);
    expect(rec!.document.configuration.options.inputText).toContain("Customer signs up");
  });

  it("describe path: an unreadable request warns instead of inventing content", async () => {
    const storage = createTestStorage();
    const p = await storage.projects.create({ name: "P" });
    renderWith(storage, <ProjectView projectId={p.id} />);
    await userEvent.click((await screen.findAllByRole("button", { name: /new visualisation/i }))[0]!);
    const dialog = await screen.findByRole("dialog", { name: "New visualisation" });
    await userEvent.type(within(dialog).getByLabelText("What would you like to visualise?"), "Create a flowchart for customer onboarding.");
    const preview = await within(dialog).findByLabelText("How Vizora will read this");
    await waitFor(() => expect(preview).toHaveTextContent(/does not write content for you/));
    await userEvent.click(within(dialog).getByRole("button", { name: "Create visualisation" }));
    await waitFor(async () => expect((await storage.visualisations.listByProject(p.id))[0]).toMatchObject({ nodeCount: 0, title: "Customer onboarding" }));
  });

  it("requires something to visualise", async () => {
    const storage = createTestStorage();
    const p = await storage.projects.create({ name: "P" });
    renderWith(storage, <ProjectView projectId={p.id} />);
    await userEvent.click((await screen.findAllByRole("button", { name: /new visualisation/i }))[0]!);
    const dialog = await screen.findByRole("dialog", { name: "New visualisation" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Create visualisation" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/Describe or paste something/);
    expect(await storage.visualisations.listByProject(p.id)).toEqual([]);
  });

  it("duplicates and deletes (with confirmation)", async () => {
    const storage = createTestStorage();
    const p = await storage.projects.create({ name: "P" });
    const v = await storage.visualisations.create(p.id, createVisualisation({ title: "Orig", type: "flowchart" }));
    renderWith(storage, <ProjectView projectId={p.id} />);

    await userEvent.click(await screen.findByRole("button", { name: "Actions for Orig" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Duplicate" }));
    expect(await screen.findByRole("link", { name: "Orig (copy)" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Actions for Orig" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete visualisation" }));
    await waitFor(async () => expect(await storage.visualisations.get(v.id)).toBeUndefined());
    expect(screen.getByRole("link", { name: "Orig (copy)" })).toBeInTheDocument();
  });

  it("shows a not-found state for unknown projects", async () => {
    renderWith(createTestStorage(), <ProjectView projectId="missing" />);
    expect(await screen.findByRole("heading", { name: "Project not found" })).toBeInTheDocument();
  });
});

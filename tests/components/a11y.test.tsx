import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { ProjectView } from "@/components/dashboard/project-view";
import { RecentView } from "@/components/dashboard/recent-view";
import { StoragePanel } from "@/components/settings/storage-panel";
import { StorageProvider } from "@/hooks/use-storage";
import { createVisualisation } from "@/lib/visualisation/factory";
import { createTestStorage } from "../helpers";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/app/dashboard" }));
beforeEach(() => localStorage.clear());

/** Structural accessibility rules. Colour contrast needs real layout, so it is covered by the token contrast tests instead. */
async function violations(node: Element = document.body) {
  const r = await axe.run(node, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
  return r.violations.map((v) => `${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
}
const withStorage = (s: ReturnType<typeof createTestStorage>, ui: ReactNode) => render(<StorageProvider storage={s}>{ui}</StorageProvider>);

async function seeded() {
  const s = createTestStorage();
  const p = await s.projects.create({ name: "Launch", description: "Spring release" });
  await s.visualisations.create(p.id, createVisualisation({ title: "Roadmap", type: "timeline" }));
  await s.visualisations.create(p.id, createVisualisation({ title: "Flow", type: "flowchart" }));
  return { s, p };
}

describe("accessibility (structural rules)", () => {
  it("dashboard: empty", async () => {
    withStorage(createTestStorage(), <DashboardView />);
    await screen.findByRole("heading", { name: "Create your first project" });
    expect(await violations()).toEqual([]);
  });
  it("dashboard: with projects, and while searching", async () => {
    const { s } = await seeded();
    withStorage(s, <DashboardView />);
    await screen.findByRole("heading", { name: /All projects/ });
    expect(await violations()).toEqual([]);
    await userEvent.type(screen.getByRole("searchbox"), "road");
    await screen.findByText(/match/);
    expect(await violations()).toEqual([]);
  });
  it("dashboard: new project drawer is a labelled dialog with labelled fields", async () => {
    withStorage(createTestStorage(), <DashboardView />);
    await userEvent.click((await screen.findAllByRole("button", { name: /new project/i }))[0]!);
    const dialog = await screen.findByRole("dialog", { name: "New project" });
    expect(await violations(dialog)).toEqual([]);
  });
  it("project page with reorder controls", async () => {
    const { s, p } = await seeded();
    withStorage(s, <ProjectView projectId={p.id} />);
    await screen.findByRole("list", { name: "Visualisations" });
    expect(await violations()).toEqual([]);
  });
  it("recent page", async () => {
    const { s } = await seeded();
    withStorage(s, <RecentView />);
    await screen.findByRole("heading", { name: "Recent projects" });
    expect(await violations()).toEqual([]);
  });
  it("storage panel and its destructive confirmation", async () => {
    const { s } = await seeded();
    withStorage(s, <StoragePanel />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Clear local data/ })).toBeEnabled());
    expect(await violations()).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: /Clear local data/ }));
    expect(await violations(await screen.findByRole("alertdialog"))).toEqual([]);
  });
});

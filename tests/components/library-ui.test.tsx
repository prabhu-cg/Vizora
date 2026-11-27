import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { RecentView } from "@/components/dashboard/recent-view";
import { ProjectView } from "@/components/dashboard/project-view";
import { Select } from "@/components/ui/input";
import { StoragePanel } from "@/components/settings/storage-panel";
import { useWorkspaceChrome } from "@/components/workspace/use-workspace-chrome";
import { PanelControls, WorkspaceFrame } from "@/components/workspace/workspace-frame";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { StorageProvider } from "@/hooks/use-storage";
import { createVisualisation } from "@/lib/visualisation/factory";
import { createTestStorage } from "../helpers";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/app/dashboard" }));

beforeEach(() => {
  localStorage.clear();
  push.mockClear();
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
});

const renderWith = (storage: ReturnType<typeof createTestStorage>, ui: ReactNode) => render(<StorageProvider storage={storage}>{ui}</StorageProvider>);
const doc = (title: string, type: "flowchart" | "timeline" | "chart" | "mindmap" | "dashboard" = "flowchart", description = "") => ({ ...createVisualisation({ title, type }), description });
const names = (items: HTMLElement[]) => items.map((e) => e.textContent);

async function seed() {
  const s = createTestStorage();
  const product = await s.projects.create({ name: "Product launch", description: "Everything for the spring release" });
  const research = await s.projects.create({ name: "Research", description: "User interviews" });
  const onboarding = await s.visualisations.create(product.id, doc("Onboarding flow", "flowchart", "customer sign-up steps"));
  const roadmap = await s.visualisations.create(product.id, doc("Roadmap", "timeline"));
  const revenue = await s.visualisations.create(product.id, doc("Revenue", "chart"));
  const themes = await s.visualisations.create(research.id, doc("Interview themes", "mindmap"));
  return { s, product, research, onboarding, roadmap, revenue, themes };
}

describe("Select", () => {
  it("is a real native select with an inset chevron, not the browser's cramped arrow", () => {
    const { container } = render(
      <label>
        Layout
        <Select defaultValue="b">
          <option value="a">A</option>
          <option value="b">B</option>
        </Select>
      </label>,
    );
    const select = screen.getByRole("combobox", { name: "Layout" });
    expect(select).toHaveValue("b");
    expect(select.className).toMatch(/appearance-none/);
    expect(select.className).toMatch(/pr-10/); // room for the chevron
    const chevron = container.querySelector("svg")!;
    expect(chevron).toHaveAttribute("aria-hidden", "true");
    expect(chevron.getAttribute("class")).toMatch(/pointer-events-none/); // clicks go to the select
    expect(chevron.parentElement).toBe(select.parentElement);
  });
  it("shrinks to its content for toolbars with w-auto, and fills its row otherwise", () => {
    const { container } = render(<><Select className="w-auto" aria-label="a"><option>x</option></Select><Select aria-label="b"><option>x</option></Select></>);
    const wraps = container.querySelectorAll(":scope > span");
    expect(wraps[0]!.className).toMatch(/inline-block/);
    expect(wraps[1]!.className).toMatch(/\bblock\b/);
  });
});

describe("Dashboard", () => {
  it("searching finds projects and visualisations together, and says what it found", async () => {
    const { s } = await seed();
    renderWith(s, <DashboardView />);
    await userEvent.type(await screen.findByRole("searchbox", { name: "Search projects and visualisations" }), "onboard");
    expect(await screen.findByText(/0 projects and 1 visualisation match/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Onboarding flow" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recent projects" })).toBeNull();

    await userEvent.clear(screen.getByRole("searchbox"));
    await userEvent.type(screen.getByRole("searchbox"), "research");
    // "Research" also matches the visualisation that lives in that project
    expect(await screen.findByText(/1 project and 1 visualisation match/)).toBeInTheDocument();
  });

  it("matches descriptions and the project a visualisation lives in, ignoring case and accents", async () => {
    const { s } = await seed();
    renderWith(s, <DashboardView />);
    const box = await screen.findByRole("searchbox");
    await userEvent.type(box, "SIGN-UP");
    expect(await screen.findByRole("link", { name: "Onboarding flow" })).toBeInTheDocument();
    await userEvent.clear(box);
    await userEvent.type(box, "spring release");
    expect(await screen.findByText(/1 project/)).toBeInTheDocument();
    await userEvent.clear(box);
    await userEvent.type(box, "research mind map"); // project name + type words
    expect(await screen.findByRole("link", { name: "Interview themes" })).toBeInTheDocument();
  });

  it("explains an empty search and lets you clear it", async () => {
    const { s } = await seed();
    renderWith(s, <DashboardView />);
    await userEvent.type(await screen.findByRole("searchbox"), "zzzz");
    expect(await screen.findByRole("heading", { name: "No matches" })).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Clear search" }).at(-1)!);
    expect(await screen.findByRole("heading", { name: "All projects (2)" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });

  it("sorts projects, and remembers the choice for next time", async () => {
    const { s } = await seed();
    const first = renderWith(s, <DashboardView />);
    const all = () => within(screen.getByRole("list", { name: "All projects" })).getAllByRole("link").map((l) => l.textContent);
    await waitFor(() => expect(all()).toHaveLength(2)); // default order is by last change, which depends on timing
    await userEvent.selectOptions(screen.getByLabelText("Sort"), "name");
    expect(all()).toEqual(["Product launch", "Research"]);
    await userEvent.selectOptions(screen.getByLabelText("Sort"), "name-desc");
    expect(all()).toEqual(["Research", "Product launch"]);
    expect(JSON.parse(localStorage.getItem("vizora-project-sort")!)).toBe("name-desc");
    await userEvent.selectOptions(screen.getByLabelText("Sort"), "size");
    expect(all()).toEqual(["Product launch", "Research"]); // 3 visualisations vs 1
    first.unmount();
    renderWith(s, <DashboardView />);
    await waitFor(() => expect(screen.getByLabelText("Sort")).toHaveValue("size"));
  });

  it("duplicates a project with all its visualisations", async () => {
    const { s, product } = await seed();
    renderWith(s, <DashboardView />);
    await userEvent.click((await screen.findAllByRole("button", { name: "Actions for Product launch" }))[0]!);
    await userEvent.click(await screen.findByRole("menuitem", { name: /Duplicate project/ }));
    await waitFor(async () => expect((await s.projects.list()).map((p) => p.name)).toContain("Product launch (copy)"));
    const copy = (await s.projects.list()).find((p) => p.name === "Product launch (copy)")!;
    expect(await s.visualisations.listByProject(copy.id)).toHaveLength(3);
    expect(await s.visualisations.listByProject(product.id)).toHaveLength(3); // the original is untouched
  });

  it("downloads a project backup", async () => {
    const { s } = await seed();
    renderWith(s, <DashboardView />);
    await userEvent.click((await screen.findAllByRole("button", { name: "Actions for Research" }))[0]!);
    await userEvent.click(await screen.findByRole("menuitem", { name: /Download backup/ }));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Blob;
    const backup = JSON.parse(await blob.text());
    expect(backup.format).toBe("vizora-backup");
    expect(backup.projects).toHaveLength(1);
    expect(backup.projects[0].name).toBe("Research");
  });

  it("deleting a project explains it is permanent and offers a backup first", async () => {
    const { s, research } = await seed();
    renderWith(s, <DashboardView />);
    await userEvent.click((await screen.findAllByRole("button", { name: "Actions for Research" }))[0]!);
    await userEvent.click(await screen.findByRole("menuitem", { name: /Delete project/ }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/1 visualisation/);
    expect(dialog).toHaveTextContent(/not stored anywhere else/);
    expect(within(dialog).getByRole("button", { name: /Download a backup of this project first/ })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(await s.projects.get(research.id)).toBeDefined();
  });

  describe("importing a backup", () => {
    const upload = async (text: string, name = "backup.json") => {
      const input = document.querySelector('input[aria-label="Choose a Vizora backup file"]') as HTMLInputElement;
      await userEvent.upload(input, new File([text], name, { type: "application/json" }));
    };

    it("previews what is in the file, imports it into an empty library", async () => {
      const { s, research } = await seed();
      const backup = JSON.stringify(await s.backup.exportProject(research.id));
      const target = createTestStorage();
      renderWith(target, <DashboardView />);
      await screen.findByRole("heading", { name: "Create your first project" });
      await upload(backup);
      const drawer = await screen.findByRole("dialog", { name: "Import backup" });
      expect(drawer).toHaveTextContent(/valid Vizora backup/);
      expect(within(drawer).getByText("Research")).toBeInTheDocument();
      expect(drawer).toHaveTextContent(/1 visualisation · new/);
      expect(await target.projects.list()).toEqual([]); // nothing written until confirmed
      await userEvent.click(within(drawer).getByRole("button", { name: "Import" }));
      await waitFor(async () => expect((await target.projects.list()).map((p) => p.name)).toEqual(["Research"]));
    });

    it("names what already exists and lets you keep both or skip, never overwriting", async () => {
      const { s, research } = await seed();
      const backup = JSON.stringify(await s.backup.exportProject(research.id));
      await s.projects.update(research.id, { name: "Research (edited here)" });
      renderWith(s, <DashboardView />);
      await screen.findByRole("heading", { name: /All projects/ });
      await upload(backup);
      const drawer = await screen.findByRole("dialog", { name: "Import backup" });
      const existing = within(drawer).getByRole("list", { name: "Items that already exist" });
      expect(existing).toHaveTextContent("Research");
      expect(existing).toHaveTextContent("Interview themes");
      await userEvent.click(within(drawer).getByRole("radio", { name: /Skip them/ }));
      await userEvent.click(within(drawer).getByRole("button", { name: "Import" }));
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Import backup" })).toBeNull());
      expect((await s.projects.get(research.id))!.name).toBe("Research (edited here)");
      expect(await s.projects.list()).toHaveLength(2);
    });

    it("refuses a file that is not a valid backup, with a reason, and writes nothing", async () => {
      const { s } = await seed();
      renderWith(s, <DashboardView />);
      await screen.findByRole("heading", { name: /All projects/ });
      await upload("{not json");
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Import backup" })).toBeNull());
      await upload(JSON.stringify({ hello: "world" }));
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Import backup" })).toBeNull());
      expect(await s.projects.list()).toHaveLength(2);
    });
  });
});

describe("Recent page", () => {
  it("shows recent projects and visualisations, newest first, with how recently they changed", async () => {
    const { s } = await seed();
    renderWith(s, <RecentView />);
    const projects = (await screen.findByRole("heading", { name: "Recent projects" })).closest("section")!;
    expect(within(projects).getAllByRole("link").map((l) => l.textContent).sort()).toEqual(["Product launch", "Research"]);
    const viz = screen.getByRole("heading", { name: "Recent visualisations" }).closest("section")!;
    expect(within(viz).getByText("Interview themes")).toBeInTheDocument();
    expect(within(viz).getAllByText(/Edited just now/).length).toBeGreaterThan(0);
    expect(within(viz).getByText("Research")).toBeInTheDocument(); // which project it belongs to
  });
  it("explains itself when there is nothing yet", async () => {
    renderWith(createTestStorage(), <RecentView />);
    expect(await screen.findByRole("heading", { name: "Nothing recent yet" })).toBeInTheDocument();
  });
  it("is in the sidebar navigation", async () => {
    const { APP_NAV } = await import("@/components/layout/nav-items");
    expect(APP_NAV.map((n) => [n.label, n.href])).toContainEqual(["Recent", "/app/recent"]);
  });
});

describe("Project page", () => {
  const rowTitles = () => within(screen.getByRole("list", { name: "Visualisations" })).getAllByRole("heading", { level: 3 }).map((h) => h.textContent!.replace(/\s*\(position.*$/, ""));

  it("shows the project's created and updated dates and what it contains", async () => {
    const { s, product } = await seed();
    renderWith(s, <ProjectView projectId={product.id} />);
    const details = await screen.findByRole("definition", { name: "" }).catch(() => screen.getByLabelText("Project details"));
    expect(details).toHaveTextContent(/Created/);
    expect(details).toHaveTextContent(/Updated/);
    expect(details).toHaveTextContent(/3 visualisations/);
    for (const kind of ["1 flowchart", "1 timeline", "1 chart"]) expect(details).toHaveTextContent(kind);
  });

  it("lists in my order by default and reorders with accessible controls, persisting the order", async () => {
    const { s, product, roadmap } = await seed();
    renderWith(s, <ProjectView projectId={product.id} />);
    await waitFor(() => expect(rowTitles()).toEqual(["Onboarding flow", "Roadmap", "Revenue"]));
    expect(screen.getByRole("button", { name: "Move “Onboarding flow” up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move “Revenue” down" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Move “Revenue” up" }));
    await waitFor(() => expect(rowTitles()).toEqual(["Onboarding flow", "Revenue", "Roadmap"]));
    expect(screen.getByRole("status")).toHaveTextContent("Moved “Revenue” to position 2 of 3.");
    await userEvent.click(screen.getByRole("button", { name: "Move “Roadmap” up" }));
    await waitFor(() => expect(rowTitles()).toEqual(["Onboarding flow", "Roadmap", "Revenue"]));
    // persisted, not just on screen
    const order = (await s.visualisations.listByProject(product.id)).sort((a, b) => a.order! - b.order!).map((v) => v.title);
    expect(order).toEqual(["Onboarding flow", "Roadmap", "Revenue"]);
    expect(roadmap.id).toBeTruthy();
  });

  it("rearranging is only offered when it makes sense", async () => {
    const { s, product } = await seed();
    renderWith(s, <ProjectView projectId={product.id} />);
    await screen.findByRole("list", { name: "Visualisations" });
    await userEvent.selectOptions(screen.getByLabelText("Sort"), "name");
    expect(screen.queryByRole("button", { name: /Move “.*” up/ })).toBeNull();
    expect(screen.getByText(/Choose “My order” to rearrange/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Sort"), "custom");
    await userEvent.type(screen.getByRole("searchbox", { name: "Search this project" }), "road");
    expect(screen.queryByRole("button", { name: /Move “.*” up/ })).toBeNull();
    expect(screen.getByText(/Clear the search to rearrange/)).toBeInTheDocument();
  });

  it("searches within the project and sorts it", async () => {
    const { s, product } = await seed();
    renderWith(s, <ProjectView projectId={product.id} />);
    await screen.findByRole("list", { name: "Visualisations" });
    await userEvent.selectOptions(screen.getByLabelText("Sort"), "name");
    expect(rowTitles()).toEqual(["Onboarding flow", "Revenue", "Roadmap"]);
    await userEvent.type(screen.getByRole("searchbox"), "r");
    await waitFor(() => expect(rowTitles().length).toBeGreaterThan(0));
    await userEvent.clear(screen.getByRole("searchbox"));
    await userEvent.type(screen.getByRole("searchbox"), "nothing like this");
    expect(await screen.findByRole("heading", { name: "No matches" })).toBeInTheDocument();
  });

  it("renames a visualisation", async () => {
    const { s, product, roadmap } = await seed();
    renderWith(s, <ProjectView projectId={product.id} />);
    await userEvent.click(await screen.findByRole("button", { name: "Actions for Roadmap" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));
    const drawer = await screen.findByRole("dialog", { name: "Rename visualisation" });
    await userEvent.clear(within(drawer).getByLabelText("Title"));
    await userEvent.type(within(drawer).getByLabelText("Title"), "Q3 roadmap");
    await userEvent.click(within(drawer).getByRole("button", { name: "Rename" }));
    await waitFor(async () => expect((await s.visualisations.get(roadmap.id))!.document.title).toBe("Q3 roadmap"));
    await waitFor(() => expect(rowTitles()).toContain("Q3 roadmap"));
  });

  it("a rename never overwrites a change made elsewhere: it is refused with an explanation", async () => {
    const { s, product, roadmap } = await seed();
    renderWith(s, <ProjectView projectId={product.id} />);
    await userEvent.click(await screen.findByRole("button", { name: "Actions for Roadmap" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));
    // Another tab saves while the drawer is open.
    await s.visualisations.save(roadmap.id, { ...roadmap.document, title: "Changed in another tab" }, { expectedRevision: 1 });
    const drawer = await screen.findByRole("dialog", { name: "Rename visualisation" });
    await userEvent.clear(within(drawer).getByLabelText("Title"));
    await userEvent.type(within(drawer).getByLabelText("Title"), "My rename");
    await userEvent.click(within(drawer).getByRole("button", { name: "Rename" }));
    expect(await within(drawer).findByRole("alert")).toHaveTextContent(/changed in another tab or window/);
    expect((await s.visualisations.get(roadmap.id))!.document.title).toBe("Changed in another tab");
  });

  it("a blank title is not accepted", async () => {
    const { s, product } = await seed();
    renderWith(s, <ProjectView projectId={product.id} />);
    await userEvent.click(await screen.findByRole("button", { name: "Actions for Roadmap" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));
    const drawer = await screen.findByRole("dialog", { name: "Rename visualisation" });
    await userEvent.clear(within(drawer).getByLabelText("Title"));
    await userEvent.click(within(drawer).getByRole("button", { name: "Rename" }));
    expect(await within(drawer).findByRole("alert")).toHaveTextContent("Title is required");
  });

  it("moves a visualisation to another project", async () => {
    const { s, product, research, revenue } = await seed();
    renderWith(s, <ProjectView projectId={product.id} />);
    await userEvent.click(await screen.findByRole("button", { name: "Actions for Revenue" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Move to another project/ }));
    const drawer = await screen.findByRole("dialog", { name: "Move to another project" });
    expect(within(drawer).getByRole("button", { name: "Move" })).toBeDisabled();
    expect(within(drawer).queryByRole("option", { name: "Product launch" })).toBeNull(); // not its own project
    await userEvent.selectOptions(within(drawer).getByLabelText("Project"), research.id);
    await userEvent.click(within(drawer).getByRole("button", { name: "Move" }));
    await waitFor(async () => expect((await s.visualisations.get(revenue.id))!.projectId).toBe(research.id));
    await waitFor(() => expect(rowTitles()).toEqual(["Onboarding flow", "Roadmap"]));
    expect((await s.visualisations.get(revenue.id))!.document.title).toBe("Revenue"); // untouched
  });

  it("offers only the exports that apply to each visualisation", async () => {
    const { s, product } = await seed();
    renderWith(s, <ProjectView projectId={product.id} />);
    await userEvent.click(await screen.findByRole("button", { name: "Actions for Onboarding flow" }));
    expect(await screen.findByRole("menuitem", { name: /Export as PNG image/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Export as SVG image/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Export as Vizora JSON/ })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /PDF/ })).toBeNull(); // PDF is for dashboards
    await userEvent.click(screen.getByRole("menuitem", { name: /Export as Vizora JSON/ }));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
  });

  it("an empty chart can still be exported as JSON but not as an image", async () => {
    const { s, product } = await seed();
    renderWith(s, <ProjectView projectId={product.id} />);
    await userEvent.click(await screen.findByRole("button", { name: "Actions for Revenue" }));
    expect(await screen.findByRole("menuitem", { name: /Export as Vizora JSON/ })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /PNG/ })).toBeNull();
  });

  it("duplicates a visualisation, deletes with confirmation, and duplicates the whole project", async () => {
    const { s, product } = await seed();
    renderWith(s, <ProjectView projectId={product.id} />);
    await userEvent.click(await screen.findByRole("button", { name: "Actions for Roadmap" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Duplicate" }));
    await waitFor(() => expect(rowTitles()).toEqual(["Onboarding flow", "Roadmap", "Roadmap (copy)", "Revenue"]));

    await userEvent.click(screen.getByRole("button", { name: "Actions for Roadmap (copy)" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete visualisation" }));
    await waitFor(() => expect(rowTitles()).toEqual(["Onboarding flow", "Roadmap", "Revenue"]));

    await userEvent.click(screen.getByRole("button", { name: /^Duplicate$/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/app\/dashboard\/.+/)));
    expect((await s.projects.list()).map((p) => p.name)).toContain("Product launch (copy)");
  });

  it("downloads a project backup from the project page", async () => {
    const { s, product } = await seed();
    renderWith(s, <ProjectView projectId={product.id} />);
    await userEvent.click(await screen.findByRole("button", { name: /^Backup$/ }));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
  });
});

describe("Storage panel", () => {
  it("shows counts, size and a per-project breakdown, and says plainly that nothing is backed up", async () => {
    const { s } = await seed();
    renderWith(s, <StoragePanel />);
    const summary = await screen.findByRole("definition", { name: "" }).catch(() => screen.getByLabelText("Storage summary"));
    await waitFor(() => expect(summary).toHaveTextContent(/Projects\s*2/));
    expect(summary).toHaveTextContent(/Visualisations\s*4/);
    expect(summary).toHaveTextContent(/Approximate size\s*\d/);
    expect(screen.getByRole("note")).toHaveTextContent(/only in this browser/);
    expect(screen.getByRole("note")).toHaveTextContent(/not backed up/);
    expect(screen.getByRole("note").textContent).not.toMatch(/synced|cloud backup|saved to your account/i);
    const table = screen.getByRole("table", { name: "Space used by each project" });
    expect(within(table).getByText("Product launch")).toBeInTheDocument();
    expect(within(table).getByText("Research")).toBeInTheDocument();
  });

  it("updates when work is saved", async () => {
    const { s, research } = await seed();
    renderWith(s, <StoragePanel />);
    const summary = await screen.findByLabelText("Storage summary");
    await waitFor(() => expect(summary).toHaveTextContent(/Visualisations\s*4/));
    await act(async () => {
      await s.visualisations.create(research.id, doc("Another"));
    });
    await waitFor(() => expect(summary).toHaveTextContent(/Visualisations\s*5/));
  });

  it("downloads a full backup", async () => {
    const { s } = await seed();
    renderWith(s, <StoragePanel />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Download backup/ })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: /Download backup/ }));
    await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
    const backup = JSON.parse(await ((URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Blob).text());
    expect(backup.projects).toHaveLength(2);
    expect(backup.visualisations).toHaveLength(4);
  });

  it("clearing needs an explicit typed confirmation; nothing is deleted until then", async () => {
    const { s } = await seed();
    renderWith(s, <StoragePanel />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Clear local data/ })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: /Clear local data/ }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete all local data?" });
    expect(dialog).toHaveTextContent(/2 projects and 4 visualisations/);
    expect(dialog).toHaveTextContent(/cannot be recovered/);
    const confirm = within(dialog).getByRole("button", { name: "Delete everything" });
    expect(confirm).toBeDisabled();
    for (const wrong of ["delete", "DELET", "DELETE ", "yes"]) {
      await userEvent.clear(within(dialog).getByLabelText(/Type DELETE/));
      await userEvent.type(within(dialog).getByLabelText(/Type DELETE/), wrong);
      expect(confirm, wrong).toBeDisabled();
    }
    expect(await s.projects.list()).toHaveLength(2);
    // cancelling leaves everything, and the typed word does not linger
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(await s.projects.list()).toHaveLength(2);
  });

  it("with the right word, everything is deleted and the panel reflects it", async () => {
    const { s } = await seed();
    renderWith(s, <StoragePanel />);
    await waitFor(() => expect(screen.getByRole("button", { name: /Clear local data/ })).toBeEnabled());
    await userEvent.click(screen.getByRole("button", { name: /Clear local data/ }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.type(within(dialog).getByLabelText(/Type DELETE/), "DELETE");
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete everything" }));
    await waitFor(async () => expect(await s.projects.list()).toEqual([]));
    expect(await s.visualisations.listAll()).toEqual([]);
    await waitFor(() => expect(screen.getByLabelText("Storage summary")).toHaveTextContent(/Projects\s*0/));
    expect(screen.getByRole("button", { name: /Clear local data/ })).toBeDisabled(); // nothing left to clear
    expect(screen.getByRole("button", { name: /Download backup/ })).toBeDisabled();
  });
});

describe("Workspace frame", () => {
  function Harness() {
    const chrome = useWorkspaceChrome();
    return (
      <>
        <PanelControls chrome={chrome} left="Data" right="Settings" />
        <input aria-label="A text field" />
        <WorkspaceFrame chrome={chrome} centreLabel="Chart" left={{ label: "Data", tab: "Data", node: <p>left content</p> }} right={{ label: "Settings", tab: "Settings", node: <p>right content</p> }} centre={<main aria-label="Canvas">canvas</main>} />
      </>
    );
  }
  const left = () => screen.getByRole("complementary", { name: "Data" });
  const right = () => screen.getByRole("complementary", { name: "Settings" });
  const press = (key: string, target: Element = document.body) => fireEvent.keyDown(target, { key });

  it("starts with both panels open and collapses each one, exposing the state", async () => {
    render(<Harness />);
    expect(left()).toHaveAttribute("data-state", "open");
    await userEvent.click(screen.getByRole("button", { name: "Hide Data panel" }));
    expect(left()).toHaveAttribute("data-state", "collapsed");
    expect(screen.getByRole("button", { name: "Show Data panel" })).toHaveAttribute("aria-expanded", "false");
    expect(right()).toHaveAttribute("data-state", "open"); // independent
    await userEvent.click(screen.getByRole("button", { name: "Show Data panel" }));
    expect(left()).toHaveAttribute("data-state", "open");
    await userEvent.click(screen.getByRole("button", { name: "Hide Settings panel" }));
    expect(right()).toHaveAttribute("data-state", "collapsed");
  });

  it("collapsing keeps the content in the page, so nothing is lost or re-created", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Hide Data panel" }));
    expect(screen.getByText("left content")).toBeInTheDocument();
  });

  it("remembers the panels in this browser", async () => {
    const first = render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Hide Settings panel" }));
    expect(JSON.parse(localStorage.getItem("vizora-panels")!)).toEqual({ left: true, right: false });
    first.unmount();
    render(<Harness />);
    await waitFor(() => expect(right()).toHaveAttribute("data-state", "collapsed"));
    expect(left()).toHaveAttribute("data-state", "open");
  });

  it("keyboard: [ and ] toggle the panels", () => {
    render(<Harness />);
    press("[");
    expect(left()).toHaveAttribute("data-state", "collapsed");
    press("]");
    expect(right()).toHaveAttribute("data-state", "collapsed");
    press("[");
    expect(left()).toHaveAttribute("data-state", "open");
  });

  it("shortcuts are ignored while typing in a field", async () => {
    render(<Harness />);
    const field = screen.getByLabelText("A text field");
    press("[", field);
    press("f", field);
    expect(left()).toHaveAttribute("data-state", "open");
    expect(screen.getByRole("button", { name: "Full-screen canvas (F)" })).toHaveAttribute("aria-pressed", "false");
  });

  it("full-screen canvas hides both panels, F and Escape leave it, and panel choices survive", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Hide Data panel" }));
    const fs = screen.getByRole("button", { name: "Full-screen canvas (F)" });
    await userEvent.click(fs);
    expect(fs).toHaveAttribute("aria-pressed", "true");
    expect(left()).toHaveClass("hidden");
    expect(right()).toHaveClass("hidden");
    expect(screen.queryByRole("group", { name: "Workspace panels" })).toBeNull(); // no small-screen switcher either
    press("Escape");
    await waitFor(() => expect(fs).toHaveAttribute("aria-pressed", "false"));
    expect(left()).toHaveAttribute("data-state", "collapsed"); // as the user left it
    expect(right()).toHaveAttribute("data-state", "open");
    press("f");
    expect(fs).toHaveAttribute("aria-pressed", "true");
    press("f");
    expect(fs).toHaveAttribute("aria-pressed", "false");
  });

  it("full screen is never remembered: you always arrive to a normal workspace", async () => {
    const first = render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Full-screen canvas (F)" }));
    first.unmount();
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Full-screen canvas (F)" })).toHaveAttribute("aria-pressed", "false");
  });

  it("small screens keep the one-panel-at-a-time switcher", async () => {
    render(<Harness />);
    const group = screen.getByRole("group", { name: "Workspace panels" });
    await userEvent.click(within(group).getByRole("button", { name: "Settings" }));
    expect(within(group).getByRole("button", { name: "Settings" })).toHaveAttribute("aria-pressed", "true");
    expect(right()).not.toHaveClass("hidden");
    expect(left()).toHaveClass("hidden");
  });
});

describe("usePersistentState", () => {
  function Probe({ k }: { k: string }) {
    const [v, set] = usePersistentState(k, "a", (x): x is string => typeof x === "string");
    return <button onClick={() => set("b")}>{v}</button>;
  }
  it("adopts a saved value, ignores junk, and still works when storage is blocked", async () => {
    localStorage.setItem("k1", JSON.stringify("saved"));
    const { unmount } = render(<Probe k="k1" />);
    expect(await screen.findByRole("button", { name: "saved" })).toBeInTheDocument();
    unmount();
    localStorage.setItem("k2", JSON.stringify(42));
    localStorage.setItem("k3", "not json {");
    render(<><Probe k="k2" /><Probe k="k3" /></>);
    expect(screen.getAllByRole("button", { name: "a" })).toHaveLength(2);
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    await userEvent.click(screen.getAllByRole("button")[0]!);
    expect(screen.getAllByRole("button", { name: "b" })).toHaveLength(1); // applied for this session
    spy.mockRestore();
  });
});

void names;

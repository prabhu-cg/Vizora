import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCallback, useRef, useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { TableCentre, TableSettings } from "@/features/tables/table-workspace";
import { buildDataset, readText } from "@/lib/data";
import { readTableConfig } from "@/lib/tables";
import { creatableTypes, hasRenderer } from "@/components/visualisations/registry";
import { createVisualisation } from "@/lib/visualisation/factory";
import type { VisualisationIR } from "@/types/visualisation";

beforeEach(() => localStorage.clear());

const ds = (csv: string) => buildDataset(readText(csv), {}, () => "d").dataset;
const CSV = ["name,team,score", ...Array.from({ length: 60 }, (_, i) => `P${String(i).padStart(2, "0")},${i % 2 ? "Ops" : "Eng"},${(i * 37) % 101}`)].join("\n");
const make = (csv = CSV): VisualisationIR => ({ ...createVisualisation({ title: "People", type: "table" }), data: { datasets: [ds(csv)] } });

function Harness({ initial }: { initial: VisualisationIR }) {
  const [doc, setDoc] = useState(initial);
  const ref = useRef(doc);
  const update = useCallback((u: (d: VisualisationIR) => VisualisationIR) => {
    const next = u(ref.current);
    if (next === ref.current) return;
    ref.current = next;
    setDoc(next);
  }, []);
  return (
    <>
      <pre data-testid="cfg">{JSON.stringify(doc.configuration.options.table ?? null)}</pre>
      <TableCentre doc={doc} update={update} onAddData={() => undefined} />
      <TableSettings doc={doc} update={update} />
    </>
  );
}
const saved = () => readTableConfig({ table: JSON.parse(screen.getByTestId("cfg").textContent!) });
const firstColumn = () => within(screen.getByRole("table")).getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[1]!.textContent);

describe("table is a type you can create", () => {
  it("is offered when creating and has an editor", () => {
    expect(creatableTypes()).toContain("table");
    expect(hasRenderer("table")).toBe(true);
  });
});

describe("table workspace", () => {
  it("shows the first page, the row count, and pages through the rest", async () => {
    render(<Harness initial={make()} />);
    expect(firstColumn()).toHaveLength(25);
    expect(firstColumn()[0]).toBe("P00");
    expect(screen.getByText(/60 of 60 rows/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(firstColumn()[0]).toBe("P25");
    await userEvent.click(screen.getByRole("button", { name: /Previous/ }));
    expect(firstColumn()[0]).toBe("P00");
  });

  it("clicking a header sorts, again reverses, a third time clears; the choice is saved", async () => {
    render(<Harness initial={make()} />);
    const head = screen.getByRole("button", { name: "score, sort" });
    await userEvent.click(head);
    expect(saved().sort).toEqual({ key: "score", dir: "asc" });
    expect(screen.getByRole("columnheader", { name: /score/ })).toHaveAttribute("aria-sort", "ascending");
    await userEvent.click(head);
    expect(saved().sort).toEqual({ key: "score", dir: "desc" });
    expect(screen.getByRole("columnheader", { name: /score/ })).toHaveAttribute("aria-sort", "descending");
    await userEvent.click(head);
    expect(saved().sort).toBeUndefined();
  });

  it("searching narrows the rows without saving anything", async () => {
    render(<Harness initial={make()} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search rows" }), "P07");
    expect(firstColumn()).toEqual(["P07"]);
    expect(screen.getByText(/1 of 60 rows/)).toBeInTheDocument();
    expect(screen.getByTestId("cfg")).toHaveTextContent("null");
    await userEvent.clear(screen.getByRole("searchbox"));
    await userEvent.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText("No rows match your search.")).toBeInTheDocument();
  });

  it("hiding a column removes it from the table, and bringing it back restores it", async () => {
    render(<Harness initial={make()} />);
    await userEvent.click(within(screen.getByRole("list", { name: "Columns shown, in order" })).getByRole("checkbox", { name: "team" }));
    expect(screen.queryByRole("columnheader", { name: /team/ })).toBeNull();
    expect(saved().columns).toEqual(["name", "score"]);
    await userEvent.click(screen.getByRole("checkbox", { name: /team \(hidden\)/ }));
    expect(screen.getByRole("columnheader", { name: /team/ })).toBeInTheDocument();
  });

  it("reorders columns", async () => {
    render(<Harness initial={make()} />);
    await userEvent.click(screen.getByRole("button", { name: "Move name right" }));
    expect(saved().columns).toEqual(["team", "name", "score"]);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent!.replace(", sort", ""))[1]).toBe("team");
    expect(screen.getByRole("button", { name: "Move team left" })).toBeDisabled();
  });

  it("rows per page and spacing change the layout", async () => {
    render(<Harness initial={make()} />);
    await userEvent.selectOptions(screen.getByLabelText("Rows per page"), "10");
    expect(firstColumn()).toHaveLength(10);
    expect(screen.getByText("Page 1 of 6")).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Row spacing"), "compact");
    expect(saved().density).toBe("compact");
    expect(within(screen.getByRole("table")).getAllByRole("cell")[1]!.className).toMatch(/py-1\b/);
  });

  it("shades a numeric column: data bars scale to the column, colour scale uses tokens only", async () => {
    render(<Harness initial={make("n,v\nlow,0\nmid,50\nhigh,100")} />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "v" }), "bars");
    const cells = () => within(screen.getByRole("table")).getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[2] as HTMLElement);
    expect(cells()[0]!.style.backgroundImage).toContain("0%");
    expect(cells()[1]!.style.backgroundImage).toContain("50%");
    expect(cells()[2]!.style.backgroundImage).toContain("100%");
    expect(cells()[2]!.style.backgroundImage).toContain("var(--primary)"); // a design token, never a literal colour
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "v" }), "scale");
    expect(cells()[2]!.style.backgroundColor).toContain("var(--primary)");
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "v" }), "none");
    expect(cells()[2]!.style.backgroundImage).toBe("");
    expect(saved().formats).toEqual({});
  });

  it("filters rows from Settings and says how many were hidden", async () => {
    render(<Harness initial={make()} />);
    await userEvent.click(screen.getByText("Filters"));
    await userEvent.click(screen.getByRole("button", { name: "Add filter" }));
    await userEvent.selectOptions(screen.getByLabelText("Filter 1 column"), "team");
    await userEvent.type(screen.getByLabelText("Filter 1 value"), "Ops");
    await waitFor(() => expect(screen.getByText(/30 of 60 rows/)).toBeInTheDocument());
    expect(screen.getByText(/30 rows are hidden by filters/)).toBeInTheDocument();
    expect(saved().filters).toEqual([{ column: "team", op: "eq", value: "Ops" }]);
  });

  it("without data it explains what to do", () => {
    render(<Harness initial={createVisualisation({ title: "Empty", type: "table" })} />);
    expect(screen.getByRole("heading", { name: "No data to show yet" })).toBeInTheDocument();
    expect(screen.getByText("Table settings appear here once you add data.")).toBeInTheDocument();
  });

  it("a long page is scrollable and labelled for assistive technology", () => {
    render(<Harness initial={make()} />);
    const region = screen.getByRole("region", { name: "People, scrollable" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("table")).toHaveAccessibleName("People");
    void act;
  });
});

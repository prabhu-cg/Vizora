import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCallback, useEffect, useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import DataWorkspace from "@/components/workspace/data-workspace";
import { DataTable } from "@/features/data/data-table";
import { ImportDataDrawer } from "@/features/data/import-drawer";
import { readChartConfig, readDashboard } from "@/lib/charts";
import { createVisualisation } from "@/lib/visualisation/factory";
import type { Dataset, VisualisationIR } from "@/types/visualisation";
import { xlsxFile } from "../xlsx";

// jsdom has no canvas, so ECharts cannot draw. The chart's *data and options* are covered by unit tests.
vi.mock("@/features/charts/chart-view", () => ({
  ChartView: ({ label, data }: { label: string; data: { categories: string[] } }) => <div role="img" aria-label={label} data-categories={data.categories.join("|")} />,
}));

const paste = async (text: string) => {
  const box = await screen.findByLabelText("Paste your data");
  await userEvent.click(box);
  await userEvent.paste(text);
};

describe("ImportDataDrawer", () => {
  const open = (onAdd = vi.fn()) => {
    render(<ImportDataDrawer open onOpenChange={() => undefined} onAdd={onAdd} />);
    return onAdd;
  };

  it("pasted spreadsheet data: previews rows, columns and types, then adds a typed dataset", async () => {
    const onAdd = open();
    await userEvent.click(await screen.findByRole("radio", { name: "Paste data" }));
    await paste("Month\tRevenue\nJan\t120\nFeb\t150");
    await waitFor(() => expect(screen.getByText(/% complete/)).toHaveTextContent(/2\s*rows.*2\s*columns/));
    expect(screen.getByRole("table", { name: /First 2 rows/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add dataset" }));
    const [dataset, source] = onAdd.mock.calls[0] as [Dataset, { format: string }];
    expect(dataset).toMatchObject({ name: "Pasted data", origin: "paste", columns: [{ key: "Month", type: "string" }, { key: "Revenue", type: "number" }] });
    expect(dataset.rows).toEqual([{ Month: "Jan", Revenue: 120 }, { Month: "Feb", Revenue: 150 }]);
    expect(source.format).toBe("paste");
  });

  it("lets you override a column's detected type, and explains what that does", async () => {
    const onAdd = open();
    await userEvent.click(await screen.findByRole("radio", { name: "Paste data" }));
    await paste("code,note\n1,x\n2,y\n3,z");
    await waitFor(() => screen.getByLabelText("How to read column code"));
    await userEvent.selectOptions(screen.getByLabelText("How to read column code"), "string");
    await userEvent.selectOptions(screen.getByLabelText("How to read column note"), "number");
    expect(await screen.findByText(/3 values could not be read as number/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add dataset" }));
    const [dataset] = onAdd.mock.calls[0] as [Dataset];
    expect(dataset.columns.map((c) => c.type)).toEqual(["string", "number"]);
    expect(dataset.rows[0]).toEqual({ code: "1", note: null });
  });

  it("invalid data is explained and cannot be added", async () => {
    const onAdd = open();
    await userEvent.click(await screen.findByRole("radio", { name: "Paste data" }));
    await paste("{oops");
    expect(await screen.findByRole("alert")).toHaveTextContent(/not valid JSON/);
    expect(screen.getByRole("button", { name: "Add dataset" })).toBeDisabled();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("offers to remove duplicate rows from the copy, and does so on request", async () => {
    const onAdd = open();
    await userEvent.click(await screen.findByRole("radio", { name: "Paste data" }));
    await paste("a,b\n1,x\n1,x\n2,y");
    const box = await screen.findByRole("checkbox", { name: /Remove duplicate rows/ });
    expect(await screen.findByText(/1 row is a duplicate/)).toBeInTheDocument();
    await userEvent.click(box);
    await userEvent.click(screen.getByRole("button", { name: "Add dataset" }));
    expect((onAdd.mock.calls[0] as [Dataset])[0].rows).toHaveLength(2);
  });

  it("Excel: reads the workbook, offers each sheet, records a checksum, and never touches the file", async () => {
    const onAdd = open();
    const file = xlsxFile([
      { name: "Sales", rows: [["Month", "Revenue"], ["Jan", 120], ["Feb", 150]] },
      { name: "Costs", rows: [["Item", "Amount"], ["Rent", 900], ["Power", 120], ["Staff", 5000]] },
    ], "book.xlsx");
    await userEvent.upload(await screen.findByLabelText(/Choose a file/i, { selector: "input" }).catch(() => document.querySelector("input[type=file]")!) as HTMLInputElement, file);
    expect(await screen.findByRole("status")).toHaveTextContent(/book\.xlsx/);
    const sheet = await screen.findByLabelText("Sheet");
    expect(within(sheet).getAllByRole("option").map((o) => o.textContent)).toEqual(["Sales", "Costs"]);
    await userEvent.selectOptions(sheet, "Costs");
    await waitFor(() => expect(screen.getByText(/% complete/)).toHaveTextContent(/3\s*rows/));
    await userEvent.click(screen.getByRole("button", { name: "Add dataset" }));
    const [dataset, source] = onAdd.mock.calls[0] as [Dataset, { format: string; sha256: string; sheet: string }];
    expect(dataset.columns.map((c) => c.key)).toEqual(["Item", "Amount"]);
    expect(source).toMatchObject({ format: "xlsx" });
    expect(source.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects unsupported and corrupt files with a clear reason", async () => {
    const user = userEvent.setup({ applyAccept: false });
    open();
    const input = (await screen.findByRole("dialog")).querySelector("input[type=file]") as HTMLInputElement;
    await user.upload(input, new File([new TextEncoder().encode("a,b")], "old.xls"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/\.xls.*save as \.xlsx/i);
    await user.upload(input, new File([new TextEncoder().encode("a,b\n1,2")], "fake.xlsx"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/not a valid \.xlsx/));
    expect(screen.getByRole("button", { name: "Add dataset" })).toBeDisabled();
  });

  it("manual entry: type values into the grid, see what will be added, add it", async () => {
    const onAdd = open();
    await userEvent.click(await screen.findByRole("radio", { name: "Type it in" }));
    await userEvent.clear(screen.getByLabelText("Column 1 name"));
    await userEvent.type(screen.getByLabelText("Column 1 name"), "Fruit");
    await userEvent.type(screen.getByLabelText("Row 1, Fruit"), "Apple");
    await userEvent.type(screen.getByLabelText("Row 1, Column 2"), "3");
    await userEvent.type(screen.getByLabelText("Row 2, Fruit"), "Pear");
    await userEvent.type(screen.getByLabelText("Row 2, Column 2"), "1,200");
    expect(screen.getByText(/This will add/)).toHaveTextContent(/2 rows.*Fruit \(string\), Column 2 \(number\)/);
    await userEvent.click(screen.getByRole("button", { name: "Add dataset" }));
    const [dataset] = onAdd.mock.calls[0] as [Dataset];
    expect(dataset).toMatchObject({ origin: "manual" });
    expect(dataset.rows).toEqual([{ Fruit: "Apple", "Column 2": 3, "Column 3": null }, { Fruit: "Pear", "Column 2": 1200, "Column 3": null }]);
  });

  it("manual grid can add and remove rows and columns, and the Add button waits for data", async () => {
    open();
    await userEvent.click(await screen.findByRole("radio", { name: "Type it in" }));
    expect(screen.getByRole("button", { name: "Add dataset" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Add column" }));
    expect(screen.getByLabelText("Column 4 name")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove column Column 4" }));
    expect(screen.queryByLabelText("Column 4 name")).toBeNull();
    const rows = () => screen.getAllByRole("row").length;
    const before = rows();
    await userEvent.click(screen.getByRole("button", { name: "Add row" }));
    expect(rows()).toBe(before + 1);
    await userEvent.click(screen.getByRole("button", { name: "Remove row 1" }));
    expect(rows()).toBe(before);
  });
});

describe("DataTable", () => {
  const rows = Array.from({ length: 60 }, (_, i) => ({ name: `item ${String(i).padStart(2, "0")}`, qty: (i * 7) % 60 }));
  const cols = [{ key: "name", label: "Name" }, { key: "qty", label: "Qty", numeric: true }];
  const firstCell = () => within(screen.getAllByRole("row")[1]!).getAllByRole("cell")[1]!.textContent;

  it("paginates, and reports how many rows are shown", async () => {
    render(<DataTable columns={cols} rows={rows} caption="Test rows" pageSize={25} />);
    expect(screen.getByText("60 of 60 rows")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(firstCell()).toBe("item 25");
  });
  it("sorts by a column, exposing the order to assistive technology", async () => {
    render(<DataTable columns={cols} rows={rows} caption="Test rows" />);
    const qty = screen.getByRole("columnheader", { name: /Qty/ });
    expect(qty).toHaveAttribute("aria-sort", "none");
    await userEvent.click(within(qty).getByRole("button"));
    expect(qty).toHaveAttribute("aria-sort", "ascending");
    expect(within(screen.getAllByRole("row")[1]!).getAllByRole("cell")[2]!.textContent).toBe("0");
    await userEvent.click(within(qty).getByRole("button"));
    expect(qty).toHaveAttribute("aria-sort", "descending");
    expect(within(screen.getAllByRole("row")[1]!).getAllByRole("cell")[2]!.textContent).toBe("59");
    await userEvent.click(within(qty).getByRole("button"));
    expect(qty).toHaveAttribute("aria-sort", "none");
  });
  it("searches, and says when nothing matches; empty cells are announced", async () => {
    render(<DataTable columns={cols} rows={[...rows, { name: "blank", qty: null as unknown as number }]} caption="Test rows" />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Search rows" }), "item 07");
    expect(screen.getByText("1 of 61 rows")).toBeInTheDocument();
    await userEvent.clear(screen.getByRole("searchbox"));
    await userEvent.type(screen.getByRole("searchbox"), "blank");
    expect(screen.getByLabelText("empty")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText("No rows match.")).toBeInTheDocument();
  });
});

/** The real data workspace around an in-memory document. */
function Workspace({ initial, onDoc }: { initial: VisualisationIR; onDoc: (d: VisualisationIR) => void }) {
  const [doc, setDoc] = useState(initial);
  const ref = useRef(doc);
  const update = useCallback((u: (d: VisualisationIR) => VisualisationIR) => {
    const next = u(ref.current);
    if (next !== ref.current) {
      ref.current = next;
      setDoc(next);
    }
  }, []);
  useEffect(() => {
    onDoc(doc);
  }, [doc, onDoc]);
  return <DataWorkspace doc={doc} update={update} undo={() => undefined} redo={() => undefined} loadKey={0} />;
}

const SALES = "Month,Revenue,Costs\n2026-01-01,100,60\n2026-02-01,120,70\n2026-03-01,90,65";

async function addPasted(text: string) {
  await userEvent.click(screen.getAllByRole("button", { name: "Add data" })[0]!);
  const dialog = await screen.findByRole("dialog", { name: "Add data" });
  await userEvent.click(within(dialog).getByRole("radio", { name: "Paste data" }));
  await userEvent.click(within(dialog).getByLabelText("Paste your data"));
  await userEvent.paste(text);
  await waitFor(() => expect(within(dialog).getByRole("button", { name: "Add dataset" })).toBeEnabled());
  await userEvent.click(within(dialog).getByRole("button", { name: "Add dataset" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add data" })).toBeNull());
}

describe("chart workspace", () => {
  const setup = () => {
    let current!: VisualisationIR;
    render(<Workspace initial={createVisualisation({ title: "Sales", type: "chart" })} onDoc={(d) => { current = d; }} />);
    return () => current;
  };

  it("asks for data, then draws the recommended chart and says why", async () => {
    const doc = setup();
    expect(screen.getByRole("heading", { name: "Add data to see a chart" })).toBeInTheDocument();
    await addPasted(SALES);
    expect(doc().data.datasets).toHaveLength(1);
    expect(readChartConfig(doc().configuration.options)).toMatchObject({ kind: "multi-line", x: "Month", y: ["Revenue", "Costs"] });
    expect(await screen.findByRole("img", { name: /multi-line chart/ })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Chart recommendation" })).toHaveTextContent(/“Month” is a date and “Revenue” and “Costs” are numbers/);
  });

  it("switching to an alternative chart type is one click and is saved", async () => {
    const doc = setup();
    await addPasted(SALES);
    await userEvent.click(await screen.findByRole("button", { name: /^Area:/ }));
    expect(readChartConfig(doc().configuration.options)!.kind).toBe("area");
    expect(screen.getByRole("region", { name: "Chart recommendation" })).toHaveTextContent(/Recommended: Multi-series line/);
    await userEvent.click(screen.getByRole("button", { name: /Use multi-series line/ }));
    expect(readChartConfig(doc().configuration.options)!.kind).toBe("multi-line");
  });

  it("every chart setting is editable and persists in the document", async () => {
    const doc = setup();
    await addPasted(SALES);
    await screen.findByRole("img", { name: /chart/ });
    const cfg = () => readChartConfig(doc().configuration.options)!;

    await userEvent.type(screen.getByLabelText("Chart title"), "Quarterly");
    await userEvent.type(screen.getByLabelText("Y axis label"), "GBP");
    expect(cfg()).toMatchObject({ title: "Quarterly", yLabel: "GBP" });
    await userEvent.selectOptions(screen.getByLabelText("Aggregation"), "avg");
    expect(cfg().aggregation).toBe("avg");
    await userEvent.selectOptions(screen.getByLabelText("Group dates by"), "month");
    expect(cfg().timeBucket).toBe("month");
    await userEvent.click(screen.getByRole("checkbox", { name: "Show values on the chart" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Show tooltips on hover" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Show legend" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Smooth lines" }));
    expect(cfg()).toMatchObject({ dataLabels: true, tooltips: false, smooth: true, legend: { show: false } });
    await userEvent.selectOptions(screen.getByLabelText("Colour palette"), "colour-blind");
    expect(cfg().palette).toBe("colour-blind");
    fireEvent.change(screen.getByLabelText("Colour for Average of Revenue"), { target: { value: "#112233" } });
    expect(cfg().colors).toEqual({ "Average of Revenue": "#112233" });
    await userEvent.click(screen.getByRole("button", { name: "Reset colour for Average of Revenue" }));
    expect(cfg().colors).toEqual({});
    await userEvent.click(screen.getByRole("checkbox", { name: "Costs" })); // measures
    expect(cfg().y).toEqual(["Revenue"]);
    await userEvent.selectOptions(screen.getByLabelText("X axis (categories)"), "Month");
  });

  it("filters hide rows from the chart only, and the stage says how many", async () => {
    const doc = setup();
    await addPasted(SALES);
    await screen.findByRole("img", { name: /chart/ });
    await userEvent.click(screen.getByText(/^Filters/));
    await userEvent.click(screen.getByRole("button", { name: "Add filter" }));
    await userEvent.selectOptions(screen.getByLabelText("Filter 1 column"), "Revenue");
    await userEvent.selectOptions(screen.getByLabelText("Filter 1 condition"), "gte");
    await userEvent.type(screen.getByLabelText("Filter 1 value"), "100");
    expect(await screen.findByText(/2 of 3 rows used/)).toBeInTheDocument();
    expect(screen.getByText(/1 row is hidden by filters/)).toBeInTheDocument();
    expect(doc().data.datasets[0]!.rows).toHaveLength(3); // the data itself is untouched
    await userEvent.click(screen.getByRole("button", { name: "Remove filter 1" }));
    expect(await screen.findByText(/3 of 3 rows used/)).toBeInTheDocument();
  });

  it("explains an incomplete setup instead of drawing nonsense", async () => {
    setup();
    await addPasted(SALES);
    await userEvent.click(await screen.findByRole("radio", { name: "Scatter" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/numeric column for X/);
  });

  it("View data shows exactly the numbers plotted, the source rows, and a profile", async () => {
    setup();
    await addPasted(SALES);
    await userEvent.click(await screen.findByRole("button", { name: "View data" }));
    const drawer = await screen.findByRole("dialog");
    const plotted = within(drawer).getByRole("table", { name: "Values as plotted" });
    expect(within(plotted).getAllByRole("row")).toHaveLength(4);
    expect(within(plotted).getByText("100")).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole("tab", { name: "Source rows" }));
    expect(within(drawer).getByRole("table", { name: /Rows of/ })).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole("tab", { name: "Profile" }));
    expect(within(drawer).getByRole("table", { name: "Profile of each column" })).toHaveTextContent(/Revenue/);
  });

  it("Data panel: inspect, download, edit typed-in data, and remove with confirmation", async () => {
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    const doc = setup();
    await addPasted(SALES);
    const panel = screen.getByRole("complementary", { name: "Data" });
    expect(within(panel).queryByRole("button", { name: /^Edit/ })).toBeNull(); // pasted data is a copy of a file: read-only here
    await userEvent.click(within(panel).getByRole("button", { name: /Download .* as CSV/ }));
    expect(URL.createObjectURL).toHaveBeenCalled();
    await userEvent.click(within(panel).getByRole("button", { name: /^Remove/ }));
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove dataset" }));
    await waitFor(() => expect(doc().data.datasets).toHaveLength(0));
  });

  it("typed-in data stays editable", async () => {
    const doc = setup();
    await userEvent.click(screen.getAllByRole("button", { name: "Add data" })[0]!);
    const dialog = await screen.findByRole("dialog", { name: "Add data" });
    await userEvent.click(within(dialog).getByRole("radio", { name: "Type it in" }));
    await userEvent.type(within(dialog).getByLabelText("Row 1, Column 1"), "A");
    await userEvent.type(within(dialog).getByLabelText("Row 1, Column 2"), "5");
    await userEvent.click(within(dialog).getByRole("button", { name: "Add dataset" }));
    await userEvent.click(await screen.findByRole("button", { name: /^Edit/ }));
    const editor = await screen.findByRole("dialog", { name: "Edit data" });
    await userEvent.clear(within(editor).getByLabelText("Row 1, Column 2"));
    await userEvent.type(within(editor).getByLabelText("Row 1, Column 2"), "9");
    await userEvent.click(within(editor).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(doc().data.datasets[0]!.rows[0]).toMatchObject({ "Column 2": 9 }));
  });
});

describe("dashboard workspace", () => {
  const setup = () => {
    let current!: VisualisationIR;
    render(<Workspace initial={createVisualisation({ title: "Board", type: "dashboard" })} onDoc={(d) => { current = d; }} />);
    return () => current;
  };
  const widgets = (d: VisualisationIR) => readDashboard(d.configuration.options).widgets;

  it("starts empty, and the first data added becomes a recommended chart", async () => {
    const doc = setup();
    expect(screen.getByRole("heading", { name: "This dashboard is empty" })).toBeInTheDocument();
    await addPasted(SALES);
    await waitFor(() => expect(widgets(doc())).toHaveLength(1));
    expect(widgets(doc())[0]!.chart.kind).toBe("multi-line");
    expect(screen.getByRole("article", { name: /chart/i })).toBeInTheDocument();
  });

  it("adds, selects, duplicates and deletes charts; deleting asks first", async () => {
    const doc = setup();
    await addPasted(SALES);
    await userEvent.click(screen.getByRole("button", { name: "Add chart" }));
    await waitFor(() => expect(widgets(doc())).toHaveLength(2));
    expect(screen.getAllByRole("article")).toHaveLength(2);

    await userEvent.click(screen.getAllByRole("button", { name: /^Duplicate/ })[0]!);
    await waitFor(() => expect(widgets(doc())).toHaveLength(3));

    await userEvent.click(screen.getAllByRole("button", { name: /^Delete/ })[0]!);
    const confirm = await screen.findByRole("alertdialog", { name: "Delete this chart?" });
    await userEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect(widgets(doc())).toHaveLength(3);
    await userEvent.click(screen.getAllByRole("button", { name: /^Delete/ })[0]!);
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Delete chart" }));
    await waitFor(() => expect(widgets(doc())).toHaveLength(2));
  });

  it("selecting a chart opens its settings: position, size, and every chart option", async () => {
    const doc = setup();
    await addPasted(SALES);
    await userEvent.click(screen.getByRole("button", { name: "Add chart" }));
    await waitFor(() => expect(widgets(doc())).toHaveLength(2));
    // A chart you have just added is selected, so you can adjust it straight away.
    expect(await screen.findByRole("region", { name: "Selected chart settings" })).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: /Select to edit|selected/ }).find((b) => !/\(selected\)/.test(b.textContent ?? ""))!);
    const settings = await screen.findByRole("region", { name: "Selected chart settings" });

    const w0 = widgets(doc())[0]!.id;
    fireEvent.change(within(settings).getByLabelText("Width (columns)"), { target: { value: "4" } });
    expect(widgets(doc()).find((w) => w.id === w0)!.w).toBe(4);
    fireEvent.change(within(settings).getByLabelText("Height (rows)"), { target: { value: "6" } });
    expect(widgets(doc()).find((w) => w.id === w0)!.h).toBe(6);

    await userEvent.type(within(settings).getByLabelText("Chart title"), "Revenue trend");
    expect(widgets(doc()).find((w) => w.id === w0)!.chart.title).toBe("Revenue trend");
    expect(widgets(doc()).find((w) => w.id !== w0)!.chart.title).toBe(""); // the other chart is untouched
    await userEvent.click(within(settings).getByRole("radio", { name: "Bar" }));
    expect(widgets(doc()).find((w) => w.id === w0)!.chart.kind).toBe("bar");
    expect(screen.getByRole("article", { name: "Revenue trend" })).toBeInTheDocument();
  });

  it("rearranging and resizing work from the keyboard", async () => {
    const doc = setup();
    await addPasted(SALES);
    await userEvent.click(screen.getByRole("button", { name: "Add chart" }));
    await waitFor(() => expect(widgets(doc())).toHaveLength(2));
    const [first, second] = widgets(doc());
    expect([first!.x, second!.x]).toEqual([0, 6]);

    const move = screen.getAllByRole("button", { name: /^Move / })[0]!;
    move.focus();
    // Moving right makes it overlap the second chart, which is pushed down to make room.
    await userEvent.keyboard("{ArrowRight}");
    const moved = widgets(doc()).find((w) => w.id === first!.id)!;
    expect(moved.x).toBe(1);
    const other = widgets(doc()).find((w) => w.id === second!.id)!;
    expect(other.y).toBeGreaterThanOrEqual(moved.h);
    // Vertical moves obey gravity: with nothing above, a chart settles back to the top.
    await userEvent.keyboard("{ArrowDown}");
    expect(widgets(doc()).find((w) => w.id === first!.id)!.y).toBe(0);

    const resize = screen.getAllByRole("button", { name: /^Resize / })[0]!;
    resize.focus();
    const before = widgets(doc()).find((w) => w.id === first!.id)!;
    await userEvent.keyboard("{ArrowRight}");
    expect(widgets(doc()).find((w) => w.id === first!.id)!.w).toBe(Math.min(12 - before.x, before.w + 1));

    // no chart ever overlaps another
    const ws = widgets(doc());
    for (const a of ws) for (const b of ws) if (a !== b) expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false);
  });

  it("each chart can use a different dataset", async () => {
    const doc = setup();
    await addPasted(SALES);
    await addPasted("Team,Headcount\nA,5\nB,8\nC,3");
    await waitFor(() => expect(doc().data.datasets).toHaveLength(2));
    await userEvent.selectOptions(screen.getByLabelText("Dataset for the new chart"), doc().data.datasets[1]!.id);
    await userEvent.click(screen.getByRole("button", { name: "Add chart" }));
    await waitFor(() => expect(widgets(doc())).toHaveLength(2));
    expect(widgets(doc()).map((w) => w.chart.datasetId)).toEqual([doc().data.datasets[0]!.id, doc().data.datasets[1]!.id]);
    expect(widgets(doc())[1]!.chart.kind).toBe("bar"); // a category and a number
  });

  it("a chart whose data was removed says so instead of breaking", async () => {
    const doc = setup();
    await addPasted(SALES);
    await userEvent.click(within(screen.getByRole("complementary", { name: "Data" })).getByRole("button", { name: /^Remove/ }));
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove dataset" }));
    await waitFor(() => expect(doc().data.datasets).toHaveLength(0));
    expect(screen.getByText(/data has been removed/)).toBeInTheDocument();
  });

  it("undo/redo shortcuts reach the workspace, but never while typing", async () => {
    const undo = vi.fn();
    const redo = vi.fn();
    render(<DataWorkspace doc={createVisualisation({ title: "Board", type: "dashboard" })} update={() => undefined} undo={undo} redo={redo} loadKey={0} />);
    await userEvent.keyboard("{Control>}z{/Control}");
    expect(undo).toHaveBeenCalledTimes(1);
    await userEvent.keyboard("{Control>}{Shift>}z{/Shift}{/Control}");
    expect(redo).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getAllByRole("button", { name: "Add data" })[0]!);
    await userEvent.keyboard("{Control>}z{/Control}");
    expect(undo).toHaveBeenCalledTimes(1); // a dialog is open
  });
});

void act;

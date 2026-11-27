# Data visualisation engine (F3)

Local-first and deterministic. No server, no paid API, no AI.

## Pipeline
| Stage | Where | What it guarantees |
|---|---|---|
| Read | `lib/data/read.ts` | Validates extension, size (25 MB) and the first bytes (a ".csv" that is a zip or binary is refused); reads CSV/TSV/JSON/pipe tables/pastes/`.xlsx`; records a SHA-256 of the original bytes. The file is only read. |
| Build | `lib/data/build.ts` | Pure `RawTable → typed Dataset` with a profile and warnings; the raw rows are never mutated. |
| Query | `lib/charts/query.ts` | Pure `(dataset, config) → ChartData`: filters, grouping, aggregation, sorting, top-N, histogram bins, heatmap matrix, treemap tree. Every exclusion is reported in `notes`. |
| Recommend | `lib/charts/recommend.ts` | Deterministic rules choose a chart, name the columns in the reason, and offer alternatives. |
| Draw | `features/charts/echarts-option.ts` | `ChartData + config → ECharts option` (pure). One ECharts registration is shared by screen and export. |
| Export | `lib/export/*`, `features/charts/*-svg.ts` | SVG is rendered server-side-style from the IR (no screenshots); PNG rasterises it; PDF embeds that image on one page sized to the dashboard. |

## Import
- **Formats:** CSV, TSV, JSON (array of objects, array of arrays, `{"rows":[…]}` wrapper, or columns), Excel `.xlsx` (every sheet listed, one chosen), pasted spreadsheet cells, markdown tables, manual entry. `.xls`, `.xlsm`, `.xlsb`, `.ods` are refused with instructions.
- **Numbers:** `1,234.50`, `1.234,50`, `£1,200`, `(500)`, `12%`, `1e3`. A lone comma decimal (`12,5`) and leading-zero identifiers (`007`) are *not* guessed. A `%` or currency symbol is dropped and noted.
- **Dates:** ISO, `15 March 2026`, `March 2026`, `15/03/2026` (day first, flagged when it could be month first), Q3 2026, ISO datetimes. Impossible dates (`2026-02-31`) are not dates.
- **Missing:** blank, `NA`, `N/A`, `null`, `none`, `nan`, `-`, `--`, `?`, `#N/A`.
- **Typing is strict.** One stray value makes a column text, and the preview says so; you can force a column's type (unreadable values then become missing, and you are told how many).
- **Duplicates** are counted and kept unless you ask for them to be removed *from the imported copy*.
- **Limits:** 25 MB, 200,000 rows, 500 columns; over 50,000 rows warns that saving may be slower.

## Chart configuration (`options.chart`, validated by `chartConfigSchema`)
`kind` (19), `prefix`/`suffix` (number tile), `lines`/`secondaryAxis` (bar and line), `datasetId`, `x`, `y[]`, `series`, `aggregation` (sum/avg/count/min/max), `timeBucket`, `title`, `subtitle`, axis labels, `legend`, `dataLabels`, `tooltips`, `sort`, `limit`/`groupOthers`, `filters[]`, `palette` + per-series `colors`, `smooth`, `bins`. Dashboards store `options.dashboard.widgets[]`, each with a chart config and a position on a 12-column grid.

## Recommendation rules (in priority order)
1. You chose columns → respect them (date X → line; numeric X and Y → scatter; only X → counts; only a numeric Y → histogram; a Series → stacked bar).
2. Date + number(s) → line / multi-series line (area, bar, stacked bar offered).
3. Category + number: nested categories (each child in one parent) → **treemap**; few categories with a share-like measure → **donut**; several measures → **grouped bar**; otherwise **bar**. Pie, horizontal bar, heatmap, stacked bar offered where they fit.
4. Two or more numbers → **scatter**; one number → **histogram**; only categories → bar of counts.
Row-number columns (an unnamed 1..n counter) and columns named like ids are never treated as measures.

## Dashboards
Pure grid functions (`lib/charts/dashboard.ts`): add, remove, move, resize, duplicate, with collision pushing and upward compaction. A 400-step randomised test checks that widgets never overlap or leave the grid. Pointer drag uses `dragPreview` (unit-tested); the keyboard moves a chart with arrow keys and resizes with Shift+arrows or the corner control; the settings panel has numeric position and size fields. Below 768px the grid collapses to one column in reading order.

## Honest limits
- Typed-in data is editable; imported and pasted datasets are read-only copies (inspect, filter, chart, export).
- `.xls` and other spreadsheet formats are not supported. Excel formulas are read as their last saved values.
- Scatter plots sample above 5,000 points; heatmaps cap at 50 × 50.
- PDF export is for dashboards only, and charts in it are images, so text in a PDF is not selectable.
- Pointer drag/resize and canvas drawing cannot run in the test environment; their logic is unit-tested and the chart options are asserted, but the on-screen result should be checked in a browser.

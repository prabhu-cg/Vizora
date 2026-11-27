# QA and release status (Vizora Free, F5)

This page separates what is **verified by automated tests**, what is **built but only checkable by a person in a real browser**, and what is **not done**. Nothing here is claimed beyond that.

## Verified by automated tests (643 tests: unit and jsdom component tests)
- **Functional:** project create/edit/delete; flowchart, mind map, concept map and timeline generation and editing; CSV, JSON and Excel import; chart and dashboard creation; autosave and restore after a refresh (new storage object on the same database); undo/redo; every export format; project and full backups with validation, preview, keep-both/skip and no overwrites. The whole new-user journey (create, generate, edit, save, refresh, export, back up, restore) is one test: `tests/unit/acceptance-new-user.test.ts`.
- **Accessibility (structural):** axe-core runs over the dashboard (empty, populated, searching), the new-project drawer, project page, Recent page, storage panel and the destructive confirmation. Colour contrast is checked against the design tokens (WCAG AA) in `tests/unit/design-tokens.test.ts`, not in a rendered page. Found and fixed: heading order on the project page.
- **Security:** file type, magic-number and size (25 MB) validation; row and column limits; strict zod validation of every stored and imported document; backups validated before any write; exported markup escapes titles and labels; the Content Security Policy is asserted; a test fails if app code adds `fetch`, XHR, beacon or WebSocket calls.
- **Performance:** file reading and analysis run in a Web Worker (with an in-page fallback); heavy libraries (ECharts, Excel reader, jsPDF) load only when used; charts cap categories automatically and turn off patterns and animation when they would be slow; dates are grouped for large time series.

## Needs a person in a real browser (not verified here)
The Chrome extension for browser automation never connected during development, so **none of the following has been exercised in a real browser by the assistant**:
- Chrome, Safari, Firefox and Edge: IndexedDB, file picking, downloads, Web Worker loading and rendering. The app detects missing capabilities and says what to do instead (Settings shows a list only when something is missing).
- Responsive layouts on tablet and mobile; touch interaction; the small-screen panel switcher.
- Keyboard focus order and visible focus rings; screen-reader announcements (VoiceOver, NVDA).
- Real colour contrast on rendered pages; the Content Security Policy in a real browser (check the console for violations).
- Drag, resize and canvas drawing; PNG and PDF export from a real canvas.
- Performance on large diagrams and datasets; memory use. (Reading and analysing a 30,000-row workbook takes about two seconds in tests; the chart then draws a capped number of marks.)

### Manual checklist
1. Fresh profile: open the app, create a project, generate each of the four diagram types, edit, refresh, confirm everything is still there.
2. Import a CSV, a JSON file and an .xlsx; create a chart and a dashboard; undo and redo; export every format offered.
3. Back up one project and everything; clear local data; restore; confirm nothing was overwritten when importing over existing work.
4. Repeat in Safari, Firefox and Edge; try a private window (storage may be unavailable and should say so).
5. Keyboard only: reach every control, open and close drawers and dialogs, reorder, move panels with `[` and `]`, full screen with `F`.
6. Phone-width window: navigate, open a visualisation, inspect, make a small edit.
7. Console: no errors and no CSP violations through the above.

## Known limits
- No cloud backup, sync, accounts, AI, live or hosted embeds, drag-to-reorder in lists, `.xls` import, or PDF for single charts and diagrams.
- Data stays on the device, but the site itself is served by the host, which sees ordinary page requests. Vizora makes no requests to other services and has no analytics.

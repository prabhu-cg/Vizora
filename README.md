# VIZORA — Free edition (F0 foundation)

**See beyond information**
Local-first universal visualisation platform. This is the F0 foundation: architecture, storage, shell and tooling. Full visualisation features come in F1+.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · shadcn-style UI on Radix (restyled to the Butter system) · Lucide · IndexedDB · React Flow (`@xyflow/react`) · Apache ECharts · Zod · `read-excel-file` (.xlsx) · `jspdf` (dashboard PDF) · Vitest + Testing Library. All dependencies are pinned to exact versions (`.npmrc` `save-exact`, lockfile committed).

## Local development
```bash
nvm use            # Node 24 (>= 22.12)
npm install
npm run dev        # http://localhost:3000
npm run verify     # typecheck + lint + tests + production build
```
Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:watch`, `format`, `verify`.

## Deploy to Vercel
1. Push the repo to GitHub/GitLab/Bitbucket.
2. Vercel → **Add New → Project** → import it. Framework preset is auto-detected (Next.js); no environment variables or paid services are required.
3. Deploy. Or via CLI: `npm i -g vercel && vercel` (preview) / `vercel --prod`.

Notes: all user data lives in the visitor's browser (IndexedDB); the only server code is `/api/health`. Security headers are set in `next.config.ts`.

## Release (F5)
See `docs/deployment.md` (environment, deploy, security headers, logging, rollback) and `docs/qa.md` (what is verified by tests, what still needs a person in a real browser, and a manual checklist). Run `npm run verify` before every release.

## Workspace and project management (F4)
Dashboard with recent projects and visualisations, search across both, sorting (remembered), recently-modified markers, project create/edit/duplicate/delete. Project pages with created/updated dates, contents, per-project search and sort, rename, duplicate, move to another project, reorder (accessible up/down controls), per-visualisation export and delete with confirmation. Workspace panels collapse (remembered), full-screen canvas (`F`; `[` and `]` toggle panels). Backups: whole library or a single project; import validates and previews first, lists what already exists, and offers keep-both or skip, never overwriting. Settings shows counts, approximate size and browser quota, and clearing all data needs a typed confirmation. Data is local to the browser; nothing is backed up unless you download a backup.

## Data visualisation engine (F3)
Import Excel, CSV, TSV, JSON, pasted or typed data (all in the browser, originals untouched); 19 chart types (including number tiles and a Gantt schedule) with deterministic recommendations and reasons; full chart editing; dashboards with drag, resize and keyboard control; export to PNG, SVG, CSV, JSON and (dashboards) PDF. See `docs/data.md`.

## Core visualisation engine (F2)
Flowcharts, mind maps, concept maps and timelines, created from pasted text (rule-based, no AI) or by hand; full editing with undo/redo, keyboard shortcuts, format switching with a change preview, and PNG / SVG / editable JSON export. See `docs/engine.md` for the rules, limits and IR conventions.

## Marketing website (F1)
Pages: `/`, `/features`, `/how-it-works`, `/use-cases`, `/pricing`, `/about`, `/faq`, `/privacy`, `/terms` (all static). Every claim lives in `lib/marketing/content.ts` with an availability status (`available` / `in-development` / `planned`); tests fail if an unbuilt feature is marked available, if Pro/Team show purchase controls, or if any link is dead.

Environment (see `.env.example`):
- `NEXT_PUBLIC_SITE_URL` — production origin for canonical URLs, sitemap, robots and social cards. Falls back to Vercel's URL, then `http://localhost:3000`. Set it on Vercel before launch.
- `NEXT_PUBLIC_CONTACT_EMAIL` — optional; shown on Privacy/Terms only when set.

SEO: per-page metadata, canonical, Open Graph/Twitter cards (`app/opengraph-image.tsx`), `sitemap.xml`, `robots.txt` (app and API excluded), JSON-LD (Organization/WebSite/SoftwareApplication, FAQPage). Illustrations are inline SVG, so pages ship no images and little JavaScript.

## Structure
```
app/            (marketing)/ · app/(shell)/{dashboard,settings} · app/(workspace)/workspace · api/
components/     marketing · layout · dashboard · workspace · visualisations · shared · settings · brand · ui
features/       projects · visualisation (autosave, editor) · diagrams · charts · data-import · export · entitlements
lib/            storage · validation · visualisation (IR factory, migrations) · parsers · export · design · utils
types/          project · visualisation (IR) · data
hooks/ services/ tests/ docs/
```

## Key design decisions
- **Visualisation IR** (`lib/validation/visualisation.schema.ts`): Zod schema is the single source; TS types are inferred. Persistence never stores React Flow/ECharts shapes; `features/*/adapter|option` translate IR → renderer.
- **Migrations**: every document has `schemaVersion`; `lib/visualisation/migrations.ts` holds step functions (v0→v1 today). Newer-than-supported documents are rejected, never downgraded.
- **Storage** (`lib/storage`): `VizoraStorage` interface + IndexedDB implementation. Writes use optimistic concurrency (`revision`); a stale save throws `ConflictError` and the UI pauses autosave until the user chooses. Project delete cascades atomically. Backup import is all-or-nothing and never overwrites (`skip` / `keep-both`).
- **Autosave** (`features/visualisation/autosave.ts`): debounced, serialised, flushes on hide/unload/unmount, never drops a failed edit; status is announced via a polite live region.
- **Entitlements** (`features/entitlements`): one catalogue (`FEATURE_CATALOGUE`) + service. Plans `FREE | PRO | TEAM`; only FREE is live. Reserved features (`sync.cloud`, `ai.assist`, `workspace.team`) are `released: false` and denied everywhere. No billing, sync or AI code exists.
- **Design tokens**: the Butter system from Yedara's DESIGN.md; see `docs/design-system.md`. `app/tokens.css` (light + dark) → Tailwind theme in `globals.css`; guarded by tests.

## Accessibility notes
Text colours, ochre-on-tint, semantic colours and form-control borders (3:1) are contrast-tested in both themes (`tests/unit/design-tokens.test.ts`). Amber is only ever a fill with charcoal text. Focus is a solid 2px ochre outline.

## Number tiles, Gantt and swimlanes
Number tiles and the Gantt schedule are chart kinds (`kpi`, `gantt`), so they import, filter, export and sit on dashboards like any chart; "Add number tile" on a dashboard starts one from the first real measure. A number tile compares the latest month or year with the one before. The Gantt chart takes a task column plus start and end date columns (optionally coloured by group); it has no task dependencies. Swimlanes divide a flowchart into lanes (see `docs/engine.md`).

## Table view
A `table` visualisation shows a dataset as a sortable, searchable, paged table: choose and reorder columns, set a default sort, filter rows (same filters as charts), shade numeric columns with a colour scale or data bars. Settings live in `configuration.options.table` (`lib/tables`). Exports: CSV exactly as configured (every matching row), and an image (SVG, PNG, HTML embed) of the first 40 rows and 12 columns. Tables are not dashboard tiles yet.

## Embedding
Export menu: **Copy embed code** (an inline-SVG `<figure>` with unique ids, fluid width, escaped caption, no scripts or external requests) and **HTML embed page**. These are static snapshots: they do not update and there is no hosted, interactive embed (that would require publishing a copy to a server).

## Known gaps (honest status)
- Reordering uses up/down buttons, not drag and drop. Storage size is estimated from saved records, not measured by the browser. Full-screen uses the browser Fullscreen API where available and falls back to hiding the panels.
- Visual verification in a real browser was **not performed** (browser tooling unavailable); UI behaviour is covered by jsdom tests and a production build only. Please click through once: create project → diagram → add nodes → refresh → import CSV chart → export/import backup.
- AI-assisted generation does not exist; `.xls` import and PDF export of single charts/diagrams do not either. `table` exists in the IR but has no renderer and is not creatable.
- Mind maps and timelines position themselves; you rearrange a mind map via the Inspector ("Move under…", move up/down) rather than by dragging.
- Visualisation list queries load full records (summaries are denormalised in `meta`, but IndexedDB still reads whole values). Split into a separate documents store if datasets get large.

# VIZORA — Free edition (F0 foundation)

**Anything in. Visual understanding out.**
Local-first universal visualisation platform. This is the F0 foundation: architecture, storage, shell and tooling. Full visualisation features come in F1+.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · shadcn-style UI on Radix · Lucide · IndexedDB · React Flow (`@xyflow/react`) · Apache ECharts · Zod · Vitest + Testing Library. All dependencies are pinned to exact versions (`.npmrc` `save-exact`, lockfile committed).

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
- **Design tokens**: `app/tokens.css` (source of truth) → Tailwind theme in `globals.css`; `lib/design/tokens.ts` mirrors the palette for charts, guarded by a test.

## Accessibility notes
Raw brand Blue (#2878F0, 4.2:1) and Muted (#777, 4.5:1 on white, less on the page background) fall short of WCAG AA for small text, so text/filled controls use derived shades (`--vz-blue-strong #1D63D8`, `--vz-muted-text #6B6B6B`); brand colours remain for graphics, focus rings and decoration. Form-control borders use `#858B95` (≥3:1). `tests/unit/design-tokens.test.ts` enforces these ratios.

## Known gaps (honest status)
- **Logo/favicon are placeholders** — no approved assets were supplied. See `public/brand/README.md`.
- Visual verification in a real browser was **not performed** in the build session (browser tooling unavailable); UI behaviour is covered by jsdom tests and a production build only. Please click through once: create project → diagram → add nodes → refresh → import CSV chart → export/import backup.
- Only `diagram` and `chart` have renderers; `table`, `timeline`, `mindmap` exist in the IR but are not creatable yet.
- Visualisation list queries load full records (summaries are denormalised in `meta`, but IndexedDB still reads whole values). Split into a separate documents store if datasets get large.

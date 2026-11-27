# VIZORA — Free edition (F0 foundation)

**See beyond information**
Local-first universal visualisation platform. This is the F0 foundation: architecture, storage, shell and tooling. Full visualisation features come in F1+.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · shadcn-style UI on Radix (restyled to the Butter system) · Lucide · IndexedDB · React Flow (`@xyflow/react`) · Apache ECharts · Zod · Vitest + Testing Library. All dependencies are pinned to exact versions (`.npmrc` `save-exact`, lockfile committed).

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

## Known gaps (honest status)
- Visual verification in a real browser was **not performed** (browser tooling unavailable); UI behaviour is covered by jsdom tests and a production build only. Please click through once: create project → diagram → add nodes → refresh → import CSV chart → export/import backup.
- Only `diagram` and `chart` have renderers; `table`, `timeline`, `mindmap` exist in the IR but are not creatable yet.
- Visualisation list queries load full records (summaries are denormalised in `meta`, but IndexedDB still reads whole values). Split into a separate documents store if datasets get large.

# Deployment

Vizora Free is a static-first Next.js app. It needs **no database, no accounts, no AI key and no server-side secrets**. All user data stays in the visitor's browser (IndexedDB).

## Requirements
- Node.js 22.12 or newer.
- Any host that runs Next.js 16 (Vercel is what this project uses).

## Environment variables
Both are optional. See `.env.example`.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin (for example `https://getvizora.vercel.app`) used by canonical URLs, the sitemap, robots and social cards. On Vercel it falls back to the deployment URL. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Shown on the Privacy and Terms pages when set. |

Nothing secret is read by the app. Do not add API keys; there is nothing that uses them.

## Build and run
```
npm ci
npm run verify      # typecheck, lint, tests, production build
npm run start       # serve the production build
```

## Deploy to Vercel
```
vercel link --yes --project <name>
vercel deploy --prod --yes
```
`/api/health` returns the app version for uptime checks.

## Security headers
Set in `next.config.ts`: Content Security Policy (production only; defined and tested in `lib/security/csp.ts`), `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` and `Cross-Origin-Opener-Policy`. The policy allows **no other origin** for scripts, connections, frames or objects (`connect-src 'self'`), which also makes it a guard against any dependency quietly calling out. `'unsafe-inline'` is allowed for scripts because Next.js's bootstrap and the theme-before-paint script are inline; there is no `eval`.

## Error handling and logging
There is no server-side error collection and nothing is sent off the device. See `lib/logging.ts`: errors are shown in plain language, written to the browser console as one structured line, and kept in memory (last 20, this tab only). To collect errors remotely you would need a sink, consent and a Privacy page update.

## After deploying
1. Open `/`, `/app/dashboard`, `/robots.txt` and `/sitemap.xml`.
2. Open the browser console on `/app/dashboard` and confirm there are no Content Security Policy violation messages while you create a project, import a CSV and an .xlsx file, draw a chart, and export a PNG and a PDF.
3. Run the manual checklist in `docs/qa.md`.

## Rollback
Redeploy the previous commit (`vercel rollback` or promote a prior deployment). User data is local, so a rollback never touches it. Stored documents carry a schema version and are migrated on read.

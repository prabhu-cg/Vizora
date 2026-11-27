# Vizora design system — "Butter"

Adopted from Yedara's `DESIGN.md` (prabhu-cg/Yedara) for both the marketing site and the app.
Tokens live in `app/tokens.css` (light + `.dark`); `lib/design/tokens.ts` mirrors them for JS and
`tests/unit/design-tokens.test.ts` enforces sync, WCAG contrast, and the Token Only Rule (no literal hex in components).

## What is applied
- **Grounds:** Desk `--surface` (sidebar, header, bands, drawer bars) vs Paper `--background`/`--card` (content, forms, canvas).
- **One voice:** Amber `--primary` is a fill only (charcoal text on it); Ochre `--primary-text` for accent text, links, focus ring.
- **Type:** Newsreader 500 for every `h1`, `h2`, `.font-display` (unlayered rule in `globals.css`); DM Sans elsewhere; sentence case; 14px app body, 16px marketing.
- **Shape:** pill buttons (40/36/48/28px), 8px inputs, ~11px menus, 20px cards/drawers/dialogs.
- **Selection** is butter (`--accent`), hover is sand (`--muted`); flat at rest, shadows only on overlays.
- **Drawers** (right-hand, desk header and footer bars, paper body) for create/edit/import; **AlertDialog** only for destructive confirmations (outline button, red text).
- **Toasts** bottom centre. **Theme:** exactly light or dark, sun/moon pill, key `vizora-theme`, applied before paint.
- **Layout:** 288px sidebar, content max 1400px; marketing 1152px with alternating desk/white bands; 3px amber rule atop the mobile app header.
- **Logo/favicon:** the supplied `Vizora_logo.svg`, unmodified geometry and right-wing colour (`#D4A615`); the left wing (`#202B27`) uses `--brand-ink`, lightening to `#E7E0D6` in dark mode so it stays visible. `app/icon.svg` does the same under `prefers-color-scheme: dark`; `favicon.ico` and `apple-icon.png` place the mark on a white tile.

## Differences from Yedara
- No laptop mockup or feature-anchor bar on marketing (there are no product captures yet).
- Charts need several series, so `--chart-1..5` extend the palette with ink, info blue, success green and a warm grey (amber stays first).
- Logo wing colours are the supplied asset's, not Yedara's amber/grey.

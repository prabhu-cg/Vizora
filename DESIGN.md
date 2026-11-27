# Design system — "Butter"

Vizora adopts the Butter system from Yedara for both the marketing site and the app. Tokens are CSS custom properties in `app/tokens.css` (light, and `.dark`), mirrored for JS in `lib/design/tokens.ts`; `tests/unit/design-tokens.test.ts` enforces sync, WCAG contrast and the Token Only Rule (no literal hex in components). See also `docs/design-system.md`.

## Character
Warm, calm and editorial. A paper-and-desk metaphor: the work sits on bright paper; the chrome sits on a slightly warmer desk. One voice of amber. Flat at rest; shadows appear only on overlays.

## Colour
- **Grounds:** Desk `--surface` `#fcfaf3` (sidebar, header, bands, drawer bars). Paper `--background`/`--card`/`--popover` `#ffffff` (content, forms, canvas).
- **Amber `--primary` `#e8b923`** is a **fill** for what is actionable or selected, with charcoal `--primary-foreground` `#353335` on it, never white and never small text. Hover `#d4a615`. Soft tint `--primary-soft`.
- **Ochre `--primary-text` `#826400`** is the accent for text, links and the focus ring.
- **Selection** `--accent` butter `#faf4df`; **hover** `--muted` sand `#f8f4e4`.
- **Ink:** `--foreground` `#353335`, `--body` `#4d4a4d`, `--muted-foreground` `#6b6b6b`. **Lines:** `--border` `#ece5cc`, `--border-strong` `#dccfa6`, controls `--input` `#8a7f6e` (3:1).
- **Status:** success `#146c43`, warning `#8a5a00`, info `#1f5f9e`, destructive `#b3261e`, each with a soft tint.
- **Charts (categorical):** `--chart-1..5` = amber, ink, blue, green, warm grey; amber first, all legible on paper.
- **Dark:** exactly light or dark, never "auto-in-between". Toggle is a sun/moon pill, key `vizora-theme`, applied before paint.

## Typography
Newsreader 500 for every `h1`, `h2` and `.font-display`; DM Sans for everything else; mono only for code and data. Sentence case. App body 14px, marketing body 16px.

## Shape and depth
Pill buttons (heights 40, 36, 48 and 28). Inputs 8px radius; menus 11px; cards, drawers and dialogs 20px. Overlay shadows only (`--shadow-overlay`, `--shadow-drawer`). Native selects keep their behaviour with an inset chevron.

## Components and patterns
- **Drawers** (right-hand, desk header and footer bars, paper body) for create, edit and import. **AlertDialog** only for destructive confirmations (outline button, red text); clearing all data also needs a typed word.
- **Toasts** bottom centre.
- **Workspace:** left panel, canvas, right panel; side panels collapse to a rail (remembered), full-screen canvas on `F`, `[` and `]` toggle panels. Below 1024px one panel at a time.
- **Charts:** a bounded, centred frame; a few legend entries in a plain bottom row, many in a scrolling vertical list on the right with a gutter.
- **Lists and cards:** one stretched link per card or row; menus for secondary actions; recency shown as text, highlighted if under a day.

## Layout
App sidebar 18rem, content max 1400px. Marketing max 1152px with alternating desk and white bands; a 3px amber rule tops the mobile app header. Page gutter 2rem.

## Motion
220ms in, 180ms out, `cubic-bezier(0.2, 0, 0, 1)`; respects `prefers-reduced-motion`.

## Logo
The supplied `Vizora_logo.svg`; right wing `#D4A615`, left wing `--brand-ink` `#202B27`, lightened to `#E7E0D6` in dark mode. Tagline: "See beyond information".

## Rules
Tokens only in components. Amber never as small text. Headings in Newsreader. No gradient text, glass decoration or side-stripe borders. Honest status labels on every claim.

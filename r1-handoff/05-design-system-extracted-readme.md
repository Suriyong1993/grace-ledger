# Grace Ledger — Design System

**Grace Ledger** is a Church Financial OS: accounting, offerings, funds, budgets, approvals and audit-trail
for churches. Built for church staff, treasurers, pastors and administrators who are not accounting experts —
fintech-grade clarity paired with the warmth of a church organization.

> **Corrected 2026-09-02.** This design system was previously documented as a React 19 + TanStack Router +
> Tailwind CSS v4 + shadcn/ui product. **That is not the live application.** The production codebase
> (`Suriyong1993/grace-ledger`, branch `main`) is **vanilla TypeScript + Vite**: every screen is a
> `render*Html(props): string` function plus `attachEventListeners(root)`, full re-render on state change,
> hash-based routing (`src/router.ts`), no component framework. This was an explicit architecture decision —
> see `docs/M2_PHASE_2_2_FRONTEND_ARCHITECTURE_DECISION.md` in the repo, which rejected React specifically to
> avoid this class of drift. The **tokens** below (color/type/spacing/radius/shadow/motion) are accurate and
> are the same values `src/styles/app.css` imports. The **component/route file paths** in the old version of
> this document (`src/components/ui/*.tsx`, `src/routes/_app.*.tsx`) do not exist in the repository and never
> did in the live product's history — they described an earlier design exploration, not shipped code.

**Sources used:**
- GitHub: [Suriyong1993/grace-ledger](https://github.com/Suriyong1993/grace-ledger) — primary source of truth
  for tokens (`src/styles/app.css`, which `@import`s `design-system-extracted/styles.css`), the real component
  surface (`src/components/**/*.ts`, string-render functions), and the design rulebook (`CLAUDE.md`, `DESIGN.md`,
  `COMPONENTS.md`, `DECISIONS.md` — all at repo root).
- Uploaded brand assets: `Logo.png`, `Logo mark -icon.png`, `App Icon.png`.

## Index

- `styles.css` — root stylesheet, imports everything under `tokens/`
- `tokens/` — colors, typography, spacing, radius, shadows, motion, fonts, base resets — **this is the real,
  currently-consumed source of truth**; see the repo's `DESIGN.md` for how each token is meant to be used
- `assets/` — `logo.png`, `logo-mark.png`, `app-icon.png`
- `guidelines/` — foundation specimen cards
- `components/` (`forms/`, `feedback/`, `data/`, `navigation/`, `overlays/`) and `ui_kits/grace-ledger/` —
  **prototyping reference only, not the production component source.** These are React/JSX recreations built
  for quick mockups in a design tool. The actual production components are the `.gl-*` CSS classes in
  `src/styles/app.css` plus the `render*Html()` TypeScript functions in `src/components/**` and `src/pages/**`
  — read `COMPONENTS.md` in the repo for the real catalogue.
- `SKILL.md` — portable skill file for Claude Code / other agent environments

## Content fundamentals

(Unchanged — verified still accurate against the live product.)

- **Language:** All product copy is in Thai (`lang="th"`); numerals and money render in Latin digits via
  Inter — a deliberate choice so amounts stay scannable.
- **Voice:** Direct, procedural, calm. Short imperative labels, no exclamation points.
- **Formality:** Polite but neutral register — this is a work tool, not a chat assistant.
- **Numbers:** Currency is always `฿` + 2 decimals, real values, never rounded for display. Credit = green +
  `+` prefix, debit = red + `−` prefix, always both color *and* sign.
- **Empty/error states:** A real sentence + a concrete next action, never a fake placeholder.
- **Emoji:** Not used anywhere in the product.
- **Vibe:** Calm · Exact · Spacious · Quiet · Honest.

## Visual foundations

Unchanged palette/type/spacing/motion rules — see the repo's `DESIGN.md` for the current canonical values,
including the 2026-09-02 radius/shadow update (D1) and the modal-glass flattening (D3). Do not treat the
values quoted in earlier versions of this readme (24px cards, 18px buttons, glass modals) as current — they
were superseded in production before this correction and `DESIGN.md` is now the single source for resolved
values.

## Iconography

The live codebase uses **inline SVG only** (24 viewBox, `stroke-width: 1.8` default / `2` for active states,
`aria-hidden="true"` on decorative icons) — defined per-component as `ICON_*` string constants (see
`src/components/layout/AppShell.ts`, `src/pages/DashboardPage.ts`). **Not Lucide, not any icon font or
library** — the earlier version of this document was incorrect on this point. No decorative illustration or
brand iconography exists anywhere in the product.

## Fonts

Sarabun and Inter load from Google Fonts by URL in `index.html` — the source repo ships no local font
binaries. `--font-mono` ("JetBrains Mono") is referenced once in the codebase
(`src/components/ai/ProposalConfirmationModal.ts`) but not defined anywhere — this is a known, tracked
inconsistency (see `DECISIONS.md`'s open findings), not something this design system should silently
fabricate a value for.

## Components — what's real vs. what's a prototyping aid

The production component surface is: `.gl-*` CSS classes in `src/styles/app.css` (buttons, inputs, badges,
cards, notices, tables, stat grids, tabs, modals, action bars) plus TypeScript render functions in
`src/components/**` and `src/pages/**`. The `components/*.jsx` and `ui_kits/` folders in this design-system
package are React recreations for fast prototyping in a design tool — useful for mocking new screens quickly,
**not** something a change to the live app should import or match against for exact production fidelity. When
in doubt, the repo's own `COMPONENTS.md` and `src/styles/app.css` win.

## UI kit

`ui_kits/grace-ledger/index.html` remains a useful click-through **prototype**, not a production reference —
see the correction above.

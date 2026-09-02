# Grace Ledger — Design System

**Grace Ledger** is a Church Financial OS: a modern accounting, offerings, funds, budgets, approvals and audit-trail platform for churches. The product is built for church staff, treasurers, pastors and administrators who are not accounting experts — the visual language pairs fintech-grade clarity (Stripe/Linear/Mercury lineage) with the warmth and trust of a church organization.

> **Corrected 2026-09-02 (R1-b).** Earlier versions of this document described the product as **React 19 + TanStack Router/Start + Tailwind CSS v4 + shadcn/ui**, and mapped it to `src/components/ui/*.tsx` and `src/routes/_app.*.tsx` files. **That was never the live application.** The production codebase is **vanilla TypeScript + Vite**: every screen is a `render*Html(props): string` function plus `attachEventListeners(root)`, full re-render on state change, hash-based routing (`src/router.ts`), no component framework. Rejecting React was an explicit decision — see `docs/M2_PHASE_2_2_FRONTEND_ARCHITECTURE_DECISION.md`. The React description is retained here only as history; do not treat it as a description of shipped code.
>
> The **tokens** below (color/type/spacing/radius/shadow/motion) are accurate — they are the same values `src/styles/app.css` imports via `design-system-extracted/styles.css`. Resolved numeric values live in the repo's `DESIGN.md`, which is canonical as of the 2026-09-02 radius/shadow canonicalization (D1) and modal-glass flattening (D3).

**Sources used:**

- GitHub: [Suriyong1993/grace-ledger](https://github.com/Suriyong1993/grace-ledger) — primary source of truth for tokens (`src/styles/app.css`), the real component surface (`src/components/**/*.ts` and `src/pages/**/*.ts`, string-render functions), and the design rulebook (`CLAUDE.md`, `DESIGN.md`, `COMPONENTS.md`, `DECISIONS.md`, all at repo root).
- Uploaded brand assets: `Logo.png`, `Logo mark -icon.png`, `App Icon.png`.

## Index

- `styles.css` — root stylesheet, imports everything under `tokens/`
- `tokens/` — colors, typography, spacing, radius, shadows, motion, fonts, base resets — **this is the real, currently-consumed source of truth**; see the repo's `DESIGN.md` for how each token is meant to be used
- `assets/` — `logo.png`, `logo-mark.png`, `app-icon.png`
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Radius, Shadows, Motion, Brand groups in the Design System tab)
- `components/` (`forms/`, `feedback/`, `data/`, `navigation/`, `overlays/`) — **prototyping reference only, not the production component source.** These are React/JSX recreations built for quick mockups in a design tool. The production components are the `.gl-*` CSS classes in `src/styles/app.css` plus the `render*Html()` TypeScript functions in `src/components/**` and `src/pages/**` — see `COMPONENTS.md` in the repo for the real catalogue.
- `ui_kits/grace-ledger/` — interactive click-through **prototype**: login → dashboard → income entry wizard → approvals queue. Same caveat as `components/` above.
- `SKILL.md` — portable skill file for Claude Code / other agent environments

## Content fundamentals

- **Language:** All product copy is in Thai (the app's `lang="th"`); numerals and money render in Latin digits via Space Grotesk, never Thai digits — a deliberate choice so amounts stay scannable.
- **Voice:** Direct, procedural, calm. Labels are short imperative nouns/verbs — "บันทึกรายรับ" (record income), "ไปที่คิวอนุมัติ" (go to approval queue) — not conversational or cute. No exclamation points, no "!"-style enthusiasm.
- **Formality:** Polite but neutral register (no "ครับ/ค่ะ" particles in UI copy) — this is a work tool, not a chat assistant.
- **Numbers:** Currency is always `฿` + 2 decimals, real values — **never rounded for display**. Credit = green + `+` prefix, debit = red + `−` prefix, always both color _and_ sign/icon (never color alone).
- **Empty/error states:** Always a real sentence + a concrete next action ("ยังไม่มีรายรับ" / "เริ่มบันทึกรายรับเพื่อดูข้อมูลที่นี่" + a button) — never a fake placeholder number or silent blank.
- **Emoji:** Not used anywhere in the product. Iconography carries meaning instead.
- **Vibe:** Calm · Exact · Spacious · Quiet · Honest (the product's own five governing words). Nothing in the UI should trade clarity or auditability for decoration.

## Visual foundations

- **Palette (Emerald Vault, 2026-09):** Porcelain background (`#F4F5F2`) + white cards + ink-green text (`#14201A`), with a deep-evergreen brand (`#14532D`) for CTAs and a brass accent (`#B45309`) reserved for focus/secondary highlights — neither is ever a large background fill. The desktop sidebar is the identity's signature "vault": dark evergreen chrome (`--sidebar: #0B1F17`) over a porcelain workspace. Finance meaning is carried by three fixed hues that are never reused for anything else: emerald = income/approved, red = expense/rejected, amber = offering/pending. Max two background colors on any screen (white + porcelain).
- **Type:** Anuphan for Thai UI text, Space Grotesk for Latin/headline/numerals (Thai glyphs fall through to Anuphan — the mixed-script pairing is deliberate). Body is 15px/1.6, headings are 600–700 weight with −0.02em tracking and `text-wrap: balance`. All money/amount text uses `.num-display` (tabular-nums, lining-nums, Space Grotesk first) so digits align in columns.
- **Spacing:** A 4px-multiplier scale, exposed as `--space-*` tokens in `tokens/spacing.css` and consumed as `var(--space-N)` throughout `src/styles/app.css`. Table cells use a compact 20px/12px (x/y) default.
- **Backgrounds:** Flat color only. No gradients, no photography, no illustration, no texture/grain, no glassmorphism except a single hairline-blurred sticky topbar.
- **Radius:** Canonical values live in the repo's `DESIGN.md` (D1, 2026-09-02) and in `tokens/radius.css` — do not restate them here, and do not trust radius numbers quoted in older revisions of this file. The one standing rule: **tables and table cells are documented as 0px radius**; borders carry the depth cue there instead of rounding. (See `DESIGN.md` → Open findings: the live `.gl-table` currently contradicts this and is preserved as-is pending an explicit decision.)
- **Cards:** White, 1px border (`var(--border)`), radius per `--radius-card`, soft `shadow-sm-card`/`shadow-card` only — never a heavy shadow. Interactive cards get a 1px border color shift on hover, never a lift or scale-up.
- **Elevation:** Border beats shadow as the default depth cue; real shadow is reserved for genuine overlap (dialogs, popovers) and one "lifted" hero surface per screen at most.
- **Signature — the double ledger rule:** a real ledger closes a grand total with a heavy rule over a hairline. Figures the screen exists to answer (dashboard total balance, reports net surplus) get `.gl-total-rule` (2px over 1px, ink at 75%); nothing else uses it.
- **Motion:** Emil Kowalski's ease-out curve (`cubic-bezier(0.23,1,0.32,1)`) everywhere. Press/hover 100–150ms, dialogs/sheets 200–250ms, page transitions 250–300ms. **400ms is a hard ceiling** — nothing in the product animates longer. No bounce/spring/elastic easing on business UI, no count-up animation on money (ever — it reads as flashy for a finance app), respects `prefers-reduced-motion`.
- **Hover/press states:** Hover = subtle background tint or border-color shift, never a scale-up. Press = `scale(0.97–0.98)` only, no color flash.
- **Borders & depth:** 1px hairline borders throughout; no double borders, no colored left-border accent strips on generic cards (StatCard's left accent bar is the one intentional exception — a deliberate "financial terminal" motif, not decoration).
- **Transparency/blur:** Used in exactly one place — the sticky topbar, so content scrolling underneath stays legible. Not used on cards or dialogs; modal content was flattened to a solid surface by D3 (see `DECISIONS.md`).
- **Layout:** Desktop/iPad-first (sidebar + topbar), mobile is a secondary but fully-supported target (bottom nav + "more" sheet). 44px minimum touch target (`--touch-target-min`) everywhere except table-row action buttons (36px, explicitly excepted).

## Iconography

- The live codebase uses **inline SVG only** — 24 viewBox, `stroke-width` 1.8 default / 2 for active states, `aria-hidden="true"` on decorative icons — defined per-file as `ICON_*` string constants (see `src/components/layout/AppShell.ts`, `src/pages/DashboardPage.ts`). **Not Lucide, not any icon font or library**; earlier revisions of this document claimed Lucide React exclusivity, which was incorrect.
- This design system's bundled `components/` recreations use small glyph/text substitutes (✓ ✕ ◷ ▲ ▼) because they are prototyping aids with no npm dependencies — they do not match production icon markup. Read the `ICON_*` constants in the repo for the real thing.
- No decorative illustration or brand iconography exists anywhere in the product — every icon is functional (nav, status, action).

## Fonts — action needed

Anuphan and Space Grotesk are loaded from Google Fonts by URL in the live app (`index.html`, `fonts.googleapis.com`) — the source codebase ships no local font binaries. `tokens/fonts.css` mirrors that with a CSS `@import`, which renders correctly in-browser but does not register as a bundled `@font-face` asset for offline/consuming use. **If you'd like this design system to ship self-hosted font files** (for offline builds or stricter CSP), please upload the Anuphan and Space Grotesk `.woff2` files (or point us to a license-cleared source) and we'll wire up proper `@font-face` rules.

There is no `--font-mono` token: `tokens/typography.css` documents its deliberate absence, and no screen in `src/**` references one.

## Components — what's real vs. what's a prototyping aid

The production component surface is: `.gl-*` CSS classes in `src/styles/app.css` (buttons, inputs, badges, cards, notices, tables, stat grids, tabs, modals, action bars) plus TypeScript render functions in `src/components/**` and `src/pages/**`. The repo's `COMPONENTS.md` is the real catalogue.

Built in this package as prototyping aids (14, grouped by concern — see `components/`): **Button, Input, Select, Checkbox, Switch** (forms) · **Badge, StatusBadge, EmptyState** (feedback) · **Card, StatCard, MoneyText** (data) · **PageHeader, Tabs** (navigation) · **Dialog** (overlays). These are React recreations for fast mockups in a design tool — useful for sketching new screens, **not** something a change to the live app should import or match against for exact production fidelity. When in doubt, `COMPONENTS.md` and `src/styles/app.css` win.

## UI kit

`ui_kits/grace-ledger/index.html` is a click-through **prototype** covering login, the desktop dashboard shell (sidebar + topbar + hero balance + pending approvals + KPI stat cards + recent-transactions table), the income-entry wizard, and the approvals queue. It composes the prototyping components above — it is not a production reference. Mobile layouts are mocked separately in `mockups-extracted/Grace Ledger Mobile OS.dc.html`.

## Intentional additions

- `Tabs` — a segmented-pill `Tabs` was added to this package because range/period switches (เดือน/ปี) are a common pattern implied by the dashboard and reports screens. It is a prototyping convenience; the production tab pattern is `.gl-tablist`/`.gl-tab` (underline, not pills) — see `COMPONENTS.md`.

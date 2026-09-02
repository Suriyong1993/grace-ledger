# Grace Ledger — Design System

**Grace Ledger** is a Church Financial OS: a modern accounting, offerings, funds, budgets, approvals and audit-trail platform for churches. The product is built for church staff, treasurers, pastors and administrators who are not accounting experts — the visual language pairs fintech-grade clarity (Stripe/Linear/Mercury lineage) with the warmth and trust of a church organization.

This design system was built from the live **grace-ledger** codebase (React 19 + TanStack Router/Start + Tailwind CSS v4 + shadcn/ui), not from screenshots — every token and component below traces back to real source files.

**Sources used:**
- GitHub: [Suriyong1993/grace-ledger](https://github.com/Suriyong1993/grace-ledger) — primary source of truth for tokens (`src/styles.css`), the component library (`src/components/ui`, `src/components/shared`), and the design rulebook (`DESIGN.md`, `RESPONSIVE_GUIDELINES.md`). Explore this repo directly for anything not covered here — routes, services, the database schema, and the two approved mockup files (`Grace Ledger.dc.html`, `Grace Ledger Mobile.dc.html`).
- Local attached codebase: `grace-ledger/` (same project, read-only mount).
- Uploaded brand assets: `Logo.png`, `Logo mark -icon.png`, `App Icon.png`.

## Index

- `styles.css` — root stylesheet, imports everything under `tokens/`
- `tokens/` — colors, typography, spacing, radius, shadows, motion, fonts, base resets
- `assets/` — `logo.png`, `logo-mark.png`, `app-icon.png`
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Radius, Shadows, Motion, Brand groups in the Design System tab)
- `components/`
  - `forms/` — Button, Input, Select, Checkbox, Switch
  - `feedback/` — Badge, StatusBadge, EmptyState
  - `data/` — Card, StatCard, MoneyText
  - `navigation/` — PageHeader, Tabs
  - `overlays/` — Dialog
- `ui_kits/grace-ledger/` — interactive click-through: login → dashboard → income entry wizard → approvals queue
- `SKILL.md` — portable skill file for Claude Code / other agent environments

## Content fundamentals

- **Language:** All product copy is in Thai (the app's `lang="th"`); numerals and money render in Latin digits via Inter, never Thai digits — a deliberate choice so amounts stay scannable.
- **Voice:** Direct, procedural, calm. Labels are short imperative nouns/verbs — "บันทึกรายรับ" (record income), "ไปที่คิวอนุมัติ" (go to approval queue) — not conversational or cute. No exclamation points, no "!"-style enthusiasm.
- **Formality:** Polite but neutral register (no "ครับ/ค่ะ" particles in UI copy) — this is a work tool, not a chat assistant.
- **Numbers:** Currency is always `฿` + 2 decimals, real values — **never rounded for display**. Credit = green + `+` prefix, debit = red + `−` prefix, always both color *and* sign/icon (never color alone).
- **Empty/error states:** Always a real sentence + a concrete next action ("ยังไม่มีรายรับ" / "เริ่มบันทึกรายรับเพื่อดูข้อมูลที่นี่" + a button) — never a fake placeholder number or silent blank.
- **Emoji:** Not used anywhere in the product. Iconography carries meaning instead.
- **Vibe:** Calm · Exact · Spacious · Quiet · Honest (the product's own five governing words, from `DESIGN.md`). Nothing in the UI should trade clarity or auditability for decoration.

## Visual foundations

- **Palette (Emerald Vault, 2026-09):** Porcelain background (`#F4F5F2`) + white cards + ink-green text (`#14201A`), with a deep-evergreen brand (`#14532D`) for CTAs and a brass accent (`#B45309`) reserved for focus/secondary highlights — neither is ever a large background fill. The desktop sidebar is the identity's signature "vault": dark evergreen chrome (`--sidebar: #0B1F17`) over a porcelain workspace. Finance meaning is carried by three fixed hues that are never reused for anything else: emerald = income/approved, red = expense/rejected, amber = offering/pending. Max two background colors on any screen (white + porcelain).
- **Type:** Anuphan for Thai UI text, Space Grotesk for Latin/headline/numerals (Thai glyphs fall through to Anuphan — the mixed-script pairing is deliberate). Body is 15px/1.6, headings are 600–700 weight with −0.02em tracking and `text-wrap: balance`. All money/amount text uses `.num-display` (tabular-nums, lining-nums, Space Grotesk first) so digits align in columns.
- **Spacing:** Plain Tailwind 4px scale, no custom spacing tokens — table cells use a 20px/12px (x/y) compact default.
- **Backgrounds:** Flat color only. No gradients, no photography, no illustration, no texture/grain, no glassmorphism except a single hairline-blurred topbar. No full-bleed imagery — this is a data tool, not a marketing site.
- **Radius:** Buttons 12px, inputs 10px, cards 20px, dialogs 24px, sheets 28px, badges/pills fully round — but **tables and table cells are always 0px radius**; borders carry the depth cue there instead of rounding.
- **Cards:** White, 1px border (`var(--border)`), 20px radius, soft `shadow-sm-card`/`shadow-card` only — never a heavy shadow. Interactive cards get a 1px border color shift on hover, never a lift or scale-up.
- **Elevation:** Border beats shadow as the default depth cue; real shadow is reserved for genuine overlap (dialogs, popovers) and one "lifted" hero surface per screen at most.
- **Signature — the double ledger rule:** a real ledger closes a grand total with a heavy rule over a hairline. Figures the screen exists to answer (dashboard total balance, reports net surplus) get `.gl-total-rule` (2px over 1px, ink at 75%); nothing else uses it.
- **Motion:** Emil Kowalski's ease-out curve (`cubic-bezier(0.23,1,0.32,1)`) everywhere. Press/hover 100–150ms, dialogs/sheets 200–250ms, page transitions 250–300ms. **400ms is a hard ceiling** — nothing in the product animates longer. No bounce/spring/elastic easing on business UI, no `NumberTicker` count-up animation on money (ever — it reads as flashy for a finance app), respects `prefers-reduced-motion`.
- **Hover/press states:** Hover = subtle background tint or border-color shift, never a scale-up. Press = `scale(0.97–0.98)` only, no color flash.
- **Borders & depth:** 1px hairline borders throughout; no double borders, no colored left-border accent strips on generic cards (StatCard's left accent bar is the one intentional exception — a deliberate "financial terminal" motif, not decoration).
- **Transparency/blur:** Used in exactly one place — the sticky topbar (`background/80` + blur) so content scrolling underneath stays legible. Not used on cards, dialogs, or anywhere else.
- **Layout:** Desktop/iPad-first (sidebar + topbar), mobile is a secondary but fully-supported target (bottom nav + "more" sheet). 44px minimum touch target everywhere except table-row action buttons (36px, explicitly excepted).

## Iconography

- The live codebase uses **Lucide React** exclusively (16/20/24/32px, `strokeWidth: 1.5` default, `2` for active states) — no icon font, no PNG icon set, no emoji.
- This design system's bundled components avoid a Lucide dependency (components here are React-only, no npm packages) and use small glyph/text substitutes (✓ ✕ ◷ ▲ ▼) where the source uses a Lucide icon — **flagged substitution**: when building production screens from this system, prefer wiring up real Lucide icons (`lucide-react`, or the `lucide` CDN static SVGs) to match the source exactly.
- No decorative illustration or brand iconography exists anywhere in the product — every icon is functional (nav, status, action).

## Fonts — action needed

Anuphan and Space Grotesk are loaded from Google Fonts by URL in the live app (`fonts.googleapis.com`) — the source codebase ships no local font binaries. `tokens/fonts.css` mirrors that with a CSS `@import`, which renders correctly in-browser but does not register as a bundled `@font-face` asset for offline/consuming use. **If you'd like this design system to ship self-hosted font files** (for offline builds or stricter CSP), please upload the Sarabun and Inter `.woff2` files (or point us to a license-cleared source) and we'll wire up proper `@font-face` rules. The source repo also declares a `--font-mono` token (`JetBrains Mono`), but nothing in the product visibly uses it and no font file exists — it is intentionally omitted here; upload the file if you want it back.

## Components — what's built vs. what's left

Built (14, grouped by concern — see `components/`): **Button, Input, Select, Checkbox, Switch** (forms) · **Badge, StatusBadge, EmptyState** (feedback) · **Card, StatCard, MoneyText** (data) · **PageHeader, Tabs** (navigation) · **Dialog** (overlays).

These are the components used across the dashboard, income/approval flows, and forms shown in the UI kit. The live codebase's `src/components/ui/` folder has ~48 shadcn-based primitives in total (accordion, avatar, calendar, carousel, command palette, context-menu, drawer, dropdown-menu, hover-card, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, sidebar, skeleton, slider, tooltip, and more) plus product-specific pieces (`SundayCountSheet`, `ChurchHandwrittenFormScannerModal`, `SmartReceiptScannerModal`, `CommandPalette`, gauge charts, etc.) that are **not yet built here** — they exist in the source repo and can be added on request. Ask if you'd like the next batch (Avatar/Tooltip/Tabs-with-content/RadioGroup/Progress/Skeleton would be the highest-value additions).

## UI kit

`ui_kits/grace-ledger/index.html` is a click-through recreation covering: login, the desktop dashboard shell (sidebar + topbar + hero balance + pending approvals + KPI stat cards + recent-transactions table), the income-entry wizard, and the approvals queue. It composes the components above — it does not re-implement them. Mobile-specific layouts (bottom nav, full-screen sheets) are documented in `RESPONSIVE_GUIDELINES.md`'s rules but not separately mocked here yet.

## Intentional additions

- `Tabs` — the source repo has a shadcn `tabs.tsx` primitive but no screen we read used it visibly; a segmented-pill `Tabs` was added because range/period switches (เดือน/ปี) are a common pattern implied by the dashboard and reports routes.

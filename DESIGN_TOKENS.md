# Design Tokens — Grace Ledger v3.0

> Exact values as implemented in `src/styles.css`. See
> [`DESIGN_SYSTEM_V3.md`](./DESIGN_SYSTEM_V3.md) for rationale and usage
> rules. This file documents *what the code does*, not aspirational
> values — if it drifts from `src/styles.css`, the CSS file wins; update
> this doc to match.

## Colors (oklch)

All colors are CSS custom properties in `:root` (light) / `.dark`
(dark), re-exposed as Tailwind utilities via `@theme inline` in
`src/styles.css`. Each finance/status color has a `-foreground` (text on
that color) and, where used as a badge background, a `-muted` variant.

### Light mode

| Token | Value | Role |
|---|---|---|
| `--background` | `oklch(0.985 0.004 80)` | Page background — warm near-white |
| `--foreground` | `oklch(0.19 0.014 258)` | Body text — slate |
| `--card` | `oklch(1 0 0)` | Card surfaces — pure white |
| `--primary` | `oklch(0.53 0.17 258)` | CTAs, active states — muted blue |
| `--secondary` / `--muted` | `oklch(0.96 0.005 80)` / `oklch(0.965 0.004 80)` | Warm gray surfaces |
| `--muted-foreground` | `oklch(0.5 0.014 258)` | Secondary text |
| `--accent` | `oklch(0.94 0.02 258)` | Light blue tint |
| `--destructive` / `--expense` / `--rejected` | `oklch(0.55 0.17 25)` | Red |
| `--border` | `oklch(0.9 0.006 80)` | Warm gray border |
| `--income` / `--approved` / `--success` | `oklch(0.5 0.13 155)` | Emerald |
| `--offering` / `--pending` / `--warning` | `oklch(0.7 0.13 80)` | Amber |
| `--info` | `oklch(0.58 0.12 222)` | Sky — distinct from primary |
| `--chart-1..5` | Blue / Emerald / Red / Amber / Teal (`oklch(0.6 0.11 195)`) | Chart palette |

### Dark mode

| Token | Value |
|---|---|
| `--background` | `oklch(0.16 0.012 258)` |
| `--foreground` | `oklch(0.96 0.004 258)` |
| `--card` | `oklch(0.2 0.012 258)` |
| `--primary` | `oklch(0.68 0.15 258)` |
| `--destructive` / `--expense` / `--rejected` | `oklch(0.64 0.16 25)` |
| `--income` / `--approved` / `--success` | `oklch(0.6 0.13 155)` |
| `--offering` / `--pending` / `--warning` | `oklch(0.76 0.12 80)` |
| `--info` | `oklch(0.66 0.11 222)` |
| `--border` | `oklch(1 0 0 / 8%)` |

Full variable list (including `-foreground`/`-muted` pairs and sidebar
tokens) is in `src/styles.css` `:root`/`.dark` blocks — this table shows
the base hue per role, not every derived variant.

**Rule:** never hardcode a hex/oklch value in component code (`className`
string, inline `style`, SVG `stopColor` attribute). Always reference the
CSS custom property (`var(--color-primary)`) or the Tailwind utility
(`bg-primary`, `text-warning`). This rollout found 6 files that violated
this rule with stale v2.0 values — see the Final UI Migration Report.

## Typography

| Token | Value |
|---|---|
| `--font-sans` / `--font-display` | `"Inter", "Sarabun", ui-sans-serif, system-ui, sans-serif` |
| `--font-mono` | `"JetBrains Mono", "Fira Code", ui-monospace, monospace` |
| Body font size | 15px (`@layer base`, not Tailwind's 16px default) |
| Numeric display | `.num-display` utility — `tabular-nums`, `Inter` explicit override |

## Spacing

No custom tokens — Tailwind v4 default scale (`--spacing: 0.25rem` = 4px
multiplier). `p-1`=4px, `p-2`=8px, `p-3`=12px, `p-4`=16px, `p-5`=20px,
`p-6`=24px, `p-8`=32px, `p-10`=40px, `p-12`=48px, `p-16`=64px,
`p-24`=96px.

## Radius

```
--radius: 0.75rem;              /* 12px base */
--radius-sm:  calc(var(--radius) - 4px);  /* 8px */
--radius-md:  var(--radius);              /* 12px */
--radius-lg:  calc(var(--radius) + 4px);  /* 16px */
--radius-xl:  calc(var(--radius) + 8px);  /* 20px */
--radius-2xl: calc(var(--radius) + 12px); /* 24px */
--radius-full: 9999px;

--radius-button: 1.125rem;   /* 18px */
--radius-input:  var(--radius-lg);   /* 16px */
--radius-card:   var(--radius-2xl);  /* 24px */
--radius-dialog: 1.75rem;    /* 28px */
--radius-sheet:  2rem;       /* 32px */
```

Generates Tailwind utilities: `rounded-sm/md/lg/xl/2xl/full` plus
`rounded-button/input/card/dialog/sheet` (and directional variants,
e.g. `rounded-t-sheet`, used by the bottom-sheet Drawer).

## Elevation (shadows)

```
shadow-xs:      0 1px 2px 0 rgb(0 0 0 / 0.03)
shadow-sm-card: 0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.03)
shadow-card:    0 1px 2px 0 rgb(0 0 0 / 0.04), 0 3px 10px -4px rgb(0 0 0 / 0.04)
shadow-elevated:0 1px 4px -1px rgb(0 0 0 / 0.05), 0 6px 16px -6px rgb(0 0 0 / 0.06)
```

Softened from v2.0 — no heavy shadows anywhere, per the elevation rule.

## Breakpoints

Standard Tailwind: `sm` 640 / `md` 768 / `lg` 1024 / `xl` 1280 / `2xl`
1536. See `RESPONSIVE_GUIDELINES.md` for usage strategy.

## Motion

```
--ease-out:    cubic-bezier(0.23, 1, 0.32, 1)
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)
```

See `MOTION_GUIDELINES.md` for durations and the Framer Motion patterns
that use these.

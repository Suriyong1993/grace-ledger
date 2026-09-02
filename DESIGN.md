# DESIGN.md — Grace Ledger visual contract

> Target path: repo root, `DESIGN.md` (new file). Source of truth for every visual value in the product.
> Read this before writing any CSS or inline style. If a value you need is not here, it does not exist yet —
> add it deliberately and record why in `DECISIONS.md`, do not invent it inline.

## Hierarchy — where to look first

```
1. design-system-extracted/tokens/*.css   VALUES   — colors, type scale, spacing, radius, shadow, motion
2. src/styles/app.css                      CLASSES  — every .gl-* primitive/composite + shell + responsive rules
3. src/components/shared/*.ts (future)     HELPERS  — render*Html for patterns that need logic (status, row, empty)
4. feature stylesheets (loginStyles.ts,
   aiDrawerStyles.ts)                      Only for a surface with its own shell (login, AI drawer)
5. inline style=""                         LAYOUT ONLY — flex/grid/gap/min-width. Never color, radius, shadow, font-size.
```

If you are about to write a color, a pixel radius, a shadow, or a font-size as a literal in a `.ts` file:
stop. Either the token already exists (use it) or it doesn't (this is a design decision — record it).

## Colors

**Emerald Vault (2026-09).** Porcelain background (`--gl-bg` `#F4F5F2`), white cards, ink-green text
(`--gl-ink` `#14201A`), deep-evergreen brand (`--gl-evergreen-800` `#14532D`) for the primary CTA / active
nav / focus ring, and a brass accent (`--gl-brass-500` `#B45309`) for secondary highlights. Neither brand nor
accent is ever a large background fill, a data value, a progress bar, or a number. The desktop sidebar is the
identity's signature "vault": dark evergreen chrome (`--sidebar` `#0B1F17`) over the porcelain workspace.
Finance meaning is fixed and exclusive: emerald = income/approved, red = expense/rejected, amber =
offering/pending. Max two background colors per screen.

The token values live in `design-system-extracted/tokens/colors.css` and are canonical — see `DECISIONS.md`
→ D8. Do not reintroduce the pre-2026-09 orange palette (`--gl-orange-*`); it has no live consumers.

`--on-{income,expense,pending,info}-muted` are the text colors for content sitting on a `-muted` surface
(badges, notices, stat tiles). The `--*-foreground` tokens are for text on the **solid** color only — pairing
`--income-foreground` with `--income-muted` is a contrast bug, not a style choice.

## Typography

Anuphan (Thai) + Space Grotesk (Latin/numerals). Body 15px/1.6. Headings 600-weight, −0.02em tracking.
`.num-display` on every amount (tabular, lining, slashed-zero) — no exceptions. One date format across the
app: `23 ส.ค. 2569` (Thai Buddhist calendar, short month). Off-scale literal font sizes are banned; use the
`--text-*` scale.

## Radius (live values — see `DECISIONS.md` → D8; D1's earlier set is superseded)

Values below are read from `design-system-extracted/tokens/radius.css` as shipped. `app.css` consumes these
tokens directly (`var(--radius-card)` at `.gl-card`, `var(--radius-input)`, `var(--radius-dialog)`, …), so
editing the token file changes the rendered product immediately.

| Token             | Value  | Used by                                                                             |
| ----------------- | ------ | ----------------------------------------------------------------------------------- |
| `--radius`        | 10px   | base                                                                                |
| `--radius-sm`     | 6px    | small chips, nav item (via `AppShell.ts`'s own style block)                         |
| `--radius-md`     | 10px   | surfaces that aren't full cards (`.gl-surface`, table-card mode, stat, notice base) |
| `--radius-lg`     | 12px   | `.gl-notice`, `.gl-toast`, `.gl-stat`                                               |
| `--radius-xl`     | 14px   | —                                                                                   |
| `--radius-2xl`    | 18px   | —                                                                                   |
| `--radius-card`   | 20px   | `.gl-card` and all its variants                                                     |
| `--radius-button` | 12px   | `.gl-btn`                                                                           |
| `--radius-input`  | 10px   | `.gl-input`, `.gl-select`, `.gl-textarea`                                           |
| `--radius-dialog` | 24px   | `.gl-modal-content`                                                                 |
| `--radius-sheet`  | 28px   | reserved for the R2 `.gl-sheet` primitive — not yet used                            |
| `--radius-full`   | 9999px | pills, badges, avatars                                                              |
| `--radius-table`  | 0px    | **documented but not currently honored** — see Open Findings below                  |

Control height (button/input): **46px**, a literal in `app.css` (`.gl-btn`, `.gl-input` — the later of the
two declaration blocks wins). `--touch-target-min` (44px) remains the accessibility floor and is unchanged.

## Shadows

Border beats shadow. Shadows are ink-green tinted (`rgb(16 32 24 / …)`) so they sit inside the porcelain
palette — values in `design-system-extracted/tokens/shadows.css`. Real shadow is reserved for genuine overlap
(dialogs) and the one "lifted" hero surface per screen (`.gl-card--elevated`, used once on the dashboard
balance card — a flat card plus the faint `--shadow-card`; the old decorative radial-gradient wash was
removed in the Emerald Vault revision and must not come back).

## Motion

`--ease-out` + `--duration-micro`/`--duration-component` everywhere. 400ms is a hard ceiling. No bounce/spring
on business UI. `--ease-spring` exists and is **in active use in the login surface only**
(`src/components/login/loginStyles.ts`) — do not use it elsewhere without a documented reason.

## Overlays (D3 — approved, not yet applied)

**Target state:** `.gl-modal-content` is a solid `--popover` surface with `--shadow-elevated`. Glass/blur is
banned on modals. **Current state:** still glass — `background: color-mix(in srgb, var(--popover) 88%,
transparent)` + `backdrop-filter: blur(20px) saturate(160%)` (`src/styles/app.css`). D3 lands in R1-d; until
it does, this section documents the decision, not the shipped pixels.
The **one** sanctioned blur in the product is the sticky topbar (`background/88%` + `blur(10px)`). The modal
backdrop keeps a light 3px blur (cheap, aids focus, not glassmorphism on content).

## Status semantics (D2)

One map, owned by `src/components/shared/StatusBadge.ts` (R3 — not yet created):

| Status             | Label       | Badge variant |
| ------------------ | ----------- | ------------- |
| `draft`            | ฉบับร่าง    | neutral       |
| `pending_approval` | รออนุมัติ   | pending       |
| `approved`         | อนุมัติแล้ว | approved      |
| `posted`           | ลงบัญชีแล้ว | **info**      |
| `rejected`         | ปฏิเสธ      | rejected      |
| `voided`           | ยกเลิกแล้ว  | **neutral**   |

## Iconography

Inline SVG only, 24 viewBox, `stroke-width="1.8"` default / `"2"` for active states, `aria-hidden="true"` on
every decorative icon. No icon font, no PNG set, no emoji anywhere in the product (CLAUDE.md ban).

## Banned

Generic glass cards (except the topbar exception above), gradients-for-decoration (except the one documented
hero exception), glowing borders, giant hero sections, fake charts, decorative metrics, emoji as UI
iconography, bilingual double-labels, count-up number animation on money, any new accent color without a
`DECISIONS.md` entry.

## Open findings (recorded, not yet resolved — do not silently fix)

- `.gl-table` currently renders with `border-collapse: separate` + `border-radius: var(--radius-lg)` (rounded
  corners), contradicting `--radius-table: 0px` and the "tables never round" rule stated in this file's
  predecessor documentation. This is the **current live behavior** and was preserved as-is in R1. Needs an
  explicit decision before it is changed either direction.
- `--radius-sheet` is set but unused until the R2 `.gl-sheet` primitive exists.

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

Palette is unchanged from the original design system. Warm off-white background, white cards, charcoal
text, one orange accent reserved for the primary CTA / active nav / focus ring — never a data value, never
a progress bar, never a number. Finance meaning is fixed and exclusive: emerald = income/approved, red =
expense/rejected, amber = offering/pending. Max two background colors per screen.

`--on-{income,expense,pending,info}-muted` are the text colors for content sitting on a `-muted` surface
(badges, notices, stat tiles). The `--*-foreground` tokens are for text on the **solid** color only — pairing
`--income-foreground` with `--income-muted` is a contrast bug, not a style choice.

## Typography

Sarabun (Thai) + Inter (Latin/numerals). Body 15px/1.6. Headings 600-weight, −0.02em tracking.
`.num-display` on every amount (tabular, lining, slashed-zero) — no exceptions. One date format across the
app: `23 ส.ค. 2569` (Thai Buddhist calendar, short month). Off-scale literal font sizes are banned; use the
`--text-*` scale.

## Radius (D1 — canonicalized 2026-09-02, see `DECISIONS.md`)

| Token | Value | Used by |
|---|---|---|
| `--radius-sm` | 8px | small chips, nav item (via `AppShell.ts`'s own style block) |
| `--radius-md` | 12px | surfaces that aren't full cards (`.gl-surface`, table-card mode, stat, notice base) |
| `--radius-lg` | 16px | `.gl-notice`, `.gl-toast`, `.gl-stat` (via the shipped visual layer) |
| `--radius-card` | **16px** (was 24px) | `.gl-card` and all its variants |
| `--radius-button` | **12px** (was 18px) | `.gl-btn` |
| `--radius-input` | **12px** (was 14px) | `.gl-input`, `.gl-select`, `.gl-textarea` |
| `--radius-dialog` | **20px** (was 28px) | `.gl-modal-content` |
| `--radius-sheet` | **20px** (was 32px) | reserved for the R2 `.gl-sheet` primitive — not yet used |
| `--radius-full` | 9999px | pills, badges, avatars |
| `--radius-table` | 0px | **documented but not currently honored** — see Open Findings below |

Control height (button/input): **46px**, a literal in `app.css` (not a token) — approved as part of D1.
`--touch-target-min` (44px) remains the accessibility floor and is unchanged.

## Shadows

Border beats shadow. `--shadow-card` and `--shadow-elevated` are canonicalized to the values already shipped
(faint, two-layer). Real shadow is reserved for genuine overlap (dialogs) and the one "lifted" hero surface
per screen (`.gl-card--elevated`, used once on the dashboard balance card — its radial-gradient wash is a
documented, sanctioned exception, not decoration).

## Motion

`--ease-out` + `--duration-micro`/`--duration-component` everywhere. 400ms is a hard ceiling. No bounce/spring
on business UI. `--ease-spring` exists and is **in active use in the login surface only**
(`src/components/login/loginStyles.ts`) — do not use it elsewhere without a documented reason.

## Overlays (D3 — flattened 2026-09-02)

`.gl-modal-content` is a solid `--popover` surface with `--shadow-elevated`. Glass/blur is banned on modals.
The **one** sanctioned blur in the product is the sticky topbar (`background/88%` + `blur(10px)`). The modal
backdrop keeps a light 3px blur (cheap, aids focus, not glassmorphism on content).

## Status semantics (D2)

One map, owned by `src/components/shared/StatusBadge.ts` (R3 — not yet created):

| Status | Label | Badge variant |
|---|---|---|
| `draft` | ฉบับร่าง | neutral |
| `pending_approval` | รออนุมัติ | pending |
| `approved` | อนุมัติแล้ว | approved |
| `posted` | ลงบัญชีแล้ว | **info** |
| `rejected` | ปฏิเสธ | rejected |
| `voided` | ยกเลิกแล้ว | **neutral** |

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

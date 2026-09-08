# Dashboard offering shortcut uses offering/pending color, not income color

Written against: 3d533d9af19172b3e41037a2c9ec9d965fa89a61

## Evidence chain

- Surface: Dashboard (`src/pages/DashboardPage.ts`, "ต้องการให้คุณตรวจสอบ" section, "เงินถวายวันอาทิตย์" row)
- Problem: The Sunday-offering quick-link row's icon uses `var(--income-muted)` / `var(--on-income-muted)` (emerald/income), not the offering/pending token pair.
- Design evidence: `design-system-extracted/readme.md:39` — "Finance meaning is carried by three fixed hues that are never reused for anything else: emerald = income/approved, red = expense/rejected, amber = offering/pending." `design-system-extracted/tokens/colors.css:53-58` defines `--offering`, `--offering-muted`, and aliases `--pending`/`--pending-muted` to the same offering hue — a distinct token pair from `--income`/`--income-muted` (colors.css:47-49).
- Owner: `--pending-muted` / `--on-pending-muted` tokens (`design-system-extracted/tokens/colors.css:56-58`, `src/styles/app.css:25` for the `--on-pending-muted` foreground helper). Already consumed correctly one row above by the approvals row icon.
- Scope and affected surfaces: `src/pages/DashboardPage.ts` only — no other page renders this row.
- Uncertainty: None.

## Design decision

Recolor the offering row's icon chip from the income token pair to the pending/offering token pair, so the row reads as "needs counting/attention" (its actual meaning) instead of "money already received" (income's meaning). This is a same-file, same-pattern fix — the row immediately above it in the same section already uses the correct tokens.

## Reuse

- `--pending-muted` (background)
- `--on-pending-muted` (icon color)
- Exemplar: `src/pages/DashboardPage.ts:482-483` — the approvals row icon in the same section already does `background: ${hasPending ? "var(--pending-muted)" : "var(--secondary)"}; color: ${hasPending ? "var(--on-pending-muted)" : "var(--muted-foreground)"};`

No new primitive required.

## Changes

1. `src/pages/DashboardPage.ts` — the "เงินถวายวันอาทิตย์" row (around line 497)
   - Change: replace `background: var(--income-muted); color: var(--on-income-muted);` with `background: var(--pending-muted); color: var(--on-pending-muted);` on the `gl-row__icon` span wrapping `ICON_OFFERING`.
   - Preserve: the row's markup, link target (`#/offerings`), icon glyph (`ICON_OFFERING`), copy, and every other row/section on the page.
   - Verify: rendered icon chip on that row shows the amber offering/pending background and foreground, matching the approvals row's amber directly above it; no other row's color changes.

## Scope

- Inherit: none — single row, single file.
- Verify: no other page constructs this same "เงินถวายวันอาทิตย์" row (confirm via search for `ICON_OFFERING` usage before editing).
- Exclude: the row's icon glyph, copy, link, and layout; the approvals row above it (already correct, untouched).

## Validation

- Product: load the dashboard as a church user; confirm the Sunday-offering row is now visually distinct from "income already recorded" and reads as an action/attention item, consistent with the approvals row above it.
- Interface: dashboard route, both light and dark theme (`.dark` overrides for `--offering-muted`/`--pending-muted` in colors.css:120-125), desktop and 390px.
- System: confirm no other surface references `var(--income-muted)` for this same offering-shortcut concept (grep `ICON_OFFERING` and `เงินถวายวันอาทิตย์`), so the fix isn't reintroduced elsewhere.
- Repository: `npm run build` → typecheck clean (no logic touched, style-string-only change, but keep the gate).

## Stop conditions

- Stop if `ICON_OFFERING` / this row pattern turns out to be duplicated on another page with the same income-color mistake — widen scope to a shared fix instead of patching DashboardPage.ts alone.

## Design documentation

- After acceptance and validation: none — this restores existing documented token usage, it does not create a new decision.

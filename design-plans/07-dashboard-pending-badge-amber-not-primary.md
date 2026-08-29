# Dashboard pending-approvals count badge uses brand orange, not pending color

Written against: 3d533d9af19172b3e41037a2c9ec9d965fa89a61

## Evidence chain

- Surface: Dashboard (`src/pages/DashboardPage.ts`, "ต้องการให้คุณตรวจสอบ" section header)
- Problem: The `${data.pendingApprovalsCount} เรื่อง` count badge next to the section heading colors itself `var(--primary)` (brand orange) when `hasPending` is true. The row icon directly below it, for the identical pending-approvals concept, colors itself `var(--pending-muted)`/`var(--on-pending-muted)` (amber) when `hasPending` is true — a direct contradiction inside the same section.
- Design evidence: `design-system-extracted/readme.md:39` fixes amber as the pending color, "never reused for anything else" (and by the same rule, pending is never shown in another hue). `src/styles/app.css:339-343` — `.gl-badge--pending` (used elsewhere in this exact app for pending status) is amber (`--pending-muted`/`--pending`/`--on-pending-muted`), confirming the app's own governing pattern.
- Owner: `--pending` token (`design-system-extracted/tokens/colors.css:56`).
- Scope and affected surfaces: `src/pages/DashboardPage.ts` only.
- Uncertainty: None.

## Design decision

Recolor the count badge text from `var(--primary)` to `var(--pending)` so both elements in the section — the count and the row icon — agree on amber as "pending" and orange stays reserved for CTAs/active states per the documented rule.

## Reuse

- `--pending` (text color)
- Exemplar: `src/pages/DashboardPage.ts:482-483` (row icon, same section) and `src/styles/app.css:339-343` (`.gl-badge--pending`)

No new primitive required.

## Changes

1. `src/pages/DashboardPage.ts` — section header badge (around line 475)
   - Change: replace `hasPending ? "var(--primary)" : "var(--muted-foreground)"` with `hasPending ? "var(--pending)" : "var(--muted-foreground)"`.
   - Preserve: the badge's markup, `num-display` class, copy (`${data.pendingApprovalsCount} เรื่อง`), the false-state color (`--muted-foreground`), and everything else in the section.
   - Verify: when there are pending approvals, the count text renders amber, matching the row icon below it; when there are none, both stay muted as before.

## Scope

- Inherit: none — single element, single file.
- Verify: confirm no other page reuses this exact header-count pattern with `--primary` for a pending concept (grep for `hasPending` and `pendingApprovalsCount`).
- Exclude: the heading text, the row below it, the rest of the page's `--primary` usage (nav actives, CTAs — correctly orange and out of scope).

## Validation

- Product: load the dashboard with at least one pending approval; confirm the count badge and the row icon read as the same color/meaning.
- Interface: dashboard route, both light and dark theme (`.dark` `--pending`/`--offering` override in colors.css:120-125), desktop and 390px, both `hasPending` true/false states.
- System: confirm `--primary` remains untouched everywhere else on the page (quick-action CTA, links) — this change must not bleed into brand-accent usage.
- Repository: `npm run build` → typecheck clean.

## Stop conditions

- Stop if `hasPending` styling is found to be intentionally shared with a non-pending "attention needed" concept elsewhere — confirm with the person who owns that section before recoloring.

## Design documentation

- After acceptance and validation: none — restores existing documented token usage.

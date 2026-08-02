# Grace Ledger — Design System v3.0

> **This is the single source of truth for UI/UX in Grace Ledger.**
> It supersedes `docs/archive/DESIGN_SYSTEM_V2.md` and
> `docs/archive/DESIGN_BIBLE_V2.md`, both archived and non-authoritative.
> See also: [`DESIGN_TOKENS.md`](./DESIGN_TOKENS.md) (exact values),
> [`COMPONENT_LIBRARY.md`](./COMPONENT_LIBRARY.md) (per-component spec),
> [`MOTION_GUIDELINES.md`](./MOTION_GUIDELINES.md),
> [`RESPONSIVE_GUIDELINES.md`](./RESPONSIVE_GUIDELINES.md).

## Governing Principle

**This is financial software. Usability always outranks visual beauty.**
If a design choice reduces data-entry speed, readability, auditability,
or financial clarity, it is rejected — regardless of how premium it
looks. Optimize for trust, efficiency, and clarity first. Aesthetic
improvements must never cost productivity. This is the tiebreaker for
every design decision in this system.

## DNA

Apple Human Interface × Stripe Dashboard × Linear × Mercury × Revolut ×
Notion. Financial software first, church software second. The interface
should communicate **trust, clarity, precision, and professionalism** —
never a generic admin template, never AI-generated-looking.

## Design Principles

- Everything must breathe — whitespace is a feature, never fill every pixel.
- Content first — financial values are always the visual focus, not decoration.
- No visual noise, no decoration without purpose.
- One design language, one component library, one motion system, one
  typography system, one color system. One source of truth.

## Color System

Neutral foundation (White / Warm Gray / Slate) + 5 muted semantic
accents. Never oversaturated. See `DESIGN_TOKENS.md` for exact oklch
values.

| Role | Hue | Used for |
|---|---|---|
| Primary | Blue | CTAs, active states, links, authority |
| Success / Income / Approved | Emerald | Positive money flow, approved status |
| Warning / Offering / Pending | Amber | Offerings (sacred), items awaiting approval |
| Destructive / Expense / Rejected | Red | Outflow, danger, rejected status |
| Info | Sky | Neutral informational (distinct from primary) |

Never hardcode a hex/oklch value in component code — always reference
the semantic token (`var(--color-primary)`, `bg-warning`, etc.). This
rollout found and fixed 6 files where a hardcoded v2.0 color had drifted
silently out of sync with the actual palette — this is the exact failure
mode the token system exists to prevent.

## Typography

- **Latin/UI/numbers:** Inter.
- **Thai:** Sarabun — kept deliberately. Inter renders Thai poorly, and
  this is a Thai-first application; this is a documented exception to a
  Latin-only spec, not an oversight.
- **Numbers:** Inter + `tabular-nums` always, via the `.num-display`
  utility or `MoneyText` component. Financial values are the single
  visual focus of every screen.
- Minimum body size 15px — many users are senior church volunteers.

## Spacing

Tailwind v4's default 4px-multiplier scale (`p-1`…`p-24` = 4, 8, 12, 16,
20, 24, 32, 40, 48, 64, 96px) already satisfies the 8px-grid requirement.
No custom spacing tokens — use the standard scale.

## Radius

Explicit element-scoped tokens, a significant increase from v2.0's
4–16px scale:

| Element | Token | Value |
|---|---|---|
| Cards | `rounded-card` | 24px |
| Buttons | `rounded-button` | 18px |
| Inputs / Select | `rounded-input` | 16px |
| Dialogs | `rounded-dialog` | 28px |
| Sheets / Drawers | `rounded-sheet` | 32px |

Generic scale (`rounded-sm/md/lg/xl/2xl`) remains for elements without a
named token (badges use `rounded-full`, icon containers typically
`rounded-lg`).

## Elevation

No heavy shadows — soft, subtle depth only. No borders unless
functionally required (table dividers, input outlines).

## Icons

Lucide React exclusively. 16/20/24/32px per context, `strokeWidth: 1.5`
default, `2` for active states only.

## Motion

Framer Motion is the **only** animation framework. See
`MOTION_GUIDELINES.md`. GSAP was fully removed during the v3.0 rollout —
no remaining use case existed that Framer Motion couldn't cover.

## Accessibility

WCAG AA minimum contrast, full keyboard navigation, visible
`:focus-visible` rings, screen-reader support via Radix/shadcn
primitives, 44px minimum touch targets (with a documented exception for
dense table-row actions — see `COMPONENT_LIBRARY.md`).

## Financial UX

- Financial values are always the visual focus — large, bold, tabular numbers.
- Totals are visually dominant.
- Destructive/approval actions always require a confirmation dialog.
- Status is always communicated by color **and** icon, never color alone.
- Audit trail information (hash-chain verification) must stay discoverable.

## Church Context

Users include pastors, treasurers, finance committee members, volunteers,
and senior members — not all technically sophisticated. Design for
trust, clarity, and confidence over cleverness.

## Quality Bar

Every screen should be evaluated as a premium SaaS product — never a
generic admin dashboard, never obviously AI-generated. See
`docs/archive/` for the two prior, conflicting design docs this system
replaced (kept for historical reference only).

## History

- **v2.0** (`docs/archive/DESIGN_SYSTEM_V2.md`) — Indigo primary,
  Sarabun-first typography, 4–16px radius. Matched the live
  `src/styles.css` at the time; superseded, not deleted.
- **DESIGN_BIBLE v2** (`docs/archive/DESIGN_BIBLE_V2.md`) — a parallel,
  never-implemented direction (Gold Amber primary, Kanit/Prompt,
  iPad-first). Conflicted with `DESIGN_SYSTEM_V2.md`; neither is
  authoritative now.
- **v3.0** (this document) — defined fresh from `refer/MasterPrompt.txt`'s
  DNA rather than reconciling the two prior docs, per explicit product
  decision. Implemented across a 10-phase rollout on the
  `feature/design-system-v3` branch — see git history for the full
  phase-by-phase record.

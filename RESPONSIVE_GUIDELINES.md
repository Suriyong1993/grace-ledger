# Responsive Guidelines — Grace Ledger v3.0

## Platform priority

**Desktop/laptop-first, with iPad weighted as an equally-important
second target.** Phone is functional but secondary. This was a deliberate
product decision (not inherited from either archived design doc, which
disagreed with each other and with this) — reasoning:

- This is financial software with dense tables and multi-step approval
  workflows — data-entry-heavy, not content-consumption-heavy.
- The codebase's actual breakpoint usage already skewed toward `sm`/`md`
  (mobile/tablet) _without_ deliberate desktop/ultrawide design attention
  — that gap is what v3.0 fixes, not a reason to deprioritize desktop.
- MasterPrompt.txt's "every screen usable one-handed" requirement is
  satisfied as a _constraint_ (44px touch targets, working bottom nav),
  not as the primary design frame.

## Breakpoints

Standard Tailwind, unmodified: `sm` 640px / `md` 768px / `lg` 1024px /
`xl` 1280px / `2xl` 1536px.

`lg` (~1024px) is the iPad-equivalent breakpoint and gets first-class
treatment, not just "the point where mobile styles stop." `2xl`
(ultrawide) previously had **zero** dedicated usage anywhere in the
app — this is a known gap, not yet fully addressed by this rollout
(token/component work took priority; per-screen `2xl` layout tuning is
follow-up work, starting with Dashboard which the blueprint specifically
flagged for this).

## Layout shell

- **Desktop/iPad (`lg+`):** `AppSidebar` (collapsible icon rail) + `AppTopbar`, no bottom nav.
- **Mobile (`< md`):** `BottomNav` (5-item bar + "more" Sheet for the rest of `AppNav`'s nav groups), sidebar hidden.
- Single nav-data source (`src/components/layout/AppNav.tsx`) drives both — no divergent link lists to keep in sync.

## Component-level responsive rules

| Component    | Mobile                                                                                            | Desktop/iPad                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Dialog       | Full-screen (`inset-0`, no radius, no border)                                                     | Centered modal (`sm+`: `rounded-dialog`, bordered, `shadow-elevated`)           |
| Sheet        | Full-width on the trigger side                                                                    | Fixed max-width panel (`sm:max-w-md`)                                           |
| Table        | Horizontal scroll; prefer hiding/collapsing low-priority columns over truncating financial values | Full column set                                                                 |
| Card grids   | Single column                                                                                     | `sm`/`lg`/`xl` progressively add columns (see individual routes' `grid-cols-*`) |
| Button/Input | 44px min height always (touch target)                                                             | Same — no shrinking below 44px just because pointer is available                |

## Testing checklist (per screen, before considering it "done")

- [ ] `sm` (375/320px) — no horizontal overflow, touch targets ≥44px
- [ ] `md` (768px) — bottom nav/sidebar transition point behaves correctly
- [ ] `lg` (1024px) — the iPad target; validate this explicitly, not just as a mobile/desktop midpoint
- [ ] `xl` (1280px) — standard desktop
- [ ] `2xl` (1536px) — no wasted whitespace; for data-dense screens, extra width should surface more information (more table columns, wider grids), not just wider margins, per the Governing Principle (usability over decoration)
- [ ] Both light and dark mode at each breakpoint

**Not yet verified** in this rollout — no browser was available in the
implementation sandbox. This checklist should be run manually (or via
Playwright/visual regression tooling) before merge, per the blueprint's
Visual Regression Strategy.

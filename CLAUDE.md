# Grace Ledger — Working Agreement

Church financial OS. Thai UI. Money is the product; a wrong number is worse than an ugly screen.

## Stack (verify before assuming)

- Vanilla TypeScript + Vite. **No React, no framework, no component library.**
- Rendering: `render*Html(props): string` functions + `attachEventListeners(root)`. Full re-render on state change.
- `decimal.js` via `src/lib/money.ts` for every amount. Never `number` for money.
- Supabase (PostgreSQL 17) — RPCs, RLS, RBAC in `supabase/`.
- Tests: vitest (`npm test`). Typecheck: `npm run build` (= `tsc --noEmit`).
- Design tokens: `design-system-extracted/tokens/*.css`, imported through `src/styles/app.css`.

Baseline as of 2026-08-20: 19 test files / 148 tests green, typecheck clean. Keep it that way.

## QUALITY GATES

Every significant feature passes all five before it is called done:

1. **Functional correctness** — happy path + failure path both exercised.
2. **Financial correctness** — amounts, signs, rounding, fund balances, posting rules. Prove with tests, not by reading.
3. **Security review** — RLS/RBAC still enforced, no data leaked across churches, no unvalidated input reaching an RPC.
4. **UX review** — desktop and 390px, all states present (loading / empty / error / success / disabled / permission-denied / stale / validation).
5. **AI-slop / writing review** — see Writing below.

Blocking gate: any CRITICAL finding. A gate is not passed by intention, only by evidence (test output, screenshot, diff).

## Financial safety — hard stops

Never change, as a side effect of any other work:

- money calculations, fund math, sign conventions
- transaction lifecycle, approval rules, posting rules
- database schema, migrations, Supabase RPC behavior
- RLS / RBAC / audit trail

If a UI or refactor task requires one of these, **stop and report**: problem, impact, required change. Do not silently modify backend behavior.

## Design

`design-system-extracted/` is the visual source of truth. Upgrade the craft, do not replace the identity.

- Reuse existing tokens: color, typography, spacing, radius, shadow, motion. No new palette, no new framework, no new component library.
- Color carries fixed meaning: neutral = structure, emerald/`--income` = positive, amber/`--pending` = attention, red/`--expense` = error. No accent color without a documented reason.
- `--*-foreground` tokens are for text on the **solid** color, not on the `-muted` surface. Pairing them is a contrast bug.
- Border and subtle elevation over heavy shadow. Not every section is a card.
- One primary action per screen. Destructive actions never look like the primary.
- Motion only for transition, confirmation, hierarchy, or state change. Short, subtle, respects `prefers-reduced-motion`.
- Mobile target is 390px. No horizontal overflow in a core workflow. Touch targets ≥44px (`--touch-target-min`).
- Accessibility: keyboard focus, visible focus ring, real `<label for>`, semantic buttons, contrast, error announcement, decorative SVG `aria-hidden`.

Do not add an AI-looking design system on top of the existing one. Banned: generic glass cards, gradients-for-decoration, glowing borders, giant hero sections, fake charts, decorative metrics, emoji as UI iconography.

## Writing (Thai UI copy)

- Concise human Thai. Say the state, not an essay about the state.
- No internal vocabulary in the UI: no "Screen 06", no "Slice 3 E2E …", no "PostgreSQL 17", no "(Status: counting)", no raw exception strings.
- No bilingual double-labels — "จัดการผลต่าง (Variance Resolution)" is documentation, not UI. Pick Thai.
- No vague declaratives, no over-explaining an obvious state.

```
BAD:  ระบบตรวจพบความคลาดเคลื่อนของยอดเงินซึ่งอาจส่งผลกระทบต่อความถูกต้องของข้อมูล
GOOD: ยอดไม่ตรงกัน ฿50

BAD:  ไม่พบข้อมูลที่เกี่ยวข้องในระบบ ณ ขณะนี้
GOOD: ยังไม่มีรายการ
```

- Dates: one format across the whole app. Today the app mixes `23 ส.ค. 2569` and `2026-08-23` — pick one and use it everywhere.

## No lazy shortcuts

No fake data, no placeholder identity in a production path, no hardcoded financial numbers, no duplicate components, no skipped loading/error states, no `TODO` shipped as behavior, no disabling functionality to make a test pass.

## Workflow

1. Read the existing implementation before changing it. Reuse before adding.
2. Smallest safe change per step.
3. `npm test` + `npm run build` after each step.
4. UI component tests assert on rendered HTML strings — markup refactors break them. Update tests deliberately, never by loosening the assertion to nothing.
5. Verify in a browser at desktop and 390px. Compare before/after.
6. Document what changed.

Do not redesign the whole app at once. Do not start new milestone features inside a polish task.

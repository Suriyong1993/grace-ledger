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
4. **UX review** — desktop and 390px, all states present (loading / empty / error / success / disabled / permission-denied / stale / validation). `npm run lint:design` passes — no undocumented literal color/radius/shadow/font-size values were introduced.
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

`design-system-extracted/` is the visual source of truth. **Identity: "Emerald Vault" (2026-09)** — porcelain surfaces, deep-evergreen brand, dark vault sidebar, brass accents. Upgrade the craft, do not replace the identity.

- Reuse existing tokens: color, typography, spacing, radius, shadow, motion. No new palette, no new framework, no new component library.
- Color carries fixed meaning: neutral = structure, emerald/`--income` = positive, amber/`--pending` = attention, red/`--expense` = error. No accent color without a documented reason.
- `--*-foreground` tokens are for text on the **solid** color, not on the `-muted` surface. Pairing them is a contrast bug. Inside the dark vault sidebar, derive dimmed text from `--sidebar-foreground`, never `--muted-foreground`.
- Fonts: Anuphan (Thai body/UI) + Space Grotesk (Latin/headline/numerals). `.num-display` is tabular; every money value uses it.
- Signature: `.gl-total-rule` — the double ledger rule (2px over 1px) that closes a grand total. Use only on the figure a screen exists to answer.
- Border and subtle elevation over heavy shadow. Not every section is a card. Empty states use the shared `gl-empty-center` family; icons are per-page `ICON_*` inline SVGs — never emoji or unicode glyphs.
- One primary action per screen. Destructive actions never look like the primary.
- Motion only for transition, confirmation, hierarchy, or state change. Short, subtle, respects `prefers-reduced-motion`. Press feedback lands instantly on `:active` (`scale(0.97)`).
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

## Design source of truth

Read `DESIGN.md` and `COMPONENTS.md` before writing or changing any CSS, inline style, or render markup.

```
1. design-system-extracted/tokens/*.css   VALUES
2. src/styles/app.css                      CLASSES (.gl-*)
3. src/components/shared/*.ts              HELPERS (status, row, empty-state — once created)
4. loginStyles.ts / aiDrawerStyles.ts      Feature-local stylesheets — only for surfaces with their own shell
5. inline style=""                         LAYOUT ONLY — flex/grid/gap/min-width. Never color, radius, shadow, font-size.
```

Never re-declare an existing `.gl-*` selector a second time in `app.css` — edit the one declaration that
exists. A literal color/radius/shadow/font-size value appearing in `src/**` outside `DESIGN.md`'s documented
exceptions is either a bug or an undocumented decision — fix the bug, or add a `DECISIONS.md` entry, never
both silently. `npm run lint:design` enforces this mechanically; it must pass.

Status labels and colors for `TransactionStatus` come from exactly one place (see `DESIGN.md` → Status
semantics). Do not add a second status→label map anywhere.

## Single source of truth — mandatory

Every fact that must change together has exactly one authoritative home. This includes brand colors, semantic colors, typography tokens, spacing, URLs, contact details, shipping/pricing rules, feature flags, permission rules, and shared business calculations. Do not copy the same literal, default, or rule into multiple screens or services.

Before creating or changing a value or behavior, search the entire repository first. Search by the literal value, the relevant symbol, and the concept name. Inspect all matches, including CSS, TypeScript, HTML, SQL, tests, fixtures, and configuration. If an existing source of truth exists, reuse it and report its file path. If none exists, create one deliberately in the appropriate config/token/domain module and document why.

When duplicate truth is found, do not patch matches one at a time and stop. First classify the matches: authoritative definition, consumer, intentional exception, test fixture, or stale duplicate. Move the authoritative value to one named export/token/configuration/RPC, replace every consumer with a reference to it, and leave intentional exceptions explicitly documented. A similar-looking component is not automatically the same behavior; consolidate only when it must change together.

A task is not complete until a repository-wide search proves the migration is complete. The completion report must state: the old literal or rule searched for, the number and paths of matches before and after, the new source-of-truth file, every intentional remaining match, and the tests/build/browser checks performed. Never say “แก้ครบแล้ว” based only on one screen or one file.

For visual changes, verify every route and shared component at desktop and 390px. For a brand color change, search all color literals and token references, inspect generated CSS, and open each affected route. Prefer semantic tokens such as `--primary`, `--income`, or a named TypeScript constant over raw hex values. Example:

```ts
// src/config/theme.ts
export const BRAND = "#16a34a";
```

Every consumer imports `BRAND`; no consumer retypes `#16a34a`. Do not add a second theme/config file without first proving the existing one cannot own the value.

## No lazy shortcuts

No fake data, no placeholder identity in a production path, no hardcoded financial numbers, no duplicate components, no skipped loading/error states, no `TODO` shipped as behavior, no disabling functionality to make a test pass.

## Workflow (JoejaBrain Standard)

ทุก Agent ทำงานร่วมกันผ่าน `.brain/` (Universal Workflows & State):
1. **Brief & State Check**: อ่าน `.brain/WORKING_CONTEXT.md` และ `.brain/MEMORY.md` เสมอ (`.brain/workflows/01_brief.md`)
2. **Feature Planning & Focus**: ใช้ `/gl-spec` และ `/gl-plan` แบ่งงานตาม P0-P3 (`.brain/workflows/02_focus.md`)
3. **Execution & Build**: ใช้ `/gl-build` หรือเขียนโค้ดทีละ task พร้อม tests
4. **Digest & Quality Gates**: ตรวจ 5 Quality Gates ผ่าน `/gl-review` (`.brain/workflows/03_digest.md`)
5. **Wrap & Verification**: ตรวจสอบ `npm test` และ `npm run build` ผ่าน `/gl-test` (`.brain/workflows/04_wrap.md`)
6. **Handoff & Ship**: อัปเดต `.brain/WORKING_CONTEXT.md` และบันทึก `.brain/HANDOFF.md` ผ่าน `/gl-ship` (`.brain/workflows/05_handoff.md`)

```
1. /gl-spec     → ถามว่าจะสร้างอะไร → เขียน spec
2. /gl-plan     → แบ่งเป็น tasks (P0-P3)
3. /gl-build    → เขียนโค้ดทีละ task พร้อม test
4. /gl-test     → รัน npm test + build + ตรวจ financial/UI
5. /gl-review   → ตรวจ 5 Quality Gates
6. /gl-ship     → commit + push + PR + อัปเดต .brain/HANDOFF.md
```

### Agents ที่ใช้ร่วม

| Agent                | เมื่อไหร่                                    |
| -------------------- | -------------------------------------------- |
| `financial-reviewer` | หลังเขียน RPC/transaction logic ที่มีการเงิน |
| `ui-reviewer`        | หลังเขียน component ใหม่                     |
| `thai-writer`        | หลังเขียน UI copy ภาษาไทย                    |

### กฎทั่วไป

1. Read the existing implementation before changing it. Reuse before adding.
2. Search the whole repository for existing values, symbols, and behaviors before writing anything new.
3. Smallest safe change per step.
4. After each change, search again and verify every intended consumer now references the single source of truth.
5. `npm test` + `npm run build` after each step.
6. UI component tests assert on rendered HTML strings — markup refactors break them. Update tests deliberately, never by loosening the assertion to nothing.
7. Verify in a browser at desktop and 390px. Compare before/after across every affected route.
8. Document changed files, search evidence, remaining intentional duplicates, and verification results before claiming completion.

Do not redesign the whole app at once. Do not start new milestone features inside a polish task.

## Agent skills

### Issue tracker

GitHub Issues (`gh` CLI) on this repo's `origin` remote. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five canonical roles, label strings same as role names. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` + `docs/adr/` at repo root. See `docs/agents/domain.md`.

# AGENTS.md — Grace Ledger

Church financial OS (Thai UI). **Read `CLAUDE.md` first** — it is the full working agreement (quality gates, financial safety rules, Thai copy style, single-source-of-truth policy). This file is the quick orientation.

## Stack & hard constraints

- Vanilla TypeScript + Vite. **No React, no framework, no component library.** Pages are `render*Html(props): string` functions + `attachEventListeners(root)`; full re-render on state change.
- All money goes through `decimal.js` via `src/lib/money.ts`. Never `number` for amounts.
- Supabase (PostgreSQL 17): RPCs, RLS, RBAC live in `supabase/migrations/` and `supabase/functions/`.
- Path alias `@` → `./src` (tsconfig + vitest).
- Windows dev machine (Git Bash). Node scripts in `scripts/` run with `node <file>.mjs`.

## Commands

- `npm test` — vitest run (unit + integration). `npm run test:watch`.
- `npm run build` — typecheck (`tsc --noEmit`) + Vite build. `npm run typecheck` / `npm run lint` are typecheck-only.
- `npm run dev` — Vite on port 5500; `npm run dev:staging` on 5510.

## Layout

- `src/pages/` — one file per route (Dashboard, Transactions, Approvals, Funds, Offering, Members, Reports, Login, Profile, PinSetup). `src/components/layout/AppShell.ts` is the shell/nav.
- `src/lib/` — domain modules (money, funds, transactions, offering, rbac, auth, supabase clients, hermes AI adapter).
- `src/services/` — service layer between pages and lib/Supabase.
- `src/styles/app.css` — imports design tokens from `design-system-extracted/tokens/*.css`. That directory is the visual source of truth.
- `tests/unit/` and `tests/integration/` — vitest, node environment, `tests/**/*.test.ts`.
- `scripts/` — one-off audit / gate / E2E verification scripts (playwright, embedded-postgres, pg-mem). Mostly historical milestone evidence; don't treat as production code.

## Rules that get violated most

1. **Financial safety hard stops** (money math, transaction/approval/posting rules, schema/RPC behavior, RLS/RBAC/audit): never change as a side effect of another task. If required, stop and report.
2. **UI tests assert on rendered HTML strings** — markup refactors break them. Update tests deliberately, never by loosening assertions.
3. **Single source of truth**: search the whole repo by literal/symbol before adding any value, color, or rule. Semantic tokens (`--primary`, `--income`, …) over raw hex; shared constants over copy-pasted literals.
4. **Thai UI copy**: concise human Thai, no internal jargon, no bilingual double-labels, no raw exception text in UI.
5. **Color meaning is fixed**: emerald/income, amber/pending, red/expense. `--*-foreground` tokens pair with solid colors only, not `-muted` surfaces.
6. Mobile target is 390px; touch targets ≥44px; verify visual changes at desktop and 390px.

## Verification

Baseline is green: all vitest files pass and `npm run build` is clean. Both must be green before finishing any task. The five quality gates in `CLAUDE.md` (functional, financial, security, UX, AI-slop/writing) apply to significant features.

## Docs worth reading before sensitive changes

- `CONTEXT.md` — domain overview; `docs/adr/` for architecture decisions.
- `docs/agents/` — issue tracker (GitHub Issues via `gh`), triage labels, domain-doc conventions.
- `docs/M2_*/`, `docs/M3_*` — approval workflow and Sunday-offering semantics if touching transactions/approvals/offering.

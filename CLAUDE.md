# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Grace Ledger v2 — Church Accounting Platform

Enterprise-grade church accounting platform: double-entry bookkeeping, segregated approval workflows, and immutable per-church audit trails. See `README.md` for feature highlights and deployment options.

## Tech Stack

- **Frontend**: React 19 + TypeScript, TanStack Router, TanStack Start, Tailwind CSS v4, shadcn/ui
- **Backend**: TanStack Start (SSR), Nitro server, Drizzle ORM, manual route matcher (no framework router)
- **Database**: PostgreSQL (Supabase compatible) in production; embedded PGlite (WASM Postgres) for tests
- **Auth**: Two parallel systems — see "Dual Auth System" below
- **AI OCR**: Server-side proxy to Fireworks AI (`kimi-k3`) and Google Gemini (`gemini-2.0-flash`) for parsing receipts/forms

## Commands

```bash
npm run dev          # Start dev server (vite dev)
npm run build        # Production build
npm run preview      # Preview production build
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm run format       # prettier --write .
npm test             # vitest run — full suite against in-memory PGlite
```

Run a single test file: `npx vitest run src/server/__tests__/backend.test.ts`
Run tests matching a name: `npx vitest run -t "unbalanced entry"`

No local Postgres or Docker daemon is needed to run tests — `src/server/infrastructure/db.ts` spins up an in-memory PGlite instance and hand-creates the schema (enums + tables) when `NODE_ENV=test`/`VITEST` is set and `DATABASE_URL` is absent. CI (`.github/workflows/ci.yml`) additionally runs the same suite against a real `postgres:16` service container.

## Architecture

### Route registration is manual, not file-based (backend)

`src/server/api/routes.ts` is a hand-rolled registry — it imports every `*.routes.ts` module from `src/server/api/routes/`, concatenates their `RouteDefinition[]` arrays, and matches `:param` path segments itself (no `URLPattern`, for broad Node compatibility). `handleApiRequest()` applies rate limiting + CSRF middleware to state-changing methods, then dispatches. When adding an endpoint, add it to the relevant `*.routes.ts` file and confirm it's spread into the `routes` array in `routes.ts` — nothing is auto-discovered.

Frontend routing is the opposite: TanStack Start file-based routing under `src/routes/`. See `src/routes/README.md` for naming conventions (`$id` dynamic, `{-$cat}` optional, `_layout` layouts, `__root.tsx` shell). `src/routeTree.gen.ts` is generated — never hand-edit it.

### Dual auth system (read this before touching auth)

Two authentication mechanisms coexist and are both live:

1. **Server JWT sessions** (`src/server/auth/session.ts`) — `SessionService` issues its own JWTs (8h expiry, `JWT_SECRET`), stores a hash in `user_sessions`, and supports instant revocation via `token_version`.
2. **Supabase Auth** (`src/lib/auth.tsx`) — PIN-based login backed by Supabase's own session/JWT, used by the current frontend.

`src/server/api/middleware.ts`'s `extractSession()` tries the server JWT first (`SessionService.validateSession`), then falls back to verifying a Supabase access token (`verifySupabaseToken`). Both paths produce an equivalent `Session` object consumed by route handlers. When debugging auth issues, check which path is actually being hit — errors in one are silently swallowed to allow fallthrough to the other.

Permissions are also defined twice with different shapes: `src/server/auth/permissions.ts` (server-authoritative, checked in `middleware.ts`/route handlers) and `src/lib/auth.tsx`'s `PERMISSION_MATRIX` (client-side, UX-only — hiding controls, not enforcement). Only the server copy matters for security.

### Reads vs. writes go through different paths (frontend)

`src/services/api.ts` is explicit about this split: **reads go straight to Supabase** (`src/services/church.ts`, for speed), **writes go through the server API client** in `api.ts`, which attaches the Supabase access token as a Bearer header so the server can enforce business rules, double-entry accounting, and audit logging. `ENGINEERING_BACKLOG.md` (P0-5) tracks several `church.ts` functions (`createOffering`, `createProject`, `createMember`, `saveSettings`, etc.) that still write directly to Supabase, bypassing server-side validation/audit — don't add new direct-write functions there; route new mutations through `src/services/api.ts` and a corresponding `src/server/api/routes/*.routes.ts` handler instead.

### Journal engine is the only path for financial state changes

`src/server/domain/journal.ts` (`JournalService`) is the sole entry point for creating/approving/voiding financial transactions. Key invariants enforced in `createEntry`/`approveEntry`:
- Debits must equal credits (`UnbalancedEntryError`), at least 2 lines, no future posting dates.
- Row locks (`SELECT ... FOR UPDATE`) on the fiscal period and fund rows to prevent races.
- Approval thresholds live in `src/server/auth/permissions.ts` (`APPROVAL_THRESHOLDS`): ≤ ฿5,000 and ฿5,000–50,000 both need one `admin`/`super_admin` approval; > ฿50,000 requires **dual** `super_admin` approval via `approval_1_id`/`approval_2_id`, and self-approval is blocked (`SelfApprovalError`).
- Voiding never deletes — it creates a reversing entry (`entryType: "void"`) and auto-submits it for approval; the original is marked `voided` only after the reversal exists.
- Entry numbers (`OFF-2026-0001`, etc.) are assigned atomically via `entry_number_counters` only on final approval, not on creation.
- All amounts flow through `Money` (see below) — never raw numbers/floats.

### Money is a shared, isomorphic value object

`src/lib/money.ts` defines `Money` using `BigInt` satang (1/100 THB) internally to avoid float precision bugs — it's used on both client and server. `src/server/domain/money.ts` is a thin re-export kept only for backward-compatible server imports; add new logic to `src/lib/money.ts`, not the server copy. Always construct amounts via `Money.fromBaht()`/`Money.fromSqlDecimal()` and persist via `.toSqlDecimal()` — never interpolate `parseFloat`/`Number()` into DECIMAL columns.

### Audit trail: per-church SHA-256 hash chain

`src/server/services/audit.service.ts` (`AuditService`) computes each entry's hash from a JSON payload that includes the *previous* entry's hash for that `church_id` (chains are per-church, not global, to avoid a serialization bottleneck). `verifyChain()` recomputes hashes oldest-to-newest and reports the first break; entries with `current_hash IS NULL` are legacy (pre-hash-chaining) and are skipped, not treated as breaks. Audit logs are insert-only — never update/delete rows in `audit_log`.

### Schema/migrations: two parallel definitions

- `src/db/schema.ts` is the Drizzle schema — source of truth for TypeScript types and the query builder. `drizzle.config.ts` outputs generated SQL to `drizzle/`.
- `supabase/migrations/*.sql` are hand-written, sequential SQL migrations (001–008) applied directly to Supabase, including RLS policies that Drizzle doesn't manage.

These are not auto-synced — a schema change generally needs updates in both places (Drizzle schema for the app/tests, a new numbered Supabase migration for RLS/production).

### Multi-tenancy

Every domain table carries `church_id`; every query in service/domain code filters on it explicitly (defense in depth — RLS in the Supabase migrations is the second layer). Soft deletes (`deleted_at`) are used instead of hard deletes across entities.

## Key directories

```
src/
├── components/   # church/, dashboard/, layout/, receipts/, shared/, ui/
├── db/schema.ts  # Drizzle ORM schema (source of truth for types)
├── routes/       # TanStack Router file-based routes (_app.*.tsx)
├── server/
│   ├── api/routes/    # One file per resource; registered in api/routes.ts
│   ├── api/middleware.ts  # extractSession, requireAuth, rate limit, CSRF
│   ├── domain/        # journal.ts, money.ts, chart-of-accounts.ts, validation.ts
│   ├── auth/          # session.ts (server JWT), permissions.ts (server-authoritative)
│   ├── services/      # audit, fund, period, transfer, reconciliation, seed, migration
│   └── infrastructure/db.ts  # Drizzle client — PGlite (test) vs. Postgres (prod) switch
└── services/     # Client-side: api.ts (writes), church.ts (reads), supabaseClient.ts
```

## Available Skills (in .claude/skills/)

Already installed and linked to this project — invoke by name rather than re-deriving the workflow manually:

- **Agent Workflow**: code-review, codebase-design, domain-modeling, implement, tdd, to-spec, planning-and-task-breakdown, debugging-and-error-recovery
- **Frontend**: frontend-ui-engineering
- **Backend**: api-and-interface-design, performance-optimization, security-and-hardening
- **Database**: postgresql-table-design, database-migration
- **DevOps**: git-workflow-and-versioning, ci-cd-and-automation
- **AI/Claude**: claude-api, mcp-builder, prompt-engineering-patterns, context-engineering, agent-development, skill-development
- **Docs**: create-agentsmd, create-readme, create-specification, create-implementation-plan, documentation-and-adrs
- **Tools**: conventional-commit, playwright-cli, git-guardrails-claude-code, claude-handoff

## Where to look for more context

- `ENGINEERING_BACKLOG.md` — current known gaps/bugs (route handlers, auth bypass, budget mapping, etc.) — check before assuming something is unimplemented.
- `docs/business/AUTHORIZATION_MODEL.md`, `docs/business/BUSINESS_RULES.md`, `docs/business/ACCOUNTING_ENGINE.md` — business rule source of truth for approvals, accounting, and audit design.
- `docs/architecture/` — architecture decisions and target-state docs.

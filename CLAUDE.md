# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 🚀 Current Phase: Sprint 2 (HTML Prototype & UI Refinement)

**Status**: Phase A (Infrastructure) complete. UI design system (v3.0) finalized and rolled out.

**Current Work**: Refining prototype UI with modern Apple-inspired design patterns and vNext ledger-grid redesigns across all financial screens. Implementing FS-001 (Finance Staff Home) and Record Income Wizard flows (FS-002 through FS-005) using the finalized design system.

**Key Docs** (read in this order):
1. `docs/TECH_LEAD_NOTE.md` — Why we're doing this and architectural context
2. `docs/ux/UXDR.md` — Design decisions and UX rationale
3. `docs/MENTAL_MODELS.md` — How finance staff think about workflows
4. `docs/PHASE-0-HYPOTHESES.md` — User assumptions and validation criteria
5. `ENGINEERING_BACKLOG.md` — Current known gaps and P0/P1 blockers
6. `docs/DECISION_INDEX.md` — All architectural decisions indexed by date

**Do NOT**: Modify backend accounting logic, bypass the journal engine, add direct Supabase writes (use server API routes instead), or second-guess finalized UX decisions without user research. UI validation and implementation only.

---

# Grace Ledger v2 — Church Accounting Platform

Enterprise-grade church accounting platform: double-entry bookkeeping, segregated approval workflows, immutable per-church audit trails, and modern mobile-first UI. See `README.md` for feature highlights and deployment options.

## Tech Stack (as of 2026-08-05)

- **Frontend**: React 19.2.0 + TypeScript 5.8, TanStack Router v1.170, TanStack Start v1.168, Tailwind CSS v4.2, shadcn/ui, Lucide Icons, Framer Motion v12.42
- **Backend**: TanStack Start (SSR), Nitro server (v3.0 beta), Drizzle ORM v0.45, manual route registration (no framework router)
- **Database**: PostgreSQL 16 (Supabase compatible) in production; embedded PGlite v0.5.4 (WASM Postgres) for tests
- **Auth**: Dual systems — Server JWT (`SessionService`) + Supabase Auth (PIN-based). See "Dual Auth System" below.
- **AI Vision**: Server-side proxy to Fireworks AI (`kimi-k3`) and Google Gemini (`gemini-2.0-flash`) for receipt/form parsing
- **Design System**: v3.0 — Apple minimal aesthetic, interactive dialogs, consistent spacing/typography across all screens
- **UI Components**: 70+ shadcn/ui primitives, custom hooks for form state, modal orchestration via React Context

## Development Environment & Commands

### Setup

```bash
# Install dependencies (Node >= 20, npm >= 10)
npm install

# Create .env.local from template
cp .env.example .env.local

# Essential env vars for local dev:
# VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (can be test values)
# DATABASE_URL (omit for in-memory PGlite in test mode)
# JWT_SECRET (any value, used for server session tokens)
# FIREWORKS_API_KEY (optional; OCR fails gracefully if missing)
```

### Commands

```bash
npm run dev          # Start dev server (http://localhost:3000, Vite HMR)
npm run build        # Production SSR + client bundle
npm run preview      # Preview production build locally
npm run typecheck    # tsc --noEmit (no incremental, full repo scan)
npm run lint         # eslint . (checks src/, vite.config.ts, etc.)
npm run format       # prettier --write . (auto-format all files)
npm test             # vitest run — full suite against in-memory PGlite
npm run dev:api      # Watch + reload server code via bun (development only)
```

### Testing

```bash
# Run full suite (PGlite in-memory, no Docker needed)
npm test

# Single file
npx vitest run src/server/__tests__/backend.test.ts

# Match by name pattern
npx vitest run -t "unbalanced entry"

# Watch mode during development
npx vitest

# CI also runs against real Postgres service container
# See .github/workflows/ci.yml for GitHub Actions setup
```

**Database in tests**: `src/server/infrastructure/db.ts` auto-spins up an in-memory PGlite instance when `NODE_ENV=test`/`VITEST` is set and `DATABASE_URL` is absent. No Postgres daemon or Docker required locally. The schema (enums + tables) is hand-created from `src/db/schema.ts` on startup.

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

`src/services/api.ts` is explicit about this split: **reads go straight to Supabase** (`src/services/church.ts`, for speed), **writes go through the server API client** in `api.ts`, which attaches the Supabase access token as a Bearer header so the server can enforce business rules, double-entry accounting, and audit logging. All `church.ts` mutation functions (`createOffering`, `createProject`, `createMember`, `saveSettings`, etc.) were migrated onto this path as of P0-5 (`ENGINEERING_BACKLOG.md`) — don't add new direct-write functions there; route new mutations through `src/services/api.ts` and a corresponding `src/server/api/routes/*.routes.ts` handler instead.

One layer inconsistency to know about: `income.service.ts`, `expense.service.ts`, and the offering-financial service talk to Supabase's admin client directly instead of going through Drizzle like the rest of the route layer (`ENGINEERING_BACKLOG.md` P0-4). Their route handlers can't be integration-tested without real `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` credentials — only their auth-dispatch boundary is covered in `src/server/__tests__/routes.test.ts`.

### A second, unwired LLM integration exists

`src/services/llm.ts` wraps OpenRouter (`OPENROUTER_API_KEY`/`OPENROUTER_MODEL`, default `inclusionai/ling-3.0-flash:free`) behind an `llmChat()` function, and `.env.example` documents it as the current AI backend — but nothing calls it yet (`llmChat` has no callers outside its own definition). The `_app.ai.tsx` "Grace AI workspace" route that shipped alongside it is a read-only dashboard over existing income/expense/offering/budget data (via `church.ts`); despite the name, it makes no LLM calls. Don't assume "AI workspace" means chat — the only live AI calls in the app are the Fireworks/Gemini OCR proxy described above.

### Journal engine is the only path for financial state changes

`src/server/domain/journal.ts` (`JournalService`) is the sole entry point for creating/approving/voiding financial transactions. Key invariants enforced in `createEntry`/`approveEntry`:
- Debits must equal credits (`UnbalancedEntryError`), at least 2 lines, no future posting dates.
- Row locks (`SELECT ... FOR UPDATE`) on the fiscal period and fund rows to prevent races.
- Approval thresholds live in `src/server/auth/permissions.ts` (`APPROVAL_THRESHOLDS`): ≤ ฿5,000 and ฿5,000–50,000 both need one `admin`/`super_admin` approval; > ฿50,000 requires **dual** `super_admin` approval via `approval_1_id`/`approval_2_id`, and self-approval is blocked (`SelfApprovalError`).
- Voiding never deletes — it creates a reversing entry (`entryType: "void"`) and auto-submits it for approval; the original is marked `voided` only after the reversal exists.
- Entry numbers (`OFF-2026-0001`, etc.) are assigned atomically via `entry_number_counters` only on final approval, not on creation.
- All amounts flow through `Money` (see below) — never raw numbers/floats.

### Money is a Shared, Isomorphic Value Object

`src/lib/money.ts` defines `Money` using `BigInt` satang (1/100 THB) internally to prevent float precision bugs. Used on both client and server.

**Do this**:
```typescript
const amount = Money.fromBaht(1500.50);  // Constructs from baht (correctly handles .50)
const fromDb = Money.fromSqlDecimal("1500.50");  // From DECIMAL column
const line = { debit: amount, accountId: "..." };
db.insert(journal_lines).values({ amount: amount.toSqlDecimal() });
```

**Never do this**:
```typescript
const amount = parseFloat("1500.50");  // Float precision loss
const amount = Number(input.amount);    // Float precision loss
db.insert(journal_lines).values({ amount: 1500.50 });  // Direct number, precision loss
```

**Note**: `src/server/domain/money.ts` is a thin re-export kept for backward-compatible server imports — add new logic to `src/lib/money.ts` instead. All new code should import from `lib/money.ts`.

## Anti-Patterns & What NOT To Do

### Frontend
- ❌ **Direct Supabase writes** → `createOffering(...) { supabase.from("offerings").insert(...) }` bypasses business rules and audit logging. Use `apiCreateOffering()` in `src/services/api.ts` instead.
- ❌ **Prop drilling > 3 levels** → Use React Context (e.g., `PermissionContext`, `SessionContext`) or TanStack Query for state. See `src/lib/auth.tsx` for context examples.
- ❌ **Uncontrolled forms** → Always use React Hook Form (`useForm`, `Controller`). Uncontrolled forms are hard to validate and submit.
- ❌ **Storing auth token in localStorage** → Use httpOnly cookies (Supabase + SessionService handle this). localStorage = XSS risk.
- ❌ **Floating `<Dialog>` modals without context** → Dialogs should be orchestrated via React Context (currently using `sonner` for toasts, but dialogs TBD). Prevents stacking bugs.
- ❌ **Hardcoding URLs** → Use TanStack Router's `Link` component or `useNavigate()` hook. Hardcoded strings break refactoring.

### Backend
- ❌ **Bypassing the journal engine** → Direct writes to `journal_lines` or `accounts` tables. All financial state changes must go through `JournalService.createEntry()` + `approveEntry()`.
- ❌ **Floating `church_id` filter** → Every query must filter by `church_id`. Missing this = security breach, not a "nice-to-have."
- ❌ **Raw numbers in journal entries** → Use `Money` type. `Money.fromBaht()` for construction, `.toSqlDecimal()` for persistence.
- ❌ **Skipping permission checks** → Every route handler must call `requireAuth()` + check permissions via `session.role` + `PERMISSION_MATRIX` / `APPROVAL_THRESHOLDS`. Don't assume the client enforced permissions.
- ❌ **Updating `audit_log` rows** → Audit trail is append-only. Never UPDATE or DELETE. If a log entry is wrong, create a new entry explaining the correction.
- ❌ **Mixing Supabase client + Drizzle in one handler** → Pick one per handler. Inconsistent transaction scopes = race conditions. Prefer Drizzle (it's used everywhere else).

### Database
- ❌ **Hard deletes** → Use soft deletes (`UPDATE ... SET deleted_at = NOW()`). Hard delete only in test teardown.
- ❌ **Omitting RLS policies** → When you create a new table in a migration, add RLS policies for multi-tenancy (template: `SELECT ... WHERE auth.uid() = user_id AND ...` or similar church-scoping).
- ❌ **Circular foreign keys** → Design schemas so dependencies form a DAG, not a cycle (e.g., church → fund → account, never account → fund → church).
- ❌ **Missing NOT NULL constraints** → Every column should have a default or explicit NOT NULL. Ambiguous NULLs = hard-to-debug queries.

### Testing
- ❌ **Mocking the database** → We have a real in-memory database (PGlite). Write integration tests, not unit tests with mocks. Mocks hide real bugs.
- ❌ **Skipping async/await** → Tests with `return promise` instead of `await` often pass by accident. Always `await`.
- ❌ **Test interdependence** → Each test must be independent and can run in any order. Use `beforeEach` to set up shared state; avoid global test state.
- ❌ **Hardcoded test data** → Use fixtures or factories. Hardcoding makes tests brittle when schemas change.

### Git & Commits
- ❌ **Committing .env files** → Even if you think it's safe (it's not). gitignore all `.env*` except `.env.example`. Use `git-secrets` or pre-commit hooks.
- ❌ **Large monolithic commits** → One feature = multiple logical commits (e.g., `feat(journal): add approval routes`, `feat(journal): add validation`, `test(journal): add approval tests`).
- ❌ **Force-push to main** → Never do this. If something breaks, revert with `git revert <commit>` (creates a new commit).
- ❌ **Skipping CI** → All PRs must pass lint + typecheck + tests before merge. No exceptions.

### Design System (v3.0)
- ❌ **Hardcoding colors** → Use Tailwind classes (bg-slate-50, text-emerald-600, etc.). If you need a new color, update `tailwind.config.ts` + `globals.css` variables, then use the class.
- ❌ **Custom fonts not in design system** → Use only Geist (system font). No external font imports unless approved by design.
- ❌ **Component-specific styles** → Avoid component-scoped CSS. Use Tailwind utilities or extend via `cn()` helper. Easier to maintain + theme consistency.
- ❌ **Icon sizes all over the place** → Stick to 16px (compact), 24px (default), 32px (large). No 19px or 28px icons.
- ❌ **Forgetting dark mode** → All colors must work in both light and dark modes. Test with `@media (prefers-color-scheme: dark)` in DevTools.

### Audit trail: per-church SHA-256 hash chain

`src/server/services/audit.service.ts` (`AuditService`) computes each entry's hash from a JSON payload that includes the *previous* entry's hash for that `church_id` (chains are per-church, not global, to avoid a serialization bottleneck). `verifyChain()` recomputes hashes oldest-to-newest and reports the first break; entries with `current_hash IS NULL` are legacy (pre-hash-chaining) and are skipped, not treated as breaks. Audit logs are insert-only — never update/delete rows in `audit_log`.

### Schema/Migrations: Two Parallel Definitions

- **`src/db/schema.ts`** is the Drizzle schema — source of truth for TypeScript types and query builder. `drizzle.config.ts` outputs generated SQL to `drizzle/` (for reference).
- **`supabase/migrations/*.sql`** are hand-written, sequential SQL migrations (001–008) applied directly to Supabase, including RLS policies that Drizzle doesn't manage.

These are **not auto-synced** — a schema change requires updates in both places:
1. Update `src/db/schema.ts` (types + Drizzle queries)
2. Write a new numbered migration in `supabase/migrations/00N_*.sql` (DDL + RLS policies)
3. Test against PGlite in-memory DB: `npm test`
4. Apply to production Supabase manually or via CI

### Multi-Tenancy & Security (Critical)

Every domain table carries `church_id`; every query **must** filter on it explicitly:
```typescript
const offerings = await db
  .select()
  .from(offerings)
  .where(eq(offerings.church_id, session.church_id));  // ← NEVER omit this
```

Defense in depth:
1. **Application layer** (required): Every query filters `church_id` explicitly
2. **Database layer** (backup): RLS policies in `supabase/migrations/` prevent cross-church reads
3. **Session layer** (required): `extractSession()` in middleware ensures `session.church_id` is always set before route handlers run

**GOTCHA**: A missing `church_id` filter in service code is a **security breach**, not a bug. Test additions with `npm test` and verify filtering in your route handler.

### Soft Deletes

Used instead of hard deletes across all entities — records have `deleted_at` timestamps. Queries must filter `WHERE deleted_at IS NULL` (or use a helper like `notDeleted()` if available). Hard deletion is only for test cleanup, never for user-triggered deletes.

### Important Invariants (Do Not Break These)

1. **Journal entries are immutable** — Once approved, entries cannot be edited, only voided (which creates a reversing entry). See `JournalService.createEntry()` + `approveEntry()` in `src/server/domain/journal.ts`.

2. **Entry numbers are atomic** — Assigned only on final approval via `entry_number_counters`, never on creation. Ensures gaps in numbering are impossible.

3. **Debits must equal credits** — `JournalService.createEntry()` enforces this. All amounts must use `Money` type; never interpolate raw floats into journal lines.

4. **Dual approval required > ฿50,000** — Checked in `approveEntry()`. Self-approval blocked via `SelfApprovalError`. Thresholds live in `src/server/auth/permissions.ts` → `APPROVAL_THRESHOLDS`.

5. **Audit trail is append-only** — Rows in `audit_log` are never updated/deleted. Hashes chain per `church_id`. See `AuditService.verifyChain()`.

6. **All writes must go through server API** — Frontend never writes directly to Supabase tables. All mutations route through `src/services/api.ts` → server route handlers with auth + audit logging.

7. **Row locks prevent races** — `JournalService` uses `SELECT ... FOR UPDATE` on fiscal periods + funds during transaction creation/approval. Deadlock prevention: always lock in the same order (period → fund).

## Frontend Patterns & Conventions

### Components
- **ui/** — shadcn/ui primitives (Button, Dialog, Select, etc.), rarely modified
- **shared/** — Reusable components (AppHeader, Loading, ErrorBoundary, etc.), no business logic
- **church/**, **dashboard/**, **receipts/**, **layout/** — Feature-specific, may contain hooks + business logic
- All components are `.tsx` files, typed with proper `React.FC<Props>` or function signatures
- Favor composition over prop drilling; use React Context for cross-cutting UI state (e.g., toast notifications via `sonner`)

### State Management
- **Server reads**: `src/services/church.ts` calls Supabase client directly for speed (queries, reporting)
- **Server writes**: `src/services/api.ts` calls `apiClient` which routes to `src/server/api/routes/*` with auth + audit logging
- **Client UI state**: React hooks (`useState`, `useReducer`), React Hook Form for forms (`useForm`, `useFieldArray`)
- **Queries**: TanStack Query v5 (`@tanstack/react-query`) wraps most Supabase reads for caching/refetch logic

### Forms
- React Hook Form (`useForm`, Controller) + Zod for validation
- Shadcn/ui form wrappers (`Form.tsx` in ui/) provide styled label/error containers
- Async validation via server routes — don't use browser validation for business rules (e.g., duplicate names, fund balances)

### Styling
- Tailwind CSS v4 with CSS variables for theme colors (set in `globals.css`, consumed as `bg-slate-50`, `text-slate-900`, etc.)
- No CSS modules or styled-components — utility classes + Tailwind merge (`cn()` helper from `src/lib/utils.ts`)
- Spacing follows 4px grid (4, 8, 12, 16, 24, 32, 48 px — Tailwind's `space-*` scale)
- Responsive breakpoints: `sm:`, `md:`, `lg:`, `xl:`, `2xl:` (mobile-first)

### Design System (v3.0)
- Apple minimal aesthetic: thin borders, generous whitespace, focus on typography hierarchy
- Interactive dialogs replace full-page forms where possible (modals for edit/create)
- Consistent color palette: slate-50 (background), slate-900 (text), emerald-600 (primary action), red-600 (destructive)
- Icons from Lucide v0.575 — all ~575 icons available, prefer consistent sizing (24px default, 16px compact)
- Animation: Framer Motion v12 for smooth transitions, avoid gratuitous parallax/gyro effects

## Key Directories

```
src/
├── components/       # UI component tree (ui/, shared/, church/, dashboard/, etc.)
│   ├── ui/          # shadcn/ui primitives + custom shadcn wrappers (Form.tsx, etc.)
│   ├── shared/      # AppHeader, Loading, ErrorBoundary, PermissionGate, etc.
│   ├── church/      # Church setup, member management, settings
│   ├── dashboard/   # KPI cards, approval queue, fund overview
│   ├── receipts/    # Receipt upload, OCR preview, categorization UI
│   └── layout/      # Page shell, navigation, sidebar
├── routes/          # TanStack Router file-based (under src/routes/, see README.md for naming)
├── lib/             # Utilities: money.ts, auth.tsx, utils.ts (cn helper), hooks/, etc.
├── services/        # Client-side: api.ts (writes via server), church.ts (Supabase reads), supabaseClient.ts
├── db/schema.ts     # Drizzle ORM schema — source of truth for DB types
└── server/
    ├── api/routes/      # One file per resource (*.routes.ts); all spread into api/routes.ts registry
    ├── api/middleware.ts    # extractSession(), requireAuth(), rate limit, CSRF
    ├── domain/          # journal.ts (JournalService), money.ts, validation.ts, chart-of-accounts.ts
    ├── auth/            # session.ts (SessionService, server JWT), permissions.ts (APPROVAL_THRESHOLDS, ROLE_PERMISSIONS)
    ├── services/        # audit.service.ts, fund.service.ts, period.service.ts, etc.
    ├── infrastructure/  # db.ts (Drizzle client, PGlite vs. Postgres switch)
    └── __tests__/       # backend.test.ts (domain logic), routes.test.ts (integration)
```

## Git Workflow & Conventions

### Branch Strategy
- **main**: Production-ready. Every commit passes CI (lint, typecheck, tests). Deploy via `.github/workflows/deploy.yml`.
- **feature branches**: Named `feature/<name>` or `fix/<name>`. PR required; at least one approval before merge.
- **Designated branches**: Some sessions work on pre-assigned branches (e.g., `claude/claude-md-docs-qwg1ep`). Push updates there; PRs are optional unless explicitly requested.

### Committing
- Use **conventional commits**: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `security:` prefixes
- One commit per logical change — don't squash unless explicitly asked
- Example: `feat(ui): redesign ledger grid with vNext layout system` or `fix(auth): prevent self-approval of transactions`
- Never commit `.env*` files (except `.env.example`); check `git status` before staging

### CI/CD
- **`.github/workflows/ci.yml`**: Runs lint, typecheck, and tests on every PR and main branch push. Tests use real Postgres service container + PGlite.
- **`.github/workflows/deploy.yml`**: Auto-deploys to Vercel on main branch merge.
- Failures block merge. Investigate failures before pushing — don't ignore CI.

### Common Debugging Patterns

#### Frontend Issues
1. **Blank page / hydration mismatch** → Check `src/routes/__root.tsx` for rendering logic; `TanStack Start` SSR can cause issues if client-side state differs from server
2. **Auth 401 on mutation** → Verify Supabase access token is attached in `src/services/api.ts` Bearer header; check server-side auth in `middleware.ts`
3. **"Cannot read property 'church_id' of undefined"** → A route component rendered before auth check. Wrap in `PermissionGate` (see `src/components/shared/PermissionGate.tsx`) or use `requireAuth()` middleware
4. **Form not submitting** → Check network tab for API response; look for validation errors returned from `src/server/api/routes/*.routes.ts`
5. **Styling broken after Tailwind update** → Run `npm run format` to regenerate Tailwind classes; check `tailwind.config.ts` for config

#### Backend Issues
1. **Journal entry creation fails with "UnbalancedEntryError"** → Debits ≠ credits. Use `Money.fromBaht()` to construct all amounts; never use raw numbers or `parseFloat()`
2. **"Self-approval not allowed" on high-value transaction** → Approval thresholds live in `src/server/auth/permissions.ts` → `APPROVAL_THRESHOLDS`. Check `approval_1_id` ≠ `approval_2_id` for dual approval > ฿50,000
3. **Row lock timeout ("ERROR: database is locked")** → PGlite in-memory DB has stricter locking than Postgres. Check for concurrent transactions in tests; use `await db.transaction()` to serialize
4. **Test setup takes > 5s** → PGlite spins up each test. Run a single test file with `npx vitest run src/server/__tests__/backend.test.ts` to skip full suite
5. **Type mismatch on DB query result** → Drizzle generated types may lag schema changes. Delete `src/db/schema.ts` auto-generated comments and re-run `npm run typecheck`

## Testing & Quality Assurance

### Unit Tests (domain logic)
- **Location**: `src/server/__tests__/backend.test.ts`
- Test the `JournalService`, `Money`, `ChartOfAccounts`, validation rules
- Example: `describe("JournalService", () => { it("rejects unbalanced entries", ...) })`
- Run single test: `npx vitest run -t "journal"`

### Integration Tests (routes)
- **Location**: `src/server/__tests__/routes.test.ts`
- Call `handleApiRequest()` directly, test auth boundary (401), permission boundary (403), happy path (200/201)
- Tests all registered route modules without needing a real Supabase instance
- Known gap: `income.service.ts`, `expense.service.ts`, `offering-financial.service` use raw Supabase client — need real credentials to test

### E2E / Manual Testing
- Start dev server: `npm run dev`
- Test in browser (Chrome/Safari). Playwright not yet integrated.
- Check Network tab in DevTools for API calls; verify `Authorization: Bearer <token>` header present on writes

### CI Pipeline
- Every PR runs `npm lint`, `npm typecheck`, `npm test` against PGlite in-memory + real Postgres service
- Merge blocked if any check fails. Fix failures before requesting review.

## Troubleshooting Common Scenarios

| Symptom | First Check | Common Fix |
|---------|------------|-----------|
| Test suite hangs | `ps aux \| grep vitest` (check for zombie processes) | Kill hung process; restart `npm test` |
| Type errors in routes | `npm run typecheck` full output | Regenerate Drizzle types: `drizzle-kit generate` |
| Auth fails in browser | Network tab Bearer token present? | Check `extractSession()` in middleware; try Supabase token path first, then server JWT fallback |
| Journal entry unbalanced | `console.log(debits, credits)` before creation | Use `Money.fromBaht()` for all amounts; never `parseFloat()` |
| UI mismatch with design | Compare to `.figma.com` design file | Update Tailwind classes in component; run `npm run format` |

## Available Skills (in .claude/skills/)

Installed and linked to this project — invoke by name rather than re-deriving workflows:

- **Agent Workflow**: code-review, codebase-design, domain-modeling, implement, tdd, to-spec, planning-and-task-breakdown, debugging-and-error-recovery
- **Frontend**: frontend-ui-engineering
- **Backend**: api-and-interface-design, performance-optimization, security-and-hardening
- **Database**: postgresql-table-design, database-migration
- **DevOps**: git-workflow-and-versioning, ci-cd-and-automation
- **AI/Claude**: claude-api, mcp-builder, prompt-engineering-patterns, context-engineering, agent-development, skill-development
- **Docs**: create-agentsmd, create-readme, create-specification, create-implementation-plan, documentation-and-adrs
- **Tools**: conventional-commit, playwright-cli, git-guardrails-claude-code, claude-handoff

## Production Status & Known Issues

### Status
- **Backend**: ✅ Fully functional. All route handlers implemented and integration-tested.
- **Frontend**: ✅ Functional prototype. Modern UI (Design System v3.0) complete. FS-001/FS-002–005 in active development.
- **Database**: ✅ Schema stable. Migrations (001–008) applied; RLS policies active.
- **CI/CD**: ✅ GitHub Actions fully configured. Auto-deploy to Vercel on main.
- **Overall Grade**: B+ (was C+ before P0 completion) — production-ready for beta launch, not for high-volume production yet.

### P0 Completed ✅
- P0-1: All 17 route modules exist and are functional
- P0-2: CI/CD pipeline active (lint, typecheck, test on PR; deploy on main)
- P0-3: Environment variables documented in `.env.example`
- P0-4: 45+ integration tests for route layer; found + fixed auth bug in OCR routes
- P0-5: All frontend mutations (createProject, createMember, saveSettings) now route through server API

### P1 — High Priority (actively being addressed)
- **P1-1**: Offering financial route has bug — uses `fundId` instead of fund's `accountId` for debit line
- **P1-2**: Budget route doesn't map `department`/`project` period types correctly
- See `ENGINEERING_BACKLOG.md` for full list and severity scores

## Reference Documentation

- **`ENGINEERING_BACKLOG.md`** — Current known gaps/blockers (P0 complete, P1 in progress). Check before assuming something is unimplemented.
- **`docs/business/AUTHORIZATION_MODEL.md`**, **`BUSINESS_RULES.md`**, **`ACCOUNTING_ENGINE.md`** — Business rule source of truth for approvals, accounting, audit design
- **`docs/architecture/`** — Architecture decisions (ADRs), target-state docs, compatibility audits
- **`docs/ux/UXDR.md`** — UX design rationale and screen flow specs
- **`docs/GLOSSARY.md`** — Terminology (fund, offering, journal entry, chart of accounts, etc.)
- **`docs/DECISION_INDEX.md`** — All decisions indexed by date for easy lookup

# Grace Ledger — AI Architecture Audit

**Status:** Phase 1 deliverable (read-only). No production code, schema, or config was changed to produce this document.
**Date:** 2026-09-11
**Scope:** Full repository inspection to establish ground truth before any MCP / RAG / A2A work is designed or built.

---

## 0. Critical correction — the requested scope assumed a stack this repo does not have

The originating brief for this work describes the stack as **TanStack Start, React, TypeScript, Tailwind CSS, Vercel deployment, Supabase PostgreSQL**, with an existing server-side `/api/*` SSR API layer. None of that is accurate for this repository. Verified from `package.json`, `vite.config.ts`, `vercel.json`, and `src/`:

| Assumed                            | Actual (verified)                                                                                                                                                                                                                             |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TanStack Start                     | **Vanilla TypeScript**, no framework. `src/main.ts` is a hand-written `App` class owning one render loop.                                                                                                                                     |
| React                              | **No React** anywhere in the repo. Pages export `renderHtml(props): string` + `attachEventListeners(root)`; full string re-render into `innerHTML` on state change.                                                                           |
| Tailwind CSS                       | **No Tailwind.** Styling is hand-authored CSS driven by design tokens in `design-system-extracted/tokens/*.css`, consumed through `src/styles/app.css` (`.gl-*` classes) plus feature-local stylesheet functions (`aiDrawerStyles.ts`, etc.). |
| Vercel SSR / `/api/*` server layer | **No server-side API layer exists.** `vercel.json` is two lines — `npx vite build` → static `dist/`. Vercel serves a static SPA. There are no Vercel serverless/edge functions.                                                               |
| Runtime deps implying a framework  | `package.json` `dependencies` are exactly three packages: `@supabase/supabase-js`, `decimal.js`, `zod`. Everything else is a dev dependency (build/test tooling).                                                                             |

**Why this matters for everything downstream:** the requested MCP server design assumed it would "call existing internal services and public API endpoints." There is no such API endpoint layer to call. The real system's server-side logic lives entirely in **Supabase Postgres RPCs** (`supabase/migrations/*.sql`) invoked directly from the browser client through `@supabase/supabase-js`, protected by RLS. Any MCP/RAG/A2A design must be re-scoped around that reality, not the assumed one. This is flagged here rather than silently "corrected" in a design document, per the project's own working agreement (`CLAUDE.md`): stop and report when a request's premises don't match the codebase.

Routing is also not what an SSR framework implies: `src/router.ts` is a hand-rolled hash router (`ClientRouter`) with a hardcoded if-chain in `matchRoute()` and a fixed `RoutePattern` union (`/`, `/transactions`, `/funds`, `/members`, `/reports`, `/approvals`, `/approvals/:id`, `/offerings`, `/offerings/new`, `/offerings/:id`, `/profile`).

---

## 1. Verified stack and tooling

- **Language/build:** TypeScript 5.8, Vite 7, `type: module`. `npm run build` = `tsc --noEmit && vite build`.
- **Runtime dependencies (all of them):** `@supabase/supabase-js@^2.112.4`, `decimal.js@^10.5.0`, `zod@^3.24.2`.
- **Dev/test dependencies:** `vitest`, `playwright`, `jsdom`, `embedded-postgres` + `pg` + `pg-mem` (real-Postgres and in-memory Postgres test harnesses), `prettier`, `typescript`.
- **Design lint:** `scripts/lint-design.mjs`, run via `npm run lint:design`, fails on undocumented literal color/radius/shadow/font-size values.
- **Deployment:** Vercel, static output only (`vercel.json`: `buildCommand: npx vite build`, `outputDirectory: dist`). `.vercelignore` present.
- **CI:** single workflow, `.github/workflows/ci.yml`.
- **No LLM SDK of any kind is present.** Repo-wide search for `openai`, `anthropic`, `claude`, `gpt-`, `chat.completions`, `embedding`, `llm` (case-insensitive, across `src/` and `supabase/functions/`) returns no real hits. **There is currently no code anywhere in this repository that calls a language model.** This is the single most important gap for the RAG/A2A phases of the original brief — see §7.

---

## 2. Directory structure (top-level, relevant to this task)

```
src/
  main.ts            # App class - single render loop, session bootstrap
  router.ts          # hand-rolled hash router
  pages/             # one *Page.ts per route (renderHtml/attachEventListeners)
  components/
    ai-drawer/       # "Grace AI" chat UI (GraceAiDrawer.ts, cards/, styles)
  lib/
    ai/              # tool-calling capability layer - see 7
    hermes/          # Telegram bridge - see 7.4
    auth/            # login-service.ts (thin; PIN flow lives in edge functions)
    supabase/        # client.ts (singleton), types.ts (generated DB types)
    funds/ members/ offering/ transactions/ reports/   # domain query/formatting helpers
    observability/   # health-check.ts only - no logging/tracing framework
    rbac.ts          # application-layer RBAC table (mirrors RLS intent)
    money.ts / period.ts / org.ts / format.ts
supabase/
  migrations/        # 31 files, append-only, source of truth for schema/RPC/RLS
  functions/         # 3 Deno edge functions: login-profiles, request-pin-bootstrap, verify-pin (+ _shared/)
  config.toml
docs/adr/             # 5 ADRs (financial invariants: sign convention, two-person rule, rounding, etc.)
.brain/               # cross-assistant working state (WORKING_CONTEXT.md, MEMORY.md, HANDOFF.md)
```

---

## 3. Data layer / "API layer"

There is no REST/GraphQL API layer, SSR or otherwise. The actual boundary is:

- **Client:** `src/lib/supabase/client.ts` - a singleton `SupabaseClient<Database>` built from `@supabase/supabase-js`, using `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (falling back to a hardcoded production project ref + anon key - anon keys are public by design, per the file's own comment).
- **Writes and multi-table reads go through Postgres RPCs** defined in `supabase/migrations/*.sql`, not raw table CRUD. This is where two-person-rule, split-parity, idempotency, and other financial invariants are enforced, under RLS.
- **Domain helpers** in `src/lib/{funds,members,offering,transactions,reports,auth}/` wrap those RPCs/table reads with typed, formatted access for pages.
- **`src/lib/supabase/types.ts`** is the generated `Database` type used everywhere for type-safe table/RPC access.

**Migrations (31, chronological, all under `supabase/migrations/`):** core schema -> security-definer functions -> financial RPCs & triggers -> RLS policies -> transaction/approval workflow -> governance semantics -> offering module (schema, RPCs, RLS) -> idempotency & action confirmations -> `execute_confirmed_financial_action` RPC -> historical summaries + RLS hardening -> auth-PIN foundation -> several correctness/hardening fixes (super-admin profile mismatch, two-person-rule on direct post, fund-balance reconciliation, split immutability guard, transfer-funds overload cleanup, SoD error codes, terminal SQLSTATEs, member-giving validation). **No `pgvector` extension, no vector/embedding column, and no "knowledge" table exists anywhere in these migrations.**

## 4. Authentication

- **Primary:** Supabase Auth magic link bootstraps a session (standard Supabase Auth, no custom OAuth/JWT implementation).
- **Day-to-day login:** a PIN layered on top, via `PinSetupPage.ts` (client) + `authPinService.ts` + two Deno edge functions: `supabase/functions/request-pin-bootstrap/` and `supabase/functions/verify-pin/` (plus `supabase/functions/login-profiles/` and a `_shared/` helper module). These are the **only** server-side compute Grace Ledger runs outside Postgres RPCs - three small Deno functions, PIN auth only. No general-purpose serverless API exists to host an MCP server, RAG ingestion job, or agent orchestrator; any of those would need a new home (see gaps, S8).
- **Authorization:** `src/lib/rbac.ts` defines 7 roles (`super_admin, pastor, treasurer, finance_staff, approver, counter, member`) x a fixed resource/action permission table (`can()`, `assertPermission()`), intended to mirror RLS policy intent at the application layer. `canExecuteFinancialAction()` restricts irreversible mutation execution to `super_admin`/`treasurer`.

## 5. Sensitive config / env vars

`.env.example` documents exactly two variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` - both client-side (`VITE_*` prefix = bundled into the public build, by Vite convention; this is intentional here since only the anon key is used client-side). No service-role key, no LLM API key, no other secret is referenced anywhere in `src/` or `.env.example`. **There is currently no environment variable wiring for an LLM provider at all** - a real gap if RAG/embeddings/A2A generation is ever built, since that requires a model call from somewhere with a private key, which cannot be the browser bundle.

## 6. Vercel deployment configuration

`vercel.json` is minimal: static build, static output directory. `.vercelignore` excludes non-build assets. There are no `api/` functions, no `vercel dev` server config, no edge middleware. Any server-side AI orchestration (MCP server transport, RAG ingestion, agent orchestrator) would need new infrastructure - either Vercel Serverless/Edge Functions added to this project, or Supabase Edge Functions (the pattern already used for PIN auth) extended for this purpose. **This is a gap to resolve by decision, not by invention** - see S8.

## 7. Existing AI-related code - the most important finding of this audit

Grace Ledger already has a substantial, security-first AI **capability layer**. Any new MCP/RAG/A2A design must build on this, not duplicate it. It lives in `src/lib/ai/` and `src/lib/hermes/`, surfaced in the UI via `src/components/ai-drawer/`.

### 7.1 `src/lib/ai/types.ts` - capability contract

Defines a **closed capability enum**: `AiCapability = "READ" | "DRAFT" | "ACTION_PROPOSAL"` - explicitly, permanently excluding `EXECUTE`, raw SQL, or dynamic RPC/table access ("Grace AI is restricted exclusively to READ, DRAFT, and ACTION_PROPOSAL... EXECUTE, RAW_SQL, DYNAMIC_RPC, and DYNAMIC_TABLE_ACCESS are strictly prohibited" - comment in source). Also defines `SensitiveDataLevel` (`PUBLIC | INTERNAL | FINANCIAL | SENSITIVE_FINANCIAL`), an `UntrustedData<T>` wrapper for tagging untrusted input (OCR text, prompts, DB content), and the `AiToolDefinition` interface - every tool ships a Zod input schema, Zod output schema, required RBAC permissions, allowed roles, sensitivity level, audit-action name, and a `tenantScoped` flag.

### 7.2 `src/lib/ai/tools-registry.ts` - static tool allowlist (11 tools)

A frozen, static list - `GraceAiToolsRegistry` - no dynamic tool registration is possible. Tools present today:

| Tool                          | Capability      | Sensitivity             | Notes                                                                                                                          |
| ----------------------------- | --------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `get_financial_summary`       | READ            | FINANCIAL               | income/expense/net/fund totals for a period                                                                                    |
| `get_transactions`            | READ            | FINANCIAL               | filtered by status/date range                                                                                                  |
| `get_fund_balance`            | READ            | FINANCIAL               | per-fund or all funds                                                                                                          |
| `get_budget_vs_actual`        | READ            | FINANCIAL               | by year                                                                                                                        |
| `get_transaction_audit_trail` | READ            | FINANCIAL               | audit_logs for one transaction                                                                                                 |
| `get_member_giving_history`   | READ            | **SENSITIVE_FINANCIAL** | requires a written `reason`; restricted to `super_admin/pastor/treasurer`; routed through a secure RPC, never a raw table read |
| `create_draft_transaction`    | DRAFT           | FINANCIAL               | inserts `status: "draft"` rows only                                                                                            |
| `create_transfer_draft`       | DRAFT           | FINANCIAL               | non-persisting summary draft                                                                                                   |
| `propose_transaction_post`    | ACTION_PROPOSAL | FINANCIAL               | `requiresConfirmation: true`                                                                                                   |
| `propose_fund_transfer`       | ACTION_PROPOSAL | FINANCIAL               | `requiresConfirmation: true`                                                                                                   |
| `propose_void_transaction`    | ACTION_PROPOSAL | FINANCIAL               | `requiresConfirmation: true`                                                                                                   |

This already substantially overlaps the tool set the original brief asked an MCP server to expose (`get_dashboard_summary` ~ `get_financial_summary`, `get_transactions`, `get_funds` ~ `get_fund_balance`, `get_budget_status` ~ `get_budget_vs_actual`). Two requested read tools have no equivalent today: **`get_financial_report`** (a formatted/exportable report) and **`search_financial_records`** (free-text/semantic search) - genuine gaps, not duplication risks.

### 7.3 `src/lib/ai/secure-tool-executor.ts` - the enforcement boundary

`SecureAiToolExecutor.executeTool()` is a single dispatcher that, in order: (1) looks up the tool in the static registry (rejects unknown tools), (2) hard-rejects any `EXECUTE` capability tool as a defense-in-depth check even though none exist in the registry, (3) re-derives identity from `supabase.auth.getUser()` - **never trusts a client-supplied user id**, (4) re-derives role and `church_id` from the `profiles` table server-side, (5) enforces tenant isolation - `memberProfile.church_id !== churchId` is denied unless `super_admin`, (6) re-injects the server-verified `church_id` into parameters before validation (a client cannot forge tenant scope even by passing a different `church_id`), (7) validates input against the tool's Zod schema, (8) checks RBAC via `rbac.can()`, (9) applies an extra `SENSITIVE_FINANCIAL` role gate, (10) dispatches to a READ/DRAFT/ACTION_PROPOSAL handler, (11) **validates the output against the tool's Zod output schema before returning it** (prevents schema drift/data leakage), (12) writes a dual-actor audit row to `audit_logs` (`category: "ai_governance"`) on every SUCCESS/DENIED/ERROR path, with a `correlation_id`.

This is, functionally, already most of what the brief's Phase 5 security framework and Phase 2 MCP server "core requirements" ask for: Zod validation, authenticated access tied to the existing auth system, tenant isolation, zero direct mutation, audit logging on every call, structured JSON responses, reuse of existing services rather than duplicating business logic. **A new MCP server should be a thin protocol adapter in front of this executor, not a reimplementation of it.**

### 7.4 Human-approval workflow already exists

`ACTION_PROPOSAL` tools call `ActionConfirmationEngine.createConfirmation()` (`confirmation-engine.ts`), which writes a row to the `action_confirmations` table (see migrations `20260821000014/15`) with a payload hash, nonce, and TTL (default 300s) - the record never executes anything. Separately, `financial-action-endpoint.ts` (`FinancialActionExecutionService.executeAction()`) is the **only** path that turns a confirmed proposal into a real mutation, and it does so by calling the `execute_confirmed_financial_action` Postgres RPC (migration `20260822000016`, since patched) - i.e., the actual state-changing SQL is a security-definer RPC gated on confirmation id + nonce + payload hash + idempotency key, not anything the AI layer can trigger directly. This **is** the brief's requested READ -> ANALYZE -> PROPOSE -> HUMAN APPROVAL -> WRITE pipeline, already implemented, already tested (`tests/integration/execute-confirmed-financial-action.real-pg.test.ts` per `CLAUDE.md`).

### 7.5 `src/lib/hermes/` - a second client, same boundary (proto-A2A pattern)

`HermesGraceLedgerAdapter.handleHermesToolCall()` bridges a Telegram bot to the exact same `SecureAiToolExecutor` + `FinancialActionExecutionService`, with its own explicit boundary comment: _"Hermes acts strictly as Messaging Transport & Agent Orchestrator. Grace Ledger remains the sole Financial Authority and Authorization Boundary. Zero direct database, RPC, or secret access is granted to Hermes."_ It re-resolves the user's profile/role/church server-side from `session_user_id`/`session_church_id` (never trusts the channel's claims), and formats `ACTION_PROPOSAL` results into a channel-appropriate confirmation payload (proposal id, amount, expiry, confirmation URL, nonce/hash). This is a real, working precedent for "a second, independently-deployable client speaking to Grace Ledger only through the tool-execution boundary, never touching data directly" - the closest thing this repo has to an A2A-style external-agent boundary today, and the pattern any new agent (Finance/Auditor/Report agents from the brief, or an MCP server) should follow.

### 7.6 The UI layer has no LLM behind it (critical gap)

`src/components/ai-drawer/GraceAiDrawer.ts` renders the chat surface, a fixed `QUICK_PROMPTS` list (3 canned Thai prompts), and a `GREETING` string. User free-text is parsed with a single regex (`extractAmount()` - `/([0-9][0-9,]*(?:\.[0-9]{1,2})?)/`) to pull an amount out of a prompt like "รางการโอนเงิน 5,000 ระหวางกองทุน." **There is no natural-language understanding, no intent classification, no LLM call anywhere in this flow.** "Grace AI" today is a deterministic, rule-based front-end over the tool-execution boundary described above - not a conversational agent. This means:

- The tool/security/approval architecture (S7.1-7.5) is genuinely production-grade and reusable.
- But there is **no existing orchestration layer** that a natural-language query like the brief's example ("ตรวจสอบการเงินเดือนนี้") could actually be routed through today. Building the brief's Phase 4 (A2A orchestrator with an LLM-driven Finance/Auditor/Report pipeline) means introducing a language model into this codebase for the first time - a decision with real cost, latency, and vendor implications that has not yet been made and should not be made implicitly inside an "extend the AI architecture" task.

## 8. Gaps relative to the original 7-phase request (explicit, not invented)

| Requested                                                             | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MCP server (Phase 2)                                                  | **Does not exist.** `.mcp.json` at repo root is Claude Code's own _development-tool_ MCP client config (points at `aidesigner`'s design MCP) - unrelated to an application-level MCP server for Grace Ledger's own data. No JSON-RPC/MCP-protocol server code exists anywhere in `src/` or `supabase/functions/`.                                                                                                                                                                          |
| RAG knowledge base + pgvector (Phase 3)                               | **Does not exist.** No `pgvector` extension enabled in any migration, no `knowledge_documents`/`knowledge_chunks`/`knowledge_sources` tables, no embedding generation code, no LLM API key configured anywhere.                                                                                                                                                                                                                                                                            |
| A2A multi-agent architecture (Phase 4)                                | **Does not exist** as A2A-protocol agents. The closest precedent is the Hermes Telegram adapter (S7.5), which is a single-hop tool-execution bridge, not a multi-agent task-delegation graph, and has no LLM to decide routing.                                                                                                                                                                                                                                                            |
| Security framework: READ->ANALYZE->PROPOSE->APPROVAL->WRITE (Phase 5) | **Already exists and is enforced**, for the 11 tools currently registered (S7.3-7.4). Extending it to new tools means adding entries to the existing registry/executor pattern, not building a new framework.                                                                                                                                                                                                                                                                              |
| Observability / Sentry integration (Phase 6)                          | **No Sentry, no structured logging framework, no tracing.** `src/lib/observability/health-check.ts` is the only file in that directory; it is a basic health-check, not a logging pipeline. Repo-wide search for "sentry" returns nothing.                                                                                                                                                                                                                                                 |
| Testing strategy (Phase 7)                                            | Strong existing test culture for the financial core (pg-mem unit tests + real-Postgres integration tests per `CLAUDE.md`), but **zero existing tests for AI-specific concerns** (prompt injection, tenant isolation for MCP/RAG specifically, agent delegation, A2A lifecycle) simply because none of those subsystems exist yet.                                                                                                                                                          |
| A serverless compute location for any of the above                    | **Not decided.** This app has no general-purpose server runtime today (S3, S6) - only 3 narrow Deno edge functions for PIN auth. Any MCP server, RAG ingestion worker, or agent orchestrator needs an explicit infrastructure decision (Supabase Edge Functions, extending the existing pattern, vs. new Vercel serverless/edge functions) before any design can be considered actionable. This decision was not given in the original brief and is not this audit's to make unilaterally. |

## 9. What this means for scoping the remaining phases

1. **Do not build a second security/approval framework.** Phase 5 is largely done; new MCP tools and any future agents must be added as new entries to `GraceAiToolsRegistry` + handlers in `SecureAiToolExecutor`, inheriting tenant isolation, RBAC, Zod validation, and audit logging for free - exactly as the existing tools already do.
2. **An MCP server here is a protocol adapter, not a new authority.** It should be a thin transport (stdio/HTTP+SSE per the MCP spec) that authenticates a caller, maps MCP tool calls 1:1 onto `SecureAiToolExecutor.executeTool()` calls, and returns its already-validated JSON - plus the two genuinely missing read tools (`get_financial_report`, `search_financial_records`).
3. **RAG requires a foundational, explicit decision the codebase does not currently make for itself:** which LLM/embedding provider, where the embedding job runs (there is no server runtime to run it in today), and - per the brief's own instruction - a **written decision** before any transactional financial data is embedded at all (none should be, by default).
4. **A2A/multi-agent requires introducing an LLM into this codebase for the first time.** That is a materially different, larger decision than "extend the AI architecture" implies, and should be surfaced to the user explicitly rather than assumed.
5. **Every phase needs a home to run.** No server runtime beyond 3 PIN-auth Deno functions exists. This must be decided (Supabase Edge Functions vs. Vercel Functions) before Phases 2-4 can have a real design, not just a paper one.

---

_This audit changed no production code, schema, configuration, or dependency. It is the required Phase 1 deliverable before any MCP/RAG/A2A design work proceeds._

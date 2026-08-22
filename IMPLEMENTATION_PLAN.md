# Grace Ledger — Implementation Plan (IMPLEMENTATION_PLAN.md)

**Target Standard:** Grace Ledger Final Security Contract & Grace AI Architecture Specification (Hardened v3)  
**Core Financial Principle:** Financial Mutations require **Authorization + Confirmation + Idempotency + Financial Invariants** to be verified simultaneously. Any single failure $\rightarrow$ **DENY / FAIL CLOSED**.

---

## 1. Architecture Flow & Boundary Enforcement

```text
User / UI
   ↓
Grace AI (Intelligence Layer: READ / DRAFT / ACTION PROPOSAL only — NO EXECUTE)
   ↓
Approved Tools (Allowlist Schema Validation + Untrusted Data Isolation)
   ↓
Proposal Creation & Server-Backed Confirmation State (`action_confirmations` in PostgreSQL)
   ↓
Human Review & Explicit Confirmation (UI Dialog)
   ↓
Dedicated Financial Action Endpoint (Application Security Boundary)
   ↓
Server Authorization (`has_church_access`) + Server-side TTL & Hash Check (`consume_action_confirmation`)
   ↓
Server-side Idempotency Check (`idempotency_keys` in PostgreSQL)
   ↓
Financial RPCs (`transfer_funds`, `post_transaction`, `void_transaction`) with Row Locks
   ↓
Immutable PostgreSQL Ledger & Dual-Actor Audit Trail (`audit_logs`)
```

---

## 2. 15-Task Sequential Implementation Plan

### Task 01: Remove Production Mock Fallbacks & Enforce Fail-Closed UI States
* **Objective:** Eliminate all `getDefault*()` mock fallbacks in all production UI pages when queries fail or return empty sets. Replace with explicit `Error State` (Fail-Closed) and `Empty State`.
* **Files:**
  * `[MODIFY]` `src/pages/TransactionsPage.ts`
  * `[MODIFY]` `src/pages/FundsPage.ts`
  * `[MODIFY]` `src/pages/MembersPage.ts`
  * `[MODIFY]` `src/pages/DashboardPage.ts`
* **Database Impact:** None (Client-side fail-closed enforcement).
* **Security Impact:** Prevents query errors, network partitions, or RLS denials from silently presenting false data.
* **Tests:** `tests/unit/ui-error-states.test.ts` (Simulates query failures and asserts `<div class="gl-notice gl-notice--error">` is rendered without mock data).
* **Acceptance Criteria:** Zero mock data in production query paths. All failures show explicit error feedback with retry.
* **Rollback Strategy:** Revert page modifications.

---

### Task 02: Core Financial Services Implementation
* **Objective:** Implement production-ready TypeScript service classes for Transactions, Funds, Members, and Reports with strict Zod validation, `decimal.js` arithmetic, and client RBAC assertion (`can()`, `assertPermission()`).
* **Files:**
  * `[NEW]` `src/lib/transactions/transactions-service.ts`
  * `[NEW]` `src/lib/funds/funds-service.ts`
  * `[NEW]` `src/lib/members/members-service.ts`
  * `[NEW]` `src/lib/reports/reports-service.ts`
* **Database Impact:** Reads/writes via Supabase client to existing tables and RPCs.
* **Security Impact:** Enforces schema validation and client RBAC checks prior to database calls; does NOT replace server-side RLS.
* **Tests:** Unit tests for validation, split parity, and unauthorized action rejection.
* **Acceptance Criteria:** Services pass typed inputs to Supabase client and propagate server-side errors without swallowing exceptions.
* **Rollback Strategy:** Delete new service files.

---

### Task 03: Server/Database-Enforced Financial Idempotency
* **Objective:** Implement Database-backed Idempotency table and RPC to guarantee financial mutations (Submit, Approve, Post, Void, Transfer, Offering Count, AI Action) cannot be executed twice.
* **Files:**
  * `[NEW]` `supabase/migrations/20260821000014_idempotency_and_action_confirmations.sql`
  * `[NEW]` `src/lib/transactions/idempotency.ts`
* **Database Impact:** Creates `idempotency_keys` table with `UNIQUE(church_id, idempotency_key)` and RPC `check_and_record_idempotency()`.
* **Security Impact:** Protects against double-clicks, browser refresh, network/AI retries, and concurrent duplicate mutations. Same key + same payload $\rightarrow$ returns cached response; same key + changed payload $\rightarrow$ DENY (Conflict).
* **Tests:** `tests/integration/idempotency.test.ts` (Concurrent submissions with duplicate keys; payload modification tests).
* **Acceptance Criteria:** Concurrent or sequential duplicate mutation requests create exactly one financial record in the ledger.
* **Rollback Strategy:** Drop migration table & RPC.

---

### Task 04: Core Financial Service Tests
* **Objective:** Build automated test suites verifying CRUD, Split Parity, Non-negative balance rejection, Void/Reversal mirror creation, SoD (Two-Person Rule), and Member Giving Privacy.
* **Files:**
  * `[NEW]` `tests/unit/transactions-service.test.ts`
  * `[NEW]` `tests/unit/funds-service.test.ts`
  * `[NEW]` `tests/unit/members-service.test.ts`
  * `[NEW]` `tests/unit/reports-service.test.ts`
* **Database Impact:** None (Unit test harness).
* **Security Impact:** 100% test coverage over financial invariants and RLS permission gates.
* **Tests:** `npm test`.
* **Acceptance Criteria:** 100% green tests across all core financial operations.
* **Rollback Strategy:** Remove test files.

---

### Task 05: Grace AI Core Types & Explicit Tool Registry (Allowlist)
* **Objective:** Define explicit TypeScript types and Zod schemas for all approved AI tools across the 3 capability levels (`READ`, `DRAFT`, `ACTION PROPOSAL`).
* **Files:**
  * `[NEW]` `src/lib/ai/types.ts`
  * `[NEW]` `src/lib/ai/tools-registry.ts`
* **Database Impact:** None.
* **Security Impact:** Strict allowlist: zero raw SQL, zero dynamic SQL, zero AI-generated tool creation, AI output treated as untrusted input.
* **Tests:** `tests/unit/tools-registry.test.ts` (Validates tool schemas, permission mappings, and rejection of unregistered tool names).
* **Acceptance Criteria:** Every tool has explicit input/output schemas, required permissions, sensitive data levels, and audit categories.
* **Rollback Strategy:** Delete new files in `src/lib/ai/`.

---

### Task 06: Server-Backed Confirmation State & Canonical Payload Engine
* **Objective:** Implement Database-backed confirmation table (`action_confirmations`) and canonical payload hashing engine (`Canonical Payload -> Deterministic Serialization -> SHA-256`) with Server-side TTL enforcement.
* **Files:**
  * Handled in Migration `20260821000014_idempotency_and_action_confirmations.sql`
  * `[NEW]` `src/lib/ai/confirmation-engine.ts`
* **Database Impact:** Creates `action_confirmations` table and `create_action_confirmation()` / `consume_action_confirmation()` RPCs.
* **Security Impact:** Enforces single-use confirmation. Binds `user_id`, `church_id`, `action`, `tool_name`, `resource_id`, `normalized_parameters`, `expires_at`, `nonce`. Server-side TTL check (`expires_at > now()`). Any parameter alteration or replay results in immediate `DENY`.
* **Tests:** `tests/unit/confirmation-engine.test.ts` (Token generation, payload tampering detection, server-side expiration, replay rejection).
* **Acceptance Criteria:** Confirmation tokens cannot be reused, tampered with, or consumed across users/churches or after TTL expiry.
* **Rollback Strategy:** Remove `confirmation-engine.ts`.

---

### Task 07: Secure AI Tool Executor & Dual-Actor Audit Logging
* **Objective:** Implement the central AI Tool Executor enforcing zero-trust authorization, tenant isolation, untrusted data isolation (prompt injection neutralization), and dual-actor audit logging (`actor_user_id` + `ai_agent_id`).
* **Files:**
  * `[NEW]` `src/lib/ai/secure-tool-executor.ts`
* **Database Impact:** Records AI tool invocations into `audit_logs.metadata`.
* **Security Impact:** Treats external inputs (receipts, descriptions, notes) as passive untrusted data with zero instruction execution privileges. Enforces fail-closed authorization.
* **Tests:** `tests/unit/secure-tool-executor.test.ts`.
* **Acceptance Criteria:** Unauthorized tool calls are blocked with `DENY`; valid calls execute and log dual-actor audit entries with correlation IDs.
* **Rollback Strategy:** Remove executor file.

---

### Task 08: Grace AI READ Capabilities & Data Provenance
* **Objective:** Implement natural language financial summary queries, fund balance checks, budget vs actual comparisons, and anomaly detection with strict data provenance.
* **Files:**
  * `[NEW]` `src/lib/ai/grace-ai-engine.ts`
* **Database Impact:** Calls read-only services (`get_financial_summary`, `get_transactions`, `get_fund_balance`).
* **Security Impact:** AI never invents numbers; includes data provenance (period, source tool, transaction status, included/excluded counts). States "ไม่สามารถยืนยันข้อมูลจาก Financial Ledger ได้" if data is insufficient.
* **Tests:** `tests/unit/grace-ai-read.test.ts`.
* **Acceptance Criteria:** All financial insights cite exact ledger sources; zero hallucinations.
* **Rollback Strategy:** Revert `grace-ai-engine.ts`.

---

### Task 09: Grace AI DRAFT Capabilities
* **Objective:** Implement assistance for generating Draft Transactions and Draft Transfers for user review without mutating posted state.
* **Files:**
  * `[MODIFY]` `src/lib/ai/grace-ai-engine.ts`
* **Database Impact:** Creates records only with `status = 'draft'`.
* **Security Impact:** Drafts do not modify account balances or fund posted balances.
* **Tests:** `tests/unit/grace-ai-draft.test.ts`.
* **Acceptance Criteria:** AI produces a structured draft object with all required fields (funds, categories, accounts, amounts) ready for UI display.
* **Rollback Strategy:** Revert draft methods in `grace-ai-engine.ts`.

---

### Task 10: Grace AI ACTION PROPOSAL Generation
* **Objective:** Implement proposal generation for critical financial actions (`post_transaction`, `transfer_funds`, `void_transaction`) by issuing a Server-Backed Confirmation Token (5-minute server TTL).
* **Files:**
  * `[MODIFY]` `src/lib/ai/grace-ai-engine.ts`
* **Database Impact:** Stores pending confirmation state in `action_confirmations` table.
* **Security Impact:** AI cannot execute financial state mutations; can only register a proposal in pending state.
* **Tests:** `tests/unit/grace-ai-proposals.test.ts`.
* **Acceptance Criteria:** Proposal creates a pending confirmation record in DB and returns a structured proposal card with canonical payload hash.
* **Rollback Strategy:** Revert proposal handler in `grace-ai-engine.ts`.

---

### Task 11: Human Review & Confirmation UI Flow
* **Objective:** Implement UI review dialogs displaying exact proposal details (source, destination, amount, reason, ledger impact) and capturing human confirmation click.
* **Files:**
  * `[NEW]` `src/components/ai/ProposalConfirmationModal.ts`
* **Database Impact:** None.
* **Security Impact:** Prevents in-browser parameter modification before submission.
* **Tests:** UI event and token validation tests.
* **Acceptance Criteria:** Modal shows side-by-side debit/credit impact and submits exact token and nonce to the dedicated execution endpoint.
* **Rollback Strategy:** Remove component.

---

### Task 12: Dedicated Financial Action Execution Endpoint
* **Objective:** Implement the dedicated, non-AI execution route that validates Server Confirmation State (`consume_action_confirmation`), re-checks Server Authorization (`has_church_access`), checks Idempotency (`idempotency_keys`), and dispatches to the corresponding PostgreSQL Financial RPC.
* **Files:**
  * `[NEW]` `src/lib/transactions/financial-action-endpoint.ts`
* **Database Impact:** Atomically consumes confirmation token, mutates account/fund balances via RPC, and records financial audit log.
* **Security Impact:** Strict separation between AI reasoning layer and Financial Action Execution boundary. Human Confirmation $\neq$ Authorization (Dual Control).
* **Tests:** `tests/integration/financial-action-endpoint.test.ts`.
* **Acceptance Criteria:** Action executes successfully only when Authorization + Confirmation + Idempotency + Financial Invariants pass simultaneously.
* **Rollback Strategy:** Remove action endpoint file.

---

### Task 13: Grace AI UI Drawer Widget
* **Objective:** Build an accessible, responsive floating copilot drawer with quick action chips, message feed, proposal review cards, and Thai typography.
* **Files:**
  * `[NEW]` `src/components/ai/GraceAiDrawer.ts`
  * `[MODIFY]` `src/components/layout/AppShell.ts`
* **Database Impact:** None (UI Component).
* **Security Impact:** Displays data provenance badges and confirmation cards securely.
* **Tests:** `tests/unit/grace-ai-drawer-ui.test.ts`.
* **Acceptance Criteria:** Drawer opens smoothly on desktop and 390px mobile; touch targets $\ge 44\text{px}$; zero horizontal overflow.
* **Rollback Strategy:** Remove drawer component.

---

### Task 14: Full Security, Safety & End-to-End Test Suites
* **Objective:** Build and execute comprehensive security tests for Prompt Injection, Role Escalation, Cross-Tenant Isolation, Confirmation Replay/Tampering/Expiry, Giving Enumeration Defense, and Fail-Closed Boundaries.
* **Files:**
  * `[NEW]` `tests/unit/grace-ai-secure-boundary.test.ts`
  * `[NEW]` `tests/integration/security-attacks.test.ts`
* **Database Impact:** None (Test execution).
* **Security Impact:** Validates all 12 Golden Rules and Security Contract requirements.
* **Tests:** `npm test`.
* **Acceptance Criteria:** 100% of tests pass without any warnings or regressions.
* **Rollback Strategy:** Fix failing tests or revert corresponding changes.

---

### Task 15: Production Hardening & Verification
* **Objective:** Conduct end-to-end type checking (`tsc --noEmit`), capture full desktop (1280px) and mobile (390px) screenshots of all pages including Grace AI Copilot, and compile `walkthrough.md`.
* **Files:**
  * `[MODIFY]` `scripts/capture_all_pages.mjs`
  * `[NEW]` `walkthrough.md`
* **Database Impact:** None.
* **Security Impact:** Final sanity check verifying complete production posture.
* **Tests:** `npm run build` + Playwright screenshot suite.
* **Acceptance Criteria:** Zero TypeScript errors, zero console errors, visual verification verified.
* **Rollback Strategy:** N/A.

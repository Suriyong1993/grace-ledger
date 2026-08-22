# REAL PROJECT BASELINE AUDIT — GRACE LEDGER

> **Audit Date:** 2026-08-22  
> **Source of Truth:** Current Local Filesystem & Remote Repository (`Suriyong1993/grace-ledger`)  
> **Verification Status:** 41 Test Files (316 Tests Passed), TypeScript Typecheck Clean (0 errors, 0 warnings), Build Clean

---

## 1. Executive Summary & Status Classification Matrix

| Component Layer | Status | Items Count | Notes / Risk Summary |
| :--- | :---: | :---: | :--- |
| **Database Migrations** | `EXISTS` | 14 migrations | Core schema, RLS, Approval RPCs, Offering, Idempotency, Action Confirmations, Atomic Orchestrator |
| **Financial Core & Money Math** | `EXISTS` | 100% | Exact Decimal banker's rounding, Non-negative invariants, Split sum parity, Immutability |
| **Financial Services Layer** | `EXISTS` | 4 services | `TransactionsService`, `FundsService`, `MembersService`, `ReportsService` (Fail-closed) |
| **Offering & Cash Count Core** | `EXISTS` | 100% | 4-Stage Lifecycle, Dual-counter verification, Variance resolution, Double-entry posting |
| **Server-Backed Idempotency** | `EXISTS` | 100% | `idempotency_keys` table (Option A: church + user scope), SHA-256 canonical hash, safe replay |
| **AI Tool Registry & Core Types** | `EXISTS` | 100% | 11 static tools, 3 capabilities (`READ`, `DRAFT`, `ACTION_PROPOSAL`), 0 Execute, 0 Raw SQL |
| **Secure AI Tool Executor** | `EXISTS` | 100% | Server identity derivation, RBAC recomputed, Tenant boundary, Dual-actor audit |
| **Grace AI Capabilities (Read/Draft/Proposal)** | `EXISTS` | 100% | Provenance tracking, Fact vs Interpretation, Uncommitted drafts, Server-backed action proposals |
| **Action Confirmation & Execution Endpoint** | `EXISTS` | 100% | Atomic DB Orchestration (`execute_confirmed_financial_action`), Rollback on failure |
| **Human Review UI Components** | `EXISTS` | 100% | `ProposalConfirmationModal` (Exact parameters, TTL countdown, double-click protection) |
| **Core Web UI Pages** | `EXISTS` | 8 pages | Dashboard, Transactions, Funds, Members, Reports, Offering, Approvals, Login |
| **Grace AI Drawer Copilot Widget** | `MISSING` | 0% | Interactive chat drawer UI widget (Planned in REAL-13) |
| **Hermes Integration Layer** | `MISSING` | 0% | Hermes Gateway bridge, Thin skill adapter, Telegram identity mapping (Planned in REAL-16 to 20) |
| **Live PostgreSQL Concurrency** | `AT_RISK` | 1 item | Real PostgreSQL 17 concurrency & row locks pending Staging Docker container execution |

---

## 2. Detailed Component Audit

### 2.1 Database Schema & Migrations (`supabase/migrations/`)
* **Status:** `EXISTS` (14 SQL Migrations)
  1. `20260817000001_core_schema.sql` — Churches, profiles, accounts, funds, categories, budgets, transactions, splits, transfers, audit logs
  2. `20260817000002_security_definers.sql` — `has_church_access()`, `get_user_role()`, `current_user_has_role()`
  3. `20260817000003_financial_rpcs_and_triggers.sql` — Balance update triggers, financial audit triggers
  4. `20260817000004_rls_policies.sql` — Strict RLS tenant isolation across all tables
  5. `20260817000005_transaction_core_and_approval_workflow.sql` — `approve_transaction`, `reject_transaction`, `post_transaction`, `void_transaction`
  6. `20260818000006_governance_semantics_and_terminal_rejection.sql` — `request_transaction_revision`, governance rules
  7. `20260818165549_placeholder.sql` — Migration registry placeholder
  8. `20260819000010_offering_core_schema_repair.sql` — Offering sessions, items, denominations, witnesses
  9. `20260819000011_offering_rpcs_and_triggers.sql` — Offering lifecycle RPCs & dual-entry posting
  10. `20260819000012_offering_rls_policies.sql` — Offering RLS policies
  11. `20260821000013_offering_session_items_category_nullable.sql` — Offering item schema repair
  12. `20260821000014_idempotency_and_action_confirmations.sql` — `idempotency_keys` table, `acquire_idempotency_record`, `complete_idempotency_record`, `mark_idempotency_failed`, idempotent `transfer_funds`
  13. `20260821000015_action_confirmations.sql` — `action_confirmations` table, `create_action_confirmation`, `consume_action_confirmation`
  14. `20260822000016_execute_confirmed_financial_action.sql` — Single-transaction atomic execution orchestrator RPC

---

### 2.2 Core Financial Services (`src/lib/`)
* **`Money` Precision Engine (`src/lib/money.ts`):** `EXISTS` (Banker's rounding Decimal.js, 2 decimal places, arithmetic, formatting, zero/equals/lessThan/greaterThan)
* **RBAC & Authorization (`src/lib/rbac.ts`):** `EXISTS` (7 User Roles, `can()`, `assertPermission()`, `canExecuteFinancialAction()`)
* **Transactions Service (`src/lib/transactions/transactions-service.ts`):** `EXISTS` (List, GetById, Submit, Approve, Reject, Revision)
* **Funds Service (`src/lib/funds/funds-service.ts`):** `EXISTS` (List, GetById, GetBalance, ProposeTransfer)
* **Members Service (`src/lib/members/members-service.ts`):** `EXISTS` (List, GetGivingSummary, GetGivingHistory with sensitive data protection)
* **Reports Service (`src/lib/reports/reports-service.ts`):** `EXISTS` (Monthly Financial Summary, Fund Balances, Budget vs Actual from posted ledger only)
* **Offering Core (`src/lib/offering/`):** `EXISTS` (Lifecycle, Denomination calculation, Variance threshold enforcement, Posting)

---

### 2.3 Grace AI Security & Capability Layer (`src/lib/ai/`)
* **AI Types & Capability Contract (`src/lib/ai/types.ts`):** `EXISTS` (Capability model: `READ`, `DRAFT`, `ACTION_PROPOSAL`. `UntrustedData<T>` wrapper)
* **Static Tool Registry (`src/lib/ai/tools-registry.ts`):** `EXISTS` (11 approved static tools, frozen allowlist, 0 execute capability)
* **Confirmation Engine (`src/lib/ai/confirmation-engine.ts`):** `EXISTS` (Canonical JSON normalization, SHA-256 hashing, Nonce generation)
* **Secure Tool Executor (`src/lib/ai/secure-tool-executor.ts`):** `EXISTS` (Server identity derivation, RBAC recomputed, Tenant validation, Dual-actor audit)
* **Grace AI READ Service (`src/lib/ai/grace-ai-read.ts`):** `EXISTS` (Data provenance metadata, Fact vs Analysis vs Interpretation, Fail-closed)
* **Grace AI DRAFT Service (`src/lib/ai/grace-ai-draft.ts`):** `EXISTS` (Uncommitted draft transactions & transfers, Split parity, Zero financial balance impact)
* **Grace AI ACTION PROPOSAL Service (`src/lib/ai/grace-ai-proposals.ts`):** `EXISTS` (Post, Transfer, Void proposals with snapshot and server confirmation reference)
* **Financial Action Execution Endpoint (`src/lib/ai/financial-action-endpoint.ts`):** `EXISTS` (Server-side executor invoking atomic DB orchestration RPC)
* **Grace AI Drawer Widget:** `MISSING` (To be implemented in REAL-13)

---

### 2.4 User Interface & Pages (`src/pages/`, `src/components/`)
* **Dashboard Page (`src/pages/DashboardPage.ts`):** `EXISTS` (Real stats, quick actions, accounts list, funds overview, recent transactions)
* **Transactions Page (`src/pages/TransactionsPage.ts`):** `EXISTS` (Real transactions list, search, filters, pagination, create transaction modal)
* **Funds Page (`src/pages/FundsPage.ts`):** `EXISTS` (Real funds list, balance cards, transfer proposal modal)
* **Members Page (`src/pages/MembersPage.ts`):** `EXISTS` (Real member list, search, member giving history modal)
* **Reports Page (`src/pages/ReportsPage.ts`):** `EXISTS` (Real monthly summary, fund summary, budget vs actual report)
* **Offering Page (`src/pages/OfferingPage.ts`):** `EXISTS` (Real 4-stage offering lifecycle, cash counting, variance resolution, posting)
* **Approvals Page (`src/pages/ApprovalsPage.ts`):** `EXISTS` (Real approval queue, decision sheet, rejection/revision modal)
* **Login Page (`src/pages/LoginPage.ts`):** `EXISTS` (Supabase authentication)
* **Human Confirmation Modal (`src/components/ai/ProposalConfirmationModal.ts`):** `EXISTS` (Exact parameter card, TTL countdown, double-click protection)
* **App Shell Layout (`src/components/layout/AppShell.ts`):** `EXISTS` (Navigation, responsive header, user profile, role badge)

---

### 2.5 Hermes & Telegram Integration Layer
* **Hermes API Adapter:** `MISSING` (To be implemented in REAL-16)
* **Hermes Grace Ledger Skill (`grace-ledger` thin adapter):** `MISSING` (To be implemented in REAL-17)
* **Telegram Financial Workflow:** `MISSING` (To be implemented in REAL-18)
* **Telegram Identity Mapping (`telegram_user_id` $\rightarrow$ `grace_user_id`):** `MISSING` (To be implemented in REAL-19)
* **Hermes E2E Security Tests:** `MISSING` (To be implemented in REAL-20)

---

### 2.6 Test Suites & Build Verification (`tests/`)
* **Unit Tests (36 test files):** `EXISTS` — All Green (296 tests passed)
* **Integration Tests (5 test files):** `EXISTS` — All Green (20 tests passed)
* **Total Vitest Test Count:** `41 passed (41 files, 316 tests passed — 100% Green)`
* **TypeScript Compiler (`tsc --noEmit`):** `PASS` (0 errors, 0 warnings)
* **Production Build (`npm run build`):** `PASS` (0 errors)
* **Live PostgreSQL 17 Concurrency Verification:** `AT_RISK` (Pending live PostgreSQL staging container execution)

---

## 3. Immediate Action Plan & Transition to REAL-02

With the baseline audit recorded and verified:
1. **REAL-01 (Baseline Audit):** `PASS`
2. **Next Step -> REAL-02 (Production Mock Removal & Fail-Closed Audit):** Scan all production paths to guarantee 0 mock fallbacks remain in UI/Service code, and verify that all error states fail closed.

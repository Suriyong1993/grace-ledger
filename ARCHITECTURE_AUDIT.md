# Grace Ledger — Architecture & Security Pre-Implementation Audit (ARCHITECTURE_AUDIT.md)

**Date of Audit:** 2026-08-21  
**Audit Standard:** Grace Ledger Final Security Contract & Grace AI Architecture Specification  
**Status:** Post-Audit Consistency Check Completed (Pre-Implementation Baseline Verified)  

---

## 1. Executive Summary & Boundary Separation

This audit establishes the pre-implementation security baseline of **Grace Ledger** by verifying the existing codebase, migrations, RLS policies, and RPCs against the **Final Security Contract**.

To maintain architectural clarity, the project state is categorized as follows:
* **Database Financial Core (PostgreSQL 17 / Supabase):** **PASS**  
  *Verified from codebase.* Migrations 001–013 enforce strict `NUMERIC(14,2)` arithmetic, `fund_id NOT NULL` fund accounting invariants, split sum parity triggers, immutable ledger rules (`fn_validate_transaction_split_lifecycle`), atomic inter-fund transfers with row-level locks (`SELECT ... FOR UPDATE`), void/reversal mirror mechanics (`void_transaction`), dual-counter physical cash counting, and RLS lockdown on sensitive member giving records (`member_giving_records`) and audit trails (`audit_logs`).
* **Application Financial Services Layer (`src/lib/`):** **MISSING / To Be Implemented**  
  Must be created with Zod input validation, strict Decimal arithmetic, client-side RBAC assertions (`can()`, `assertPermission()`), and server-side RPC bindings. **The Service Layer is NOT a replacement for the database security boundary; database constraints, RLS, and RPCs remain the final, unbypassable security boundary.**
* **Production Mock Fallback Removal:** **AT RISK / Immediate Remediation Required**  
  Current UI pages contain fallback blocks that catch query errors and display mock data. In production, `Database Error` must result in an explicit `Error State` (Fail-Closed), never silent mock data fallback.
* **Grace AI Financial Copilot & Secure AI Boundary (`src/lib/ai/`):** **MISSING / To Be Implemented**  
  Must be implemented with a strict 3-tier capability model (`READ`, `DRAFT`, `ACTION PROPOSAL`), an explicit allowlist Tool Registry, canonical payload-bound cryptographic confirmation tokens, prompt injection neutralization via untrusted data isolation, and dual-actor audit logging.

---

## 2. Post-Audit Consistency Evaluation Matrix

```text
=====================================================================================================
CATEGORY                      | PASS | AT RISK | MISSING | CONFLICT | TOTAL EVALUATED | STATUS
=====================================================================================================
1. Database Schema & Tables   |  14  |    0    |    0    |    0     |       14        | PASS
2. Financial Invariants (DB)  |  10  |    0    |    0    |    0     |       10        | PASS
3. RLS & Tenant Isolation (DB)|  12  |    0    |    0    |    0     |       12        | PASS
4. RBAC & Security Definers   |   8  |    0    |    0    |    0     |        8        | PASS
5. Immutable Ledger & Reversal|   6  |    0    |    0    |    0     |        6        | PASS
6. Production Mock Elimination|   0  |    4    |    0    |    0     |        4        | AT RISK (Fix #1)
7. Financial Idempotency      |   0  |    0    |    2    |    0     |        2        | MISSING (Fix #2)
8. Application Core Services  |   0  |    0    |    4    |    0     |        4        | MISSING (Fix #3)
9. Confirmation Token Engine  |   0  |    0    |    2    |    0     |        2        | MISSING (Fix #4)
10. AI Tool Registry & Schema |   0  |    0    |    3    |    0     |        3        | MISSING (Fix #5)
11. Secure AI Tool Executor   |   0  |    0    |    3    |    0     |        3        | MISSING (Fix #6)
12. Grace AI Reasoning Engine |   0  |    0    |    3    |    0     |        3        | MISSING (Fix #7)
13. Giving Enumeration Defense|   0  |    0    |    2    |    0     |        2        | MISSING (Fix #8)
14. Testing & Verification    |   5  |    0    |    5    |    0     |       10        | MISSING (Fix #9)
=====================================================================================================
TOTAL                         |  55  |    4    |   24    |    0     |       83        | PRE-IMPLEMENTATION
=====================================================================================================
```

---

## 3. Detailed Forensic Findings

### 🟢 [PASS] Verified from Codebase (PostgreSQL 17 / Supabase)

| Item ID | Area | Location / Codebase Artifact | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **P-01** | **Multi-Tenant Anchor** | `migrations/20260817000001_core_schema.sql` | `churches` table is multi-tenant anchor. `profiles.church_id` FK references `churches(id) ON DELETE RESTRICT`. `user_roles` unique constraint `(user_id, church_id, role)` verified. |
| **P-02** | **Strict Decimal Arithmetic** | `migrations/001`, `src/lib/money.ts` | All DB currency columns are `NUMERIC(14,2)`. Frontend uses `decimal.js` wrapped by `Money`. Zero floating-point arithmetic. |
| **P-03** | **Fund Accounting Invariant** | `migrations/20260817000001_core_schema.sql` | `transaction_splits.fund_id` is constrained with `NOT NULL` and `chk_split_fund_not_null`. Every Baht is strictly assigned to a designated fund. |
| **P-04** | **Split Sum Parity Trigger** | `migrations/005` & `migrations/006` | `fn_validate_transaction_split_lifecycle()` triggers on `pending_approval`, `approved`, `posted` to verify `SUM(splits) = transaction.amount`. |
| **P-05** | **Immutable Ledger & Deletion Guard** | `migrations/20260818000006_governance_semantics.sql` | Trigger blocks direct `UPDATE` of financial fields (`amount`, `account_id`, `direction`) and blocks `DELETE` on all non-draft states. |
| **P-06** | **Atomic Inter-Fund Transfers** | `migrations/20260817000003_financial_rpcs.sql` | `transfer_funds()` RPC acquires row locks (`SELECT ... FOR UPDATE`), enforces `from_fund <> to_fund`, validates balance, debits source, credits destination, and logs audit event atomically. |
| **P-07** | **Non-Negative Fund Invariant** | `migrations/20260817000003_financial_rpcs.sql` | `transfer_funds()` validates `v_from_balance >= p_amount`; raises exception on overdraft. |
| **P-08** | **Segregation of Duties (SoD)** | `migrations/20260817000005_transaction_core.sql` | `approve_transaction()` rejects approval when `auth.uid() = created_by` (Two-Person Rule). |
| **P-09** | **Void & Reversal Mechanics** | `migrations/20260818000006_governance_semantics.sql` | `void_transaction()` requires `posted` status, minimum 5-char reason, marks original as `voided`, and creates mirror reversing entry linked to `reversal_of_id`. |
| **P-10** | **Terminal Rejection & Revision** | `migrations/20260818000006_governance_semantics.sql` | Separate RPCs for `request_transaction_revision` (`pending_approval -> draft`) and `reject_transaction_terminal` (`pending_approval -> rejected`). |
| **P-11** | **Giving Privacy by Design (RLS)** | `migrations/20260817000004_rls_policies.sql` | Direct `SELECT` on `member_giving_records` denied for all clients via `USING (false)`. Access only through `get_member_giving_history()` RPC with mandatory logged reason. |
| **P-12** | **Immutable Audit Logs (RLS)** | `migrations/20260817000004_rls_policies.sql` | Direct `INSERT/UPDATE/DELETE` on `audit_logs` blocked for all clients via `USING (false)` / `WITH CHECK (false)`. |
| **P-13** | **Security Definers & Search Path** | `migrations/20260817000002_security_definers.sql` | `has_church_access` and `current_user_church_id` execute as `SECURITY DEFINER` with fixed `search_path = public, pg_temp`. |
| **P-14** | **Offering Physical Cash Count** | `migrations/20260819000010_offering_core.sql` | Dual counter check (`chk_cash_count_counters_different`), denomination breakdown (1000, 500, 100, 50, 20, coins), variance review, and single financial posting link. |

---

### 🟡 [AT RISK] Production Risk Requiring Immediate Remediation

| Item ID | Location | Risk & Security Flaw | Required Remediation |
| :--- | :--- | :--- | :--- |
| **R-01** | `src/pages/TransactionsPage.ts` | Falls back to `getDefaultTransactions()` on query error or empty data. | Replace fallback with explicit `Error State` (Fail-Closed) and `Empty State`. Remove mock data from production path. |
| **R-02** | `src/pages/FundsPage.ts` | Falls back to `getDefaultFunds()` on query error. | Replace fallback with explicit `Error State` and `Empty State`. Remove mock data from production path. |
| **R-03** | `src/pages/MembersPage.ts` | Falls back to `getDefaultMembers()` on query error. | Replace fallback with explicit `Error State` and `Empty State`. Remove mock data from production path. |
| **R-04** | `src/pages/DashboardPage.ts` | Falls back to mock stats on error. | Replace fallback with explicit `Error State`. |

---

### 🔵 [MISSING] Components to Implement

| Item ID | Category | Target Location | Specification & Security Requirements |
| :--- | :--- | :--- | :--- |
| **M-00** | **Financial Idempotency** | `src/lib/transactions/idempotency.ts` | Idempotency key generator & validator protecting all mutations (Submit, Approve, Post, Void, Transfer, Offering Count) against double-click, browser/network/AI retries, and duplicate confirmations. |
| **M-01** | **Transactions Live Service** | `src/lib/transactions/transactions-service.ts` | Full CRUD lifecycle, Zod schema validation, client-side RBAC assertions (`can()`, `assertPermission()`), split parity validation, and RPC bindings (`submit_transaction`, `post_transaction`, `void_transaction`). |
| **M-02** | **Funds Live Service** | `src/lib/funds/funds-service.ts` | Live fund balance retrieval, budget target adjustments, and `transfer_funds` atomic RPC execution with idempotency key. |
| **M-03** | **Members Live Service** | `src/lib/members/members-service.ts` | Member directory CRUD, secure `get_member_giving_history` RPC invocation with mandatory justification reason ($\ge 5$ chars), and server-side tax certificate calculation. |
| **M-04** | **Reports Live Service** | `src/lib/reports/reports-service.ts` | Aggregate monthly/annual statement of financial position from posted transactions. |
| **M-05** | **Confirmation Engine** | `src/lib/ai/confirmation-engine.ts` | Cryptographic confirmation token engine: Canonical Payload $\rightarrow$ Deterministic Serialization (sorted keys, normalized types) $\rightarrow$ SHA-256 hash. Binds `user_id`, `church_id`, `action`, `tool_name`, `resource_id`, `normalized_parameters`, `expires_at`, `nonce`. Single-use enforcement. |
| **M-06** | **AI Tool Registry (Allowlist)** | `src/lib/ai/tools-registry.ts` | Explicit Zod schemas for all approved tools (`READ`, `DRAFT`, `ACTION PROPOSAL`). Zero raw SQL, zero dynamic tool generation, zero model-trusted outputs. |
| **M-07** | **Secure AI Tool Executor** | `src/lib/ai/secure-tool-executor.ts` | Zero-trust authorization check, fail-closed tenant validation, untrusted data isolation (prompt injection neutralization), dual-actor audit logging (`actor_user_id` + `ai_agent_id` + `correlation_id`), and confirmation token validation for action proposals. |
| **M-08** | **Grace AI Reasoning Engine** | `src/lib/ai/grace-ai-engine.ts` | Natural language Thai financial reasoning with strict data provenance (period, source tool, transaction status, included/excluded counts, generated timestamp). Zero hallucinated figures. |
| **M-09** | **Giving Enumeration Defense** | `src/lib/members/members-service.ts`, `src/lib/ai/secure-tool-executor.ts` | Rate limiter and sequential access detection preventing bulk enumeration of member giving records via UI or AI. |
| **M-10** | **Grace AI Drawer UI** | `src/components/ai/GraceAiDrawer.ts` | Floating/drawer copilot widget with proposal review cards and explicit human confirmation buttons. |
| **M-11** | **Comprehensive Test Suites** | `tests/unit/`, `tests/integration/` | Automated tests covering: Idempotency, Concurrency, Void/Reversal, Giving Privacy & Enumeration, Confirmation Tampering/Replay, Prompt Injection, Fail-Closed Boundaries, and Dual-Actor Audit Trails. |

---

### 🔴 [CONFLICT] Architectural Incompatibilities
* **None Detected.** The PostgreSQL 17 database schema, triggers, and TypeScript structure match the Final Security Contract without conflict.

---

## 4. Affected Files Summary

```text
AFFECTED EXISTING FILES (Modifications):
- src/pages/TransactionsPage.ts      (Remove mock fallback, bind TransactionsService, bind ErrorState)
- src/pages/FundsPage.ts             (Remove mock fallback, bind FundsService, bind ErrorState)
- src/pages/MembersPage.ts           (Remove mock fallback, bind MembersService, bind ErrorState)
- src/pages/DashboardPage.ts         (Remove mock fallback, bind live summary, bind ErrorState)
- src/lib/supabase/types.ts          (Ensure complete RPC & table signatures)

NEW FILES TO BE CREATED:
- src/lib/transactions/idempotency.ts
- src/lib/transactions/transactions-service.ts
- src/lib/funds/funds-service.ts
- src/lib/members/members-service.ts
- src/lib/reports/reports-service.ts
- src/lib/ai/types.ts
- src/lib/ai/tools-registry.ts
- src/lib/ai/confirmation-engine.ts
- src/lib/ai/secure-tool-executor.ts
- src/lib/ai/grace-ai-engine.ts
- src/components/ai/GraceAiDrawer.ts
- tests/unit/transactions-service.test.ts
- tests/unit/funds-service.test.ts
- tests/unit/members-service.test.ts
- tests/unit/confirmation-engine.test.ts
- tests/unit/grace-ai-secure-boundary.test.ts
- tests/integration/idempotency-and-concurrency.test.ts
```

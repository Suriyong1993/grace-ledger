# Milestone 3 — Real Database Migration Report
**Sunday Offering & Cash Count (PostgreSQL 17 / Supabase Test Database)**

**Date:** 2026-08-19  
**Database:** Supabase PostgreSQL 17 (`grace-ledger-test`)  
**Status:** 🟢 **APPLIED & VERIFIED (PASS)**  

---

## 1. Migration Execution Summary

All corrective migrations (010, 011, 012) and the historical placeholder were applied cleanly without errors or rollbacks.

```text
Applied Migrations:
  ├── 20260817000001_core_schema.sql                                         [M1 Base]  ✅
  ├── 20260817000002_security_definers.sql                                   [M1 Base]  ✅
  ├── 20260817000003_financial_rpcs_and_triggers.sql                         [M1 Base]  ✅
  ├── 20260817000004_rls_policies.sql                                        [M1 Base]  ✅
  ├── 20260817000005_transaction_core_and_approval_workflow.sql               [M2 Base]  ✅
  ├── 20260818000006_governance_semantics_and_terminal_rejection.sql         [M2 Base]  ✅
  ├── 20260818165549_placeholder.sql                                         [Remote]   ✅
  ├── 20260819000010_offering_core_schema_repair.sql                         [M3 Core]  ✅
  ├── 20260819000011_offering_rpcs_and_triggers.sql                           [M3 RPC]   ✅
  └── 20260819000012_offering_rls_policies.sql                               [M3 RLS]   ✅
```

---

## 2. Live Schema Verification Details

### 2.1 Tables Created & Evolved (4 Tables)
1. **`offering_sessions` (Core Header):**
   - Evolved in-place without table drop/recreate.
   - Added channel-separated expected amounts: `expected_cash_amount`, `expected_transfer_amount`, `expected_qr_amount`, `expected_total_amount`.
   - Added physical count & variance: `counted_cash_amount`, `cash_variance_amount`, `variance_status`.
   - Added ledger linkage: `financial_transaction_id`, `posted_at`, `posted_by`.
   - Evolved `status` column to `TEXT` with strict check constraint `chk_offering_session_status`.
2. **`offering_session_items` (Channel $\times$ Fund Breakdown):**
   - Stores category, fund, channel (`cash`, `bank_transfer`, `qr_code`, `other`), source type, and amount.
3. **`offering_cash_counts` (Physical Denominations Proof):**
   - Stores bill counts (1000, 500, 100, 50, 20), coins amount, total cash counted, and dual counter IDs (`counted_by_1`, `counted_by_2`).
   - Enforces check constraint `chk_cash_count_counters_different` (`counted_by_1 <> counted_by_2`).
4. **`offering_session_revisions` (Immutable Expected Revision Trail):**
   - Append-only audit table storing previous/new cash & total amounts, revision number, mandatory reason ($\ge 5$ chars), and `revised_by`.

---

### 2.2 Business RPCs (7 RPCs)
| RPC Function | Access Control | Primary Responsibilities |
|---|---|---|
| `create_offering_session` | Treasurer, Staff, Super Admin | Initializes session in `draft`, records channel items, computes channel totals. |
| `revise_offering_expected_amount` | Treasurer, Super Admin | Updates items, recalculates variance, appends immutable revision row with reason ($\ge 5$ chars). |
| `start_cash_count` | Counter, Staff, Treasurer | Validates dual counters (`c1 <> c2`), moves status to `counting`. |
| `record_cash_count` | Counter, Staff, Treasurer | Computes physical total from bills/coins, calculates cash variance, transitions to `counted` or `variance_review`. |
| `resolve_offering_variance` | Staff, Treasurer, Super Admin | Supports `'recount'` (reverts to `counting`) or `'explain'` (sets status to `explained` with reason $\ge 5$ chars). |
| `confirm_offering_session` | Treasurer, Staff, Super Admin | Enforces dual counter signatures and blocks unresolved non-zero variance. Sets status to `confirmed`. |
| `post_offering_to_ledger` | Treasurer, Super Admin | Atomic double-entry posting with row locking (`FOR UPDATE`), idempotency guard (`already_posted`), Channel $\times$ Fund splits, Cash Drawer credit, Bank Account credit, and variance split balancing. |

---

### 2.3 Lifecycle Triggers & Invariant Guards
- **`trg_validate_offering_session_lifecycle` on `offering_sessions`:**
  - Blocks all illegal shortcuts: `draft -> confirmed`, `draft -> posted`, `counting -> posted`, `counted -> posted`.
  - Enforces immutability on `posted` and `voided` sessions.
  - Blocks confirmation if `cash_variance_amount <> 0` and explanation is missing or $< 5$ chars.
  - Enforces dual counters `counter1_id <> counter2_id`.

---

### 2.4 Row Level Security (RLS) Policies (8 Policies)
- `p_offering_sessions_select`: Multi-tenant isolation for Counter, Staff, Pastor, Treasurer, Super Admin.
- `p_offering_sessions_manage`: Mutating operations restricted to Staff, Treasurer, Super Admin within user's `church_id`.
- `p_offering_session_items_select` / `p_offering_session_items_manage`: Multi-tenant item visibility and management.
- `p_offering_cash_counts_select` / `p_offering_cash_counts_manage`: Counters and finance roles isolated to their church.
- `p_offering_session_revisions_select` / `p_offering_session_revisions_insert`: Append-only revision trail for Treasurers and Super Admins. (No `UPDATE` or `DELETE` policies exist).

---

### 2.5 Indexes & Performance
- `idx_offering_financial_tx`: `UNIQUE` partial index on `financial_transaction_id` for ledger posting idempotency.
- `uq_offering_session_service`: `UNIQUE` constraint on `(church_id, service_date, service_name)`.
- `idx_offering_sessions_status`: Multi-column index on `(church_id, status)`.
- `idx_offering_items_session` & `idx_offering_items_church_fund`.
- `idx_offering_cash_counts_session`.
- `idx_offering_revisions_session`.

---

## 3. Remaining Operational Risks & Mitigation

| Potential Risk | Severity | Implemented Mitigation |
|---|---|---|
| Concurrent Double-Posting | High | Database Unique Partial Index `idx_offering_financial_tx` + Row Lock `SELECT ... FOR UPDATE` + Idempotency Check returning canonical transaction ID. |
| Mixed Cash & Bank Deposits | High | Mandatory Bank Account validation in `post_offering_to_ledger` if electronic transfers exist; physical cash credited strictly to Cash Drawer. |
| Unexplained Cash Shortage | High | Database Trigger `trg_validate_offering_session_lifecycle` and RPC guards block confirmation if variance $\ne 0$ without valid explanation ($\ge 5$ chars). |
| Cross-Tenant Data Leakage | Critical | RLS policies on all 4 tables enforcing `has_church_access(church_id, ...)` + `church_id = current_user_church_id()`. |

---

## 4. Next Step: M3 Real Database Integration Test Suite

Following the established protocol, UI implementation remains on hold until the **Real PostgreSQL 17 Integration Tests** (Phase 1F) execute against live Supabase covering:
1. Standard Happy Path (Draft $\rightarrow$ Dual Count $\rightarrow$ Zero Variance $\rightarrow$ Confirmed $\rightarrow$ Posted)
2. Variance Resolution Path (Recount + Explanation $\rightarrow$ Confirmed $\rightarrow$ Posted)
3. Expected Revision Path (Typo correction $\rightarrow$ Revision History Append $\rightarrow$ Recount $\rightarrow$ Posted)
4. Concurrent Posting Idempotency Verification
5. Cross-Tenant RLS Boundary Enforcement

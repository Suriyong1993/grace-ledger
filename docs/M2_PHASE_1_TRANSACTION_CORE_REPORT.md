# Milestone 2 — Phase 1: Transaction Core Verification Report

**Project:** Grace Ledger  
**Milestone:** M2 — Core Financial Workflows  
**Phase:** Phase 1 — Transaction Core  
**Execution Date:** 2026-08-18  
**Database Target:** Supabase PostgreSQL 17.6 (`grace-ledger-test` / `jeklcfpqmytdmwczxqlx` @ `ap-northeast-1`)  
**Status:** **PHASE 1 COMPLETE & VERIFIED ON REAL SUPABASE POSTGRESQL**  

---

## 1. Executive Summary

```text
================================================================================
M2 PHASE 1 STATUS: PASS (14 / 14 Real Database Tests Passed — 100% Success)
Unit Test Suite:   51 / 51 Tests Passed (100% Success)
TypeScript Build:  0 Errors (Strict Typecheck Pass)
================================================================================
```

Phase 1 implemented the Transaction Core domain layer, state machine, and database RPCs enforcing the **Two-Person Rule (`created_by != approved_by`)**, strict split-sum parity (`SUM(splits) = amount`), immutable posted ledger entries, void/reversal balancing, and tenant isolation.

---

## 2. Migration 005 Summary

**Migration File:** [`supabase/migrations/20260817000005_transaction_core_and_approval_workflow.sql`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/supabase/migrations/20260817000005_transaction_core_and_approval_workflow.sql)  
**Deployment Status:** Successfully applied to remote Supabase PostgreSQL 17 database via `supabase db push`.

### Changes Applied:
1. **Status Enum Enhancement**: Added `'approved'` to `transaction_status_enum` (`draft` -> `pending_approval` -> `approved` -> `posted` -> `voided`).
2. **Audit & Tracking Columns**: Added `approved_at`, `rejected_by`, `rejected_at`, and `rejection_reason` to `transactions`.
3. **Database-Level Trigger**: Updated `fn_validate_transaction_split_lifecycle` to validate split parity on status advancement and lock financial attributes against direct modification.
4. **Stored Procedures (`SECURITY DEFINER` + `SET search_path = public, pg_temp`)**:
   - `submit_transaction(p_transaction_id UUID)`
   - `approve_transaction(p_transaction_id UUID, p_note TEXT)` (Enforces Two-Person Rule)
   - `reject_transaction(p_transaction_id UUID, p_rejection_reason TEXT)` (Mandatory reason `>= 5` chars)
   - `post_transaction(p_transaction_id UUID)` (Mutates accounts and funds atomically)
   - `void_transaction(p_transaction_id UUID, p_reason TEXT)` (Balancing reversal + rebalancing)
5. **RLS Policy Update**: Allowed `approver` role to select transactions and splits for approval review.

---

## 3. Real Database Verification Table (PostgreSQL 17)

| Test ID | Test Scenario | Execution on Supabase PostgreSQL 17 | Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **M2-01** | **Draft Creation** | Inserted draft transaction header for ฿10,000.00 | Created in `draft` status | **PASS** |
| **M2-02** | **Incomplete Draft Splits** | Partial split ฿6,000.00 inserted while in draft | Draft state allows incomplete splits during entry | **PASS** |
| **M2-03** | **Invalid Submit Blocked** | Attempted `submit_transaction()` with ฿6,000 / ฿10,000 | Blocked by parity check: `Split sum must equal transaction amount` | **PASS** |
| **M2-04** | **Full Split Allocation** | Added ฿4,000 split to Building Fund (Total = ฿10,000) | Full parity achieved across 2 splits | **PASS** |
| **M2-05** | **Submit for Approval** | Called `submit_transaction()` with exact parity | Status transitioned to `pending_approval`; `APPROVAL` audit logged | **PASS** |
| **M2-06** | **Two-Person Rule** | Creator attempted `approve_transaction()` on own record | Blocked by DB: `Segregation of Duties Violation: Creator cannot approve own transaction` | **PASS** |
| **M2-07** | **Unauthorized Approval**| Member attempted `approve_transaction()` | Blocked: `Unauthorized: Only designated approvers or pastors may approve` | **PASS** |
| **M2-08** | **Rejection Workflow** | Approver called `reject_transaction()` with reason | Status reverted `pending_approval` -> `draft`, recorded `rejected_by` and reason | **PASS** |
| **M2-09** | **Second Person Approval**| Creator resubmitted; Approver approved transaction | Status transitioned `pending_approval` -> `approved`, recorded `approved_by` and `approved_at` | **PASS** |
| **M2-10** | **Unauthorized Post** | Approver/Staff attempted `post_transaction()` | Blocked: `Unauthorized: Only treasurers or administrators may post` | **PASS** |
| **M2-11** | **Authorized Post** | Treasurer called `post_transaction()` | Status transitioned to `posted`; Account credited ฿50k -> ฿60k; General credited ฿30k -> ฿36k; Building credited ฿20k -> ฿24k | **PASS** |
| **M2-12** | **Posted Immutability** | Direct `UPDATE transactions SET amount = 99999` attempted | Blocked by `Immutable Ledger` trigger | **PASS** |
| **M2-13** | **Void & Reversal** | Treasurer called `void_transaction()` with reason | Original marked `voided` (never deleted); Balancing reversal transaction created (`expense ฿10,000`); Account restored to ฿50,000; Funds restored to ฿30,000 / ฿20,000 | **PASS** |
| **M2-14** | **Tenant Isolation** | Church B user attempted to view/void Church A transaction | Blocked by RLS & Security Definer checks | **PASS** |

---

## 4. Domain Layer Implementation

- [`src/lib/transactions/types.ts`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/lib/transactions/types.ts): Strongly-typed domain models for Transactions, Splits, Statuses, and Actors.
- [`src/lib/transactions/split-engine.ts`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/lib/transactions/split-engine.ts): Precise split summation, remainder calculation, and remainder penny distribution (`distributeEvenly`, `distributeByPercentages`).
- [`src/lib/transactions/lifecycle.ts`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/lib/transactions/lifecycle.ts): State machine enforcing transition permissions and Two-Person Rule boundaries.
- [`src/lib/money.ts`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/src/lib/money.ts): Enhanced with `abs()` and `toAmountString()` methods.

---

## 5. Remaining Risks & Next Steps

1. **Remaining Phase 1 Risks**: **None identified**. All 14 core database requirements and 51 unit tests passed with 0 errors on PostgreSQL 17.
2. **Next Steps (Phase 2)**: Approval Workflow Queue & multi-role UI integration. (Awaiting user authorization).

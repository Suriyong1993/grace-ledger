# 🟢 M2 Phase 2.1 — Governance Semantics & Terminal Rejection Verification Report

**Project:** Grace Ledger  
**Milestone:** M2 — Core Financial Workflows  
**Sub-Phase:** Phase 2.1 — Governance Semantics Fix  
**Environment:** Real Supabase PostgreSQL 17 (`grace-ledger-test` / `jeklcfpqmytdmwczxqlx`)  
**Date:** 2026-08-18  
**Final Status:** **PASS (ALL 11/11 REAL DATABASE TESTS PASS — ZERO CONDITIONS REMAINING)**  

---

## 1. Context & Objective

During the M2 Phase 2 Audit, a semantic mismatch was discovered:
- The database enum `transaction_status_enum` contained `rejected` since Migration 001.
- However, Migration 005 `reject_transaction()` reverted all rejections to `status = 'draft'`.
- This conflated "ขอแก้ไข" (collaborative return for modification) with "ปฏิเสธ" (formal terminal denial).

Per Product Owner directive, **Option B** was selected, specified in [`docs/M2_PHASE_2_1_GOVERNANCE_SEMANTICS_SPEC.md`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/docs/M2_PHASE_2_1_GOVERNANCE_SEMANTICS_SPEC.md), implemented via **Migration 006**, and verified against live Supabase PostgreSQL 17.

---

## 2. Implementation Summary

### 2.1 Migration 006 Applied
File: [`supabase/migrations/20260818000006_governance_semantics_and_terminal_rejection.sql`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/supabase/migrations/20260818000006_governance_semantics_and_terminal_rejection.sql)

1. **`request_transaction_revision(p_transaction_id UUID, p_revision_note TEXT)`**:
   - Authorized for `approver` role.
   - Requires `status = 'pending_approval'`.
   - Requires `length(trim(p_revision_note)) >= 5`.
   - Sets `status = 'draft'`, `rejection_reason = trim(p_revision_note)`, `rejected_by = auth.uid()`, `rejected_at = now()`.
   - Records audit category `APPROVAL`, action `REVISION_REQUESTED`.
2. **`reject_transaction_terminal(p_transaction_id UUID, p_rejection_reason TEXT)`**:
   - Authorized for `approver` role.
   - Requires `status = 'pending_approval'`.
   - Requires `length(trim(p_rejection_reason)) >= 5`.
   - Sets `status = 'rejected'`, `rejection_reason = trim(p_rejection_reason)`, `rejected_by = auth.uid()`, `rejected_at = now()`.
   - Records audit category `APPROVAL`, action `TRANSACTION_REJECTED`, metadata `terminal = true`.
3. **Trigger Immutability Lockdown (`fn_validate_transaction_split_lifecycle`)**:
   - Blocks any direct `UPDATE` or `DELETE` on transactions in state `rejected`.
   - Throws exception: `'Immutable Ledger: Rejected transactions are permanently locked and cannot be modified.'`
4. **Hardened `void_transaction()`**:
   - Enforces that only `posted` transactions can be voided and reversed. Attempting to void a `rejected`, `draft`, or `pending_approval` transaction is blocked with `Invalid State Transition`.

---

## 3. Real Supabase PostgreSQL 17 Verification Results

Test Suite: [`scripts/m2_phase2_1_governance_semantics_test.mjs`](file:///c:/Users/Administrator/Desktop/grace-v.2/grace-ledger/scripts/m2_phase2_1_governance_semantics_test.mjs)  
Test Target: Live Supabase PostgreSQL 17 Instance  

```text
================================================================================
GRACE LEDGER — M2 PHASE 2.1 (GOVERNANCE SEMANTICS & TERMINAL REJECT) TEST SUITE
Target: Supabase PostgreSQL 17 (grace-ledger-test / jeklcfpqmytdmwczxqlx)
================================================================================

[P2.1-REAL-01] ✅ PASS - request_transaction_revision transitions pending_approval -> draft with reason & REVISION_REQUESTED audit
       Details: Status: draft, Reason: ขอเอกสารใบเสร็จตัวจริงเพิ่มเติม, Audit Action: REVISION_REQUESTED
[P2.1-REAL-02] ✅ PASS - Creator can edit returned draft and successfully resubmit to pending_approval
       Details: Status: pending_approval, Description: Youth Camp Equipment (Updated), Amount: 5500.00
[P2.1-REAL-03] ✅ PASS - reject_transaction_terminal transitions pending_approval -> rejected with TRANSACTION_REJECTED audit
       Details: Status: rejected, Reason: งบประมาณเยาวชนไม่เพียงพอ ไม่อนุมัติโครงการ, Audit Action: TRANSACTION_REJECTED
[P2.1-REAL-04] ✅ PASS - Direct SQL UPDATE on rejected transaction is strictly blocked by trigger
       Details: Trigger Exception: Immutable Ledger raised as expected
[P2.1-REAL-05] ✅ PASS - submit_transaction on rejected transaction is strictly blocked
       Details: RPC Exception: Invalid State Transition raised as expected
[P2.1-REAL-06] ✅ PASS - approve_transaction on rejected transaction is strictly blocked
       Details: RPC Exception: Invalid State Transition raised as expected
[P2.1-REAL-07] ✅ PASS - post_transaction on rejected transaction is strictly blocked
       Details: RPC Exception: Invalid State Transition raised as expected
[P2.1-REAL-08] ✅ PASS - request_transaction_revision on rejected transaction is strictly blocked
       Details: RPC Exception: Invalid State Transition raised as expected
[P2.1-REAL-09] ✅ PASS - reject_transaction_terminal on already rejected transaction is strictly blocked
       Details: RPC Exception: Invalid State Transition raised as expected
[P2.1-REAL-10] ✅ PASS - Complete audit history preserved across multiple revisions & terminal rejection
       Details: Audit Actions: INSERT -> UPDATE -> SUBMIT_FOR_APPROVAL -> UPDATE -> REVISION_REQUESTED -> UPDATE -> SUBMIT_FOR_APPROVAL -> UPDATE -> REVISION_REQUESTED -> UPDATE -> SUBMIT_FOR_APPROVAL -> UPDATE -> TRANSACTION_REJECTED (Revisions: 2, Submissions: 3, Rejects: 1)
[P2.1-REAL-11] ✅ PASS - void_transaction on rejected transaction is strictly blocked (only posted vouchers can be voided)
       Details: RPC Exception: Only posted transactions can be voided raised as expected

================================================================================
TOTAL REAL DATABASE TESTS: 11/11 PASSED
================================================================================
🎉 ALL M2 PHASE 2.1 REAL POSTGRESQL GOVERNANCE TESTS PASSED SUCCESSFULLY!
```

---

## 4. Full Quality Gate Summary

| Check Suite | Target / Command | Result |
| :--- | :--- | :---: |
| **Real PostgreSQL 17 Suite** | `node scripts/m2_phase2_1_governance_semantics_test.mjs` | **11/11 PASS** |
| **Pure Unit Tests** | `npm test` (vitest) | **73/73 PASS** |
| **TypeScript Typecheck** | `npm run typecheck` (`tsc --noEmit`) | **0 ERRORS** |
| **Vite Build** | `npm run build` | **0 ERRORS** |

---

## 5. Condition Closure & Verdict

- **Phase 2 Condition**: **CLOSED & FULLY SATISFIED**
- **Governance Semantics**: Decoupled and strictly enforced.
- **Audit Immutability**: All revision notes and terminal rejection justifications are preserved in the permanent append-only audit trail.
- **Terminal State Security**: `rejected` transactions are permanently locked at the database trigger layer against modification, resubmission, approval, posting, revision, and voiding.

**M2 Phase 2.1 is COMPLETE. Ready for next instructions.**

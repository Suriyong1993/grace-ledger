# Milestone 3 — Real Database Integration Test Report
**Sunday Offering & Cash Count (PostgreSQL 17 / Supabase Test Database)**

**Date:** 2026-08-19  
**Target Database:** Supabase PostgreSQL 17 (`grace-ledger-test`)  
**Runner:** `scripts/m3_offering_integration_test.mjs`  
**Execution Environment:** Node.js v20.x, Supabase CLI v2.109.1, Native PostgreSQL 17 PL/pgSQL Engine  
**Evidence Type:** Real Supabase Database Execution (No `pg-mem`, No Mocking)  
**M3 REAL DATABASE STATUS:** 🟢 **PASS**

---

## 1. Environment & Test Fixtures

The test suite executes against the real, live Supabase PostgreSQL 17 test database with isolated multi-tenant fixtures:

- **Tenants Created:**
  - `M3 Test Church A` (`church_id = v_church_a`)
  - `M3 Test Church B` (`church_id = v_church_b`)
- **Church A Users & RBAC:**
  - `Treasurer Alice` (`user_role = 'treasurer'`)
  - `Staff Bob` (`user_role = 'finance_staff'`)
  - `Counter Charlie` (`user_role = 'counter'`)
  - `Counter Diana` (`user_role = 'counter'`)
  - `Member Eve` (`user_role = 'member'`)
- **Church B Users & RBAC:**
  - `Treasurer Bob B` (`user_role = 'treasurer'`)
- **Custody Accounts (Asset):**
  - Church A Cash Drawer (`type = 'cash_drawer'`, account `1010-A`, Initial Balance: ฿5,000.00)
  - Church A Kasikorn Bank (`type = 'bank'`, account `1020-A`, Initial Balance: ฿100,000.00)
  - Church B Cash Drawer (`type = 'cash_drawer'`, account `1010-B`, Initial Balance: ฿1,000.00)
- **Funds (Equity/Fund):**
  - General Fund A (Initial Balance: ฿50,000.00)
  - Mission Fund A (Initial Balance: ฿10,000.00)
  - General Fund B (Initial Balance: ฿20,000.00)
- **Categories:**
  - Tithes & Offerings (direction = `income`, default fund = General Fund A)
  - Mission Giving (direction = `income`, default fund = Mission Fund A)

---

## 2. Comprehensive Test Groups & Results (11/11 PASS)

| Test Group | Purpose & Scope | Key Invariants Verified | Result |
|---|---|---|---|
| **TEST GROUP 1** | **Happy Path Execution** | Complete flow: `draft` $\rightarrow$ `counting` $\rightarrow$ `counted` $\rightarrow$ `confirmed` $\rightarrow$ `posted`. Verified Expected Cash ฿10,000, Bank Transfer ฿3,000, QR ฿5,450 (Total ฿18,450). Cash Drawer +฿10,000, Bank Account +฿8,450. General Fund +฿13,000, Mission Fund +฿5,450. | 🟢 **PASS** |
| **TEST GROUP 2** | **Variance Flow & Explanation** | Expected Cash = ฿10,000, Physical Count = ฿9,950 (Variance = -฿50). Confirmation blocked until variance resolved. Recount $\rightarrow$ Explain ($\ge 5$ chars) $\rightarrow$ Confirm $\rightarrow$ Post. Exact ฿9,950 credited to Cash Drawer & Fund. | 🟢 **PASS** |
| **TEST GROUP 3** | **Expected Revision Trail** | Typo in expected envelope register (฿8,000 $\rightarrow$ ฿10,000). Revision appended to immutable `offering_session_revisions` table. Mandatory reason enforced ($< 5$ chars rejected). Actor & timestamp recorded. | 🟢 **PASS** |
| **TEST GROUP 4** | **Dual Counter Invariants** | `counter1 == counter2` attempted in `start_cash_count` and `record_cash_count` $\rightarrow$ Denied with `DUAL_COUNTER_VIOLATION`. | 🟢 **PASS** |
| **TEST GROUP 5** | **State Machine Integrity** | Illegal transitions denied by trigger: `draft -> confirmed`, `draft -> posted`, `counting -> posted`, `confirmed -> counting`, `posted -> draft`. | 🟢 **PASS** |
| **TEST GROUP 6** | **RLS & Multi-Tenant Isolation** | Church A Treasurer attempting to confirm or post Church B offering session $\rightarrow$ Denied with `FORBIDDEN`. Cross-tenant data isolation verified. | 🟢 **PASS** |
| **TEST GROUP 7** | **Posting Idempotency** | `post_offering_to_ledger` called 3 consecutive times on the same session $\rightarrow$ Exactly 1 financial transaction, 0 duplicate credit, identical balances, `already_posted = true` returned. | 🟢 **PASS** |
| **TEST GROUP 8** | **Concurrency & Row Locking** | Verified `SELECT ... FOR UPDATE` row locking prevents race conditions and balance drift. | 🟢 **PASS** |
| **TEST GROUP 9** | **Failure Recovery & Atomicity** | Posting called with invalid/cross-church custody account $\rightarrow$ Transaction aborted atomically, 0 partial mutations, session left in unposted valid state. | 🟢 **PASS** |
| **TEST GROUP 10** | **Financial Reconciliation** | Verified across all posted sessions: `SUM(transaction_splits.amount) == transaction.amount`, Total Account Increase == Total Fund Increase, 0.00 discrepancy. | 🟢 **PASS** |
| **TEST GROUP 11** | **Audit Trail Integrity** | Verified audit logs recorded for all events: `SESSION_CREATED`, `CASH_COUNT_STARTED`, `SESSION_COUNTED`, `EXPECTED_REVISED`, `VARIANCE_RESOLVED`, `SESSION_CONFIRMED`, `OFFERING_POSTED`. | 🟢 **PASS** |

---

## 3. Financial Evidence

### Happy Path Deposit & Fund Attribution (Test Group 1)
- **Input Channels:**
  - Envelope Cash: ฿10,000.00 $\rightarrow$ General Fund
  - Bank Transfer: ฿3,000.00 $\rightarrow$ General Fund
  - QR PromptPay: ฿5,450.00 $\rightarrow$ Mission Fund
- **Actual Movements Verified in Live Database:**
  - Cash Drawer (1010-A): `฿5,000.00` $\rightarrow$ `฿15,000.00` (**+฿10,000.00**) ✅
  - Kasikorn Bank (1020-A): `฿100,000.00` $\rightarrow$ `฿108,450.00` (**+฿8,450.00**) ✅
  - General Fund A: `฿50,000.00` $\rightarrow$ `฿63,000.00` (**+฿13,000.00**) ✅
  - Mission Fund A: `฿10,000.00` $\rightarrow$ `฿15,450.00` (**+฿5,450.00**) ✅
  - Total Financial Transaction Created: `฿18,450.00` (`status = 'posted'`, `direction = 'income'`) ✅
  - Total Splits Sum: `฿18,450.00` across 3 tagged splits (`[CASH]`, `[BANK_TRANSFER]`, `[QR_CODE]`) ✅

---

## 4. Idempotency & Concurrency Evidence (Test Group 7 & 8)

```text
First Post Call:
  - Result: { "transaction_id": "...", "status": "posted", "already_posted": false }
  - Account Balances: Cash Drawer = ฿9,000.00 (+฿4,000.00), Fund = ฿54,000.00 (+฿4,000.00)

Second Post Call (Duplicate):
  - Result: { "transaction_id": "...", "status": "posted", "already_posted": true }
  - Account Balances: Cash Drawer = ฿9,000.00 (Delta = ฿0.00), Fund = ฿54,000.00 (Delta = ฿0.00)

Third Post Call (Triplicate):
  - Result: { "transaction_id": "...", "status": "posted", "already_posted": true }
  - Account Balances: Cash Drawer = ฿9,000.00 (Delta = ฿0.00), Fund = ฿54,000.00 (Delta = ฿0.00)
```

---

## 5. Audit Trail Evidence (Test Group 11)

Audit logs verified in `audit_logs` table for all offering operations:
1. `SESSION_CREATED`: Recorded by `Staff Bob` with initial channel breakdown metadata.
2. `CASH_COUNT_STARTED`: Recorded by `Counter Charlie` with `Counter Diana` as co-counter.
3. `SESSION_COUNTED`: Recorded with denomination breakdown (bills & coins) and variance status.
4. `VARIANCE_RECOUNT_REQUESTED` & `VARIANCE_RESOLVED`: Recorded with explanation text and previous variance amount.
5. `EXPECTED_REVISED`: Recorded with previous/new amounts, revision number, and reason.
6. `SESSION_CONFIRMED`: Recorded by `Treasurer Alice` upon final verification.
7. `OFFERING_POSTED`: Recorded by `Treasurer Alice` with created `transaction_id`, account breakdown, and split count.

---

## 6. M3 Real Database Status

```text
===============================================================================
M3 REAL DATABASE STATUS: PASS (11/11 Test Groups Verified on PostgreSQL 17)
===============================================================================
```

- **Frontend/UI Implementation:** NOT started (On hold as requested).
- **Milestone Complete:** NOT declared complete (Pending TypeScript Domain Engine & Browser E2E).

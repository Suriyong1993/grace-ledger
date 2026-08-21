# M3 Implementation Plan (Revision 2)
## Sunday Offering & Cash Count Workflow (Physical Custody Chain)
**Grace Ledger: Church Financial Management System**  
**Date:** 2026-08-18  
**Status:** 📋 **REVISED IMPLEMENTATION PLAN (AWAITING PRODUCT OWNER APPROVAL)**

---

## 1. Existing Schema Impact & Safe Evolution Strategy

We audited the live Supabase PostgreSQL 17 schema. Rather than recreating existing tables, Migration 007 will perform a **safe, additive schema evolution**:

```text
┌─────────────────────────┬───────────────────────────────┬────────────────────────────────────────────────────────┐
│ Existing Table/Entity   │ Current Live Status           │ Safe Evolution & Additive Strategy                     │
├─────────────────────────┼───────────────────────────────┼────────────────────────────────────────────────────────┤
│ `offering_sessions`     │ ✅ Exists in Migration 001    │ 🛡️ Safe Evolution via ALTER TABLE:                    │
│                         │ (has basic expected_amount,   │ - ADD COLUMN IF NOT EXISTS expected_cash_amount        │
│                         │ counted_amount, variance)     │ - ADD COLUMN IF NOT EXISTS expected_transfer_amount    │
│                         │                               │ - ADD COLUMN IF NOT EXISTS expected_qr_amount          │
│                         │                               │ - ADD COLUMN IF NOT EXISTS expected_total_amount       │
│                         │                               │ - ADD COLUMN IF NOT EXISTS counted_cash_amount         │
│                         │                               │ - ADD COLUMN IF NOT EXISTS cash_variance_amount        │
│                         │                               │ - ADD COLUMN IF NOT EXISTS variance_status             │
│                         │                               │ - ADD COLUMN IF NOT EXISTS financial_transaction_id    │
│                         │                               │ - ADD COLUMN IF NOT EXISTS posted_at, posted_by        │
│                         │                               │ - Backfill existing test rows cleanly                  │
│                         │                               │ - ADD CONSTRAINT uq_offering_session_service           │
├─────────────────────────┼───────────────────────────────┼────────────────────────────────────────────────────────┤
│ `offering_session_items`│ ❌ Does not exist             │ 🆕 New Table:                                          │
│                         │                               │ Records breakdown per category, fund, channel, and     │
│                         │                               │ source (envelopes, bags, manual, electronic).          │
├─────────────────────────┼───────────────────────────────┼────────────────────────────────────────────────────────┤
│ `offering_cash_counts`  │ ❌ Does not exist             │ 🆕 New Table:                                          │
│                         │                               │ Physical bill count (1000, 500, 100, 50, 20) + coins,  │
│                         │                               │ timestamps, and dual counter signatures.               │
├─────────────────────────┼───────────────────────────────┼────────────────────────────────────────────────────────┤
│ `offering_session_`     │ ❌ Does not exist             │ 🆕 New Table:                                          │
│ `revisions`             │                               │ Immutable history of expected amount corrections with  │
│                         │                               │ reason, previous/new amounts, and author.              │
├─────────────────────────┼───────────────────────────────┼────────────────────────────────────────────────────────┤
│ `transactions` &        │ ✅ Production-Ready           │ 🔄 Reused:                                             │
│ `transaction_splits`    │ (Migrations 001, 005, 006)    │ Finalized offering generates an `income` transaction   │
│                         │                               │ with splits mapped to destination funds and posted to  │
│                         │                               │ `accounts` (cash_drawer / bank).                       │
├─────────────────────────┼───────────────────────────────┼────────────────────────────────────────────────────────┤
│ `accounts`              │ ✅ Has `cash_drawer` & `bank` │ 🔄 Reused:                                             │
│                         │                               │ Sunday cash lands in account_type = 'cash_drawer'.      │
├─────────────────────────┼───────────────────────────────┼────────────────────────────────────────────────────────┤
│ `audit_logs`            │ ✅ Production-Ready (M003)    │ 🔄 Reused:                                             │
│                         │                               │ Offering sessions automatically trigger audit logs.    │
└─────────────────────────┴───────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

## 2. Domain Model & Entities

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              OFFERING DOMAIN AGGREGATE ROOT                            │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ OfferingSession                                                                        │
│   ├── id: UUID                                                                         │
│   ├── church_id: UUID                                                                  │
│   ├── service_date: string (YYYY-MM-DD)                                                │
│   ├── service_name: string ("รอบนมัสการวันอาทิตย์ (เช้า)", "รอบค่ำ", etc.)            │
│   ├── status: OfferingSessionStatus ('draft' | 'counting' | 'counted' |                │
│   │                                  'variance_review' | 'confirmed' | 'posted')       │
│   ├── expected_cash_amount: Money                                                      │
│   ├── expected_transfer_amount: Money                                                  │
│   ├── expected_qr_amount: Money                                                        │
│   ├── expected_total_amount: Money                                                     │
│   ├── counted_cash_amount: Money                                                       │
│   ├── cash_variance_amount: Money (counted_cash - expected_cash)                       │
│   ├── variance_status: VarianceStatus ('zero_match' | 'variance_detected' |            │
│   │                                    'recounted' | 'explained' | 'acknowledged')     │
│   ├── variance_reason: string | null                                                   │
│   ├── counter1_id: UUID | null (Profile ID)                                            │
│   ├── counter2_id: UUID | null (Profile ID)                                            │
│   ├── counter1_signed_at: string | null                                                │
│   ├── counter2_signed_at: string | null                                                │
│   ├── financial_transaction_id: UUID | null                                            │
│   ├── posted_at: string | null                                                         │
│   ├── posted_by: UUID | null                                                           │
│   │                                                                                    │
│   ├── items: OfferingSessionItem[]                                                     │
│   │     ├── id: UUID                                                                   │
│   │     ├── fund_id: UUID (General Fund, Building Fund, Mission Fund, etc.)            │
│   │     ├── category_id: UUID (Tithe, General Offering, Mission Offering, etc.)        │
│   │     ├── payment_channel: 'cash' | 'bank_transfer' | 'qr_code' | 'other'            │
│   │     ├── source_type: 'envelopes' | 'bags' | 'manual_aggregate' | 'electronic_slip' │
│   │     ├── amount: Money                                                              │
│   │     └── notes: string | null                                                       │
│   │                                                                                    │
│   ├── cash_count: OfferingCashCount | null                                             │
│   │     ├── bill_1000: number                                                          │
│   │     ├── bill_500: number                                                           │
│   │     ├── bill_100: number                                                           │
│   │     ├── bill_50: number                                                            │
│   │     ├── bill_20: number                                                            │
│   │     ├── coins_amount: Money                                                        │
│   │     ├── total_cash_counted: Money                                                  │
│   │     ├── counted_by_1: UUID                                                         │
│   │     ├── counted_by_2: UUID                                                         │
│   │     └── counted_at: string                                                         │
│   │                                                                                    │
│   └── revisions: OfferingSessionRevision[]                                             │
│         ├── revision_number: number                                                    │
│         ├── previous_cash_amount: Money                                                │
│         ├── new_cash_amount: Money                                                     │
│         ├── previous_total_amount: Money                                               │
│         ├── new_total_amount: Money                                                    │
│         ├── revision_reason: string (Mandatory >= 5 chars)                             │
│         ├── revised_by: UUID                                                           │
│         └── created_at: string                                                         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. State Machine & Database Invariant Enforcement

```text
                                  ┌───────────┐
                                  │   DRAFT   │
                                  └─────┬─────┘
                                        │ submit_offering_for_counting()
                                        ▼
                                  ┌───────────┐
                                  │ COUNTING  │
                                  └─────┬─────┘
                                        │ record_cash_count()
                                        ▼
                                  ┌───────────┐
                                  │  COUNTED  │
                                  └─────┬─────┘
                                        │
                   ┌────────────────────┴────────────────────┐
                   │                                         │
                   ▼ (cash_variance == 0)                    ▼ (cash_variance != 0)
             ┌───────────┐                             ┌─────────────────┐
             │  MATCHED  │                             │ VARIANCE_REVIEW │
             └─────┬─────┘                             └────────┬────────┘
                   │                                            │
                   │                             ┌──────────────┴──────────────┐
                   │                             ▼ recount                     ▼ explain
                   │                        [ COUNTING ]           [ EXPLAINED & ACKNOWLEDGED ]
                   │                                                           │
                   └─────────────────────────────┬─────────────────────────────┘
                                                 ▼ confirm_offering_session()
                                          ┌─────────────┐
                                          │  CONFIRMED  │ (Dual Sign-off Locked)
                                          └──────┬──────┘
                                                 │ post_offering_to_ledger()
                                                 ▼
                                          ┌─────────────┐
                                          │   POSTED    │ (General Ledger Entry)
                                          └─────────────┘
```

### Database Invariants Enforced in PostgreSQL (Trigger / RPC Guard)

1. **Direct Confirmation Restriction:**
   - If `cash_variance_amount = 0`, status transition from `counted` $\rightarrow$ `confirmed` is permitted.
   - If `cash_variance_amount != 0`, transition from `counted` directly to `confirmed` is **strictly rejected** by PostgreSQL with error:
     ```text
     EXCEPTION 'CANNOT_CONFIRM_UNRESOLVED_VARIANCE: Cash variance of % must be resolved or explained before confirmation', NEW.cash_variance_amount;
     ```
2. **Variance Resolution Invariant:**
   - To confirm a session with `cash_variance_amount != 0`, `variance_status` must be `'explained'` or `'acknowledged'`, and `variance_reason` must be non-null and $\ge 5$ characters.

---

## 4. Channel $\times$ Fund Model & General Ledger Mapping

### 4.1 Concept
Financial transactions in church accounting require knowing both **which Fund receives the money** and **which physical/custody Account holds the asset**.

```text
Example Breakdown:
┌────────────────────┬──────────┬──────────────┬─────────────────┐
│ Category           │ Channel  │ Fund         │ Amount          │
├────────────────────┼──────────┼──────────────┼─────────────────┤
│ ถวายทรัพย์ทั่วไป   │ Cash     │ General Fund │ ฿6,000.00       │
│ พันธกิจมิชชั่น     │ Cash     │ Mission Fund │ ฿4,000.00       │
│ ถวายทรัพย์ทั่วไป   │ QR Code  │ General Fund │ ฿2,000.00       │
│ พันธกิจมิชชั่น     │ Transfer │ Mission Fund │ ฿3,000.00       │
└────────────────────┴──────────┴──────────────┴─────────────────┘
Total Giving: ฿15,000.00
  ├── Expected Cash:       ฿10,000.00 (Lands in Cash Drawer / Safe)
  └── Expected Electronic: ฿5,000.00 (Lands in Bank Account)
```

### 4.2 Posting Rules to General Ledger
When `post_offering_to_ledger` executes:
1. Creates an `income` Transaction in `transactions`.
2. Creates 4 `transaction_splits` matching each item:
   - Split 1: `fund_id` = General, `amount` = 6,000, `notes` = `[Cash] ถวายทรัพย์ทั่วไป`
   - Split 2: `fund_id` = Mission, `amount` = 4,000, `notes` = `[Cash] พันธกิจมิชชั่น`
   - Split 3: `fund_id` = General, `amount` = 2,000, `notes` = `[QR] ถวายทรัพย์ทั่วไป`
   - Split 4: `fund_id` = Mission, `amount` = 3,000, `notes` = `[Transfer] พันธกิจมิชชั่น`
3. Updates `accounts` balances:
   - `Cash Drawer` balance $\mathrel{+}= \text{counted\_cash\_amount}$ (฿10,000.00)
   - `Bank Account` balance $\mathrel{+}= (\text{expected\_transfer} + \text{expected\_qr})$ (฿5,000.00)
4. Updates `funds` balances:
   - `General Fund` balance $\mathrel{+}= 8,000.00$
   - `Mission Fund` balance $\mathrel{+}= 7,000.00$

---

## 5. Posting Idempotency & Concurrency Controls

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                          POSTING IDEMPOTENCY GUARANTEE                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Unique Invariant:                                                        │
│    UNIQUE INDEX idx_offering_financial_tx ON offering_sessions             │
│    (financial_transaction_id) WHERE financial_transaction_id IS NOT NULL;  │
│                                                                             │
│ 2. Row Locking in RPC:                                                      │
│    SELECT * FROM offering_sessions WHERE id = p_session_id FOR UPDATE;      │
│                                                                             │
│ 3. Idempotent Execution:                                                    │
│    IF v_session.status = 'posted' THEN                                      │
│      RETURN jsonb_build_object(                                             │
│        'session_id', v_session.id,                                          │
│        'transaction_id', v_session.financial_transaction_id,                │
│        'status', 'posted',                                                  │
│        'already_posted', true                                               │
│      );                                                                     │
│    END IF;                                                                  │
│                                                                             │
│ 4. Network Retry / Double-Click Safety:                                     │
│    Second call returns the existing transaction ID immediately with         │
│    zero double-credit to fund or account balances.                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. M3 Role & Permission Matrix

```text
┌─────────────────────────┬──────────────┬───────────────┬──────────────┬──────────────┬──────────────┐
│ Action / Operation      │ Super Admin  │ Treasurer     │ Finance Staff│ Pastor       │ Counter      │
├─────────────────────────┼──────────────┼───────────────┼──────────────┼──────────────┼──────────────┤
│ View Offering Sessions  │ ✅ Full      │ ✅ Full       │ ✅ Church    │ ✅ View Only │ ✅ Assigned  │
│ Create Draft Session    │ ✅ Full      │ ✅ Yes        │ ✅ Yes       │ ❌ No [PDR1] │ ❌ No        │
│ Edit Draft Items        │ ✅ Full      │ ✅ Yes        │ ✅ Yes       │ ❌ No        │ ❌ No        │
│ Submit to Counting      │ ✅ Full      │ ✅ Yes        │ ✅ Yes       │ ❌ No        │ ❌ No        │
│ Record Cash Count       │ ✅ Full      │ ✅ If Counter │ ✅ If Counter│ ❌ No        │ ✅ Assigned  │
│ Recount Denominations   │ ✅ Full      │ ✅ If Counter │ ✅ If Counter│ ❌ No        │ ✅ Assigned  │
│ Explain Variance        │ ✅ Full      │ ✅ Yes        │ ✅ Yes       │ ❌ No        │ ✅ If Counter│
│ Revise Expected Amount  │ ✅ Full      │ ✅ With Reason│ ❌ No [PDR2] │ ❌ No        │ ❌ No        │
│ Dual Sign-off / Confirm │ ✅ Full      │ ✅ If Counter │ ✅ If Counter│ ❌ No        │ ✅ Assigned  │
│ Post to General Ledger  │ ✅ Full      │ ✅ Yes        │ ❌ No        │ ❌ No [PDR3] │ ❌ No        │
└─────────────────────────┴──────────────┴───────────────┴──────────────┴──────────────┴──────────────┘
```

### Explicit Product Decisions Required [PDR]
* `[PDR1]`: Can a Pastor create a draft offering session? **Default: No** (Segregation of Duties).
* `[PDR2]`: Can regular Finance Staff revise an expected amount after counting has begun? **Default: No, Treasurer only** (Prevents unauthorized alteration of expected records).
* `[PDR3]`: Can a Pastor post an offering session to the general ledger? **Default: No, Treasurer only** (Maintains strict financial posting governance).

---

## 7. Frontend UI Integration (React + Vite + AppShell)

No new UI frameworks will be introduced. M3 builds on the proven **Vite + React + TypeScript** architecture:

```text
AppShell (src/components/layout/AppShell.ts)
  │
  ├── Route: "/offerings" ──► OfferingListPage
  │
  ├── Route: "/offerings/new" ──► OfferingEntryPage (Screen 04)
  │     └── Modal Sheet: OfferingReviewSheet (Screen 05)
  │
  ├── Route: "/offerings/:id/count" ──► CashCountPage (Screen 06)
  │     └── Modal: VarianceHandlerModal (Screen 07)
  │
  └── Route: "/offerings/:id/summary" ──► OfferingSummaryPage (Screen 06 confirmed/posted view)
```

### Component Breakdown
1. **`OfferingEntryPage` (Screen 04):**
   - Category table with Fund selector and Channel selector (Cash, Transfer, QR).
   - Real-time Channel Subtotals card (`Expected Cash: ฿10,000.00`, `Grand Total: ฿18,450.00`).
   - Action: "ต่อไป · ตรวจทาน".
2. **`OfferingReviewSheet` (Screen 05):**
   - Bottom sheet displaying breakdown by Fund and Channel.
   - Creator audit stamp (*"บันทึกโดย คุณสมชาย"*).
   - Action: "ยืนยันและส่งไปนับเงิน".
3. **`CashCountPage` (Screen 06):**
   - Denomination steppers: 1000, 500, 100, 50, 20 + coins.
   - Comparison card: Expected Cash vs Counted Cash vs Variance.
   - Dual Counter picker with badges and signature status.
   - Action: "ยืนยันการนับเงิน".
4. **`VarianceHandlerModal` (Screen 07):**
   - Warning card with difference amount (`−฿200.00`).
   - Actions: 1) Recount, 2) Explain Variance, 3) Request Expected Revision.

---

## 8. Implementation Phases

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            M3 IMPLEMENTATION PHASES                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ Phase 1: Database & RPCs (PostgreSQL 17 / Supabase)                         │
│   - Remote Placeholder: 20260818165549_placeholder.sql                      │
│   - Migration 010: Core Schema Evolution Repair & Child Tables              │
│   - Migration 011: 7 Business RPCs & Invariant Triggers                     │
│   - Migration 012: Row Level Security Policies                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ Phase 2: Domain Engine & Service Layer (TypeScript)                         │
│   - Pure Denomination Calculator & Channel Engine (`denomination-calc.ts`) │
│   - `OfferingService` PostgREST and RPC client orchestration                │
├─────────────────────────────────────────────────────────────────────────────┤
│ Phase 3: React UI Integration (Screens 04, 05, 06, 07)                      │
│   - OfferingEntryPage, OfferingReviewSheet, CashCountPage, VarianceModal    │
│   - Integration with AppShell and Router                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ Phase 4: Real PostgreSQL 17 Integration Verification                        │
│   - `scripts/m3_offering_integration_test.mjs` (All RPCs & Constraints)     │
├─────────────────────────────────────────────────────────────────────────────┤
│ Phase 5: Chromium Browser E2E & UX Verification                             │
│   - `scripts/m3_offering_browser_e2e.mjs` (Screens 04→05→06→07→Post)       │
│   - Mobile viewport check (390px) + Secret scan                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Definition of Done (18-Point Checklist)

- [ ] **1. Safe Evolution:** `offering_sessions` evolved cleanly via Migration 007 without data loss.
- [ ] **2. Child Tables:** `offering_session_items`, `offering_cash_counts`, `offering_session_revisions` created.
- [ ] **3. Channel Separation:** `expected_cash_amount` separated from `expected_transfer_amount` and `expected_qr_amount`.
- [ ] **4. Cash Comparison:** Cash count denomination total compares only against `expected_cash_amount`.
- [ ] **5. Dual Counter Invariant:** `counter1_id != counter2_id` enforced in DB constraint and RPCs.
- [ ] **6. Counter Timestamps:** `counter1_signed_at` and `counter2_signed_at` captured explicitly.
- [ ] **7. Variance State Enforcement:** DB blocks transition from `counted` to `confirmed` if variance is non-zero without explanation.
- [ ] **8. Mandatory Explanation:** Non-zero variance requires explanation ($\ge 5$ characters).
- [ ] **9. Immutable Revisions:** Expected revisions recorded in `offering_session_revisions` with reason and author.
- [ ] **10. Duplicate Prevention:** Unique key `(church_id, service_date, service_name)` prevents duplicate sessions.
- [ ] **11. Confirmed vs Posted:** Clear state separation between count confirmation and ledger posting.
- [ ] **12. Idempotent Posting:** Multiple post calls for the same session return the existing transaction ID without double entries.
- [ ] **13. Channel $\times$ Fund Splits:** General Ledger splits preserve Fund allocation and Channel metadata.
- [ ] **14. Cash Drawer Custody:** Physical cash posts to `Cash Drawer` account.
- [ ] **15. Pure Domain Engine:** Denomination calculator with 100% unit test coverage.
- [ ] **16. Real PostgreSQL 17 Tests:** All RPCs, constraints, and edge cases pass on live PostgreSQL.
- [ ] **17. React UI & AppShell:** Screens 04, 05, 06, 07 integrated inside React AppShell.
- [ ] **18. Real Chromium Browser E2E:** 4-screen flow verified in Playwright E2E test on 390px viewport.

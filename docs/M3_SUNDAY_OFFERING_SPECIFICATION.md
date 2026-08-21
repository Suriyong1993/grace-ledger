# M3 Implementation Specification
## Sunday Offering & Cash Count Workflow
**Grace Ledger: Church Financial Management System**  
**Date:** 2026-08-18  
**Status:** 📋 **LOCKED SPECIFICATION (READY FOR IMPLEMENTATION PLAN)**

---

## 1. Executive Summary & Architectural Overview

Milestone 3 implements the **Sunday Offering & Cash Count Workflow**, establishing an immutable **Chain of Custody** for church physical cash and electronic collections from worship services.

```text
DATABASE → DOMAIN ENGINE → RPC / ATOMIC TRANSACTIONS → SERVICE LAYER → UI COMPONENTS → BROWSER E2E
```

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               OFFERING SESSION AGGREGATE ROOT                          │
├─────────────────────────────────────────────┬──────────────────────────────────────────┤
│ 1. Offering Session Identity                │ 2. Expected Amount by Channel            │
│    - church_id                              │    - offering_session_items              │
│    - service_date                           │    - expected_cash_amount (เงินสด)       │
│    - service_name (Morning / Evening)       │    - expected_transfer_amount (เงินโอน)  │
│    - created_by                             │    - expected_qr_amount (คิวอาร์)        │
│    - status: draft → counting → confirmed   │    - expected_total_amount (ยอดรวม)      │
├─────────────────────────────────────────────┼──────────────────────────────────────────┤
│ 3. Physical Cash Count (Dual Custody)       │ 4. Variance Engine & Governance          │
│    - counter1_id & counter2_id              │    - cash_variance = actual_cash -       │
│    - counter1_signed_at & counter2_signed_at│                      expected_cash       │
│    - denominations (1000, 500, 100, 50, 20) │    - lifecycle: match | recount | explain│
│    - coins_amount                           │    - variance_reason (mandatory if != 0) │
│    - actual_cash_amount (ยอดเงินสดจริง)     │    - immutable revision tracking         │
├─────────────────────────────────────────────┴──────────────────────────────────────────┤
│ 5. Distinct State Lifecycle: Confirmed vs Posted                                       │
│    - Confirmed: 2 Counters & Treasurer dual sign-off, Session is locked & immutable   │
│    - Posted: Financial Transaction created and posted to General Ledger                │
│    - Cash posted to Cash Drawer (ตู้เซฟ/เงินสดในมือ) | Bank posted to Bank Account      │
│    - Monday Bank Deposit handled as Transfer (Cash Drawer → Bank Account)              │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Database Schema Design (Migration 007)

### 2.1 Table Structure

```sql
-- 1. Offering Sessions Table (Aggregate Root)
CREATE TABLE IF NOT EXISTS offering_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  service_date DATE NOT NULL,
  service_name TEXT NOT NULL DEFAULT 'รอบนมัสการวันอาทิตย์ (เช้า)',
  
  -- Channel-Separated Expected Amounts
  expected_cash_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (expected_cash_amount >= 0),
  expected_transfer_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (expected_transfer_amount >= 0),
  expected_qr_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (expected_qr_amount >= 0),
  expected_total_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (expected_total_amount >= 0),
  
  -- Physical Cash Count Results
  counted_cash_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (counted_cash_amount >= 0),
  cash_variance_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  
  -- Distinct Status Lifecycle
  status offering_session_status_enum NOT NULL DEFAULT 'draft',
  
  -- Dual Counter Information
  counter1_id UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  counter2_id UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  counter1_signed_at TIMESTAMPTZ,
  counter2_signed_at TIMESTAMPTZ,
  
  -- Variance Governance
  variance_status TEXT NOT NULL DEFAULT 'zero_match' 
    CHECK (variance_status IN ('zero_match', 'variance_detected', 'recounted', 'explained', 'acknowledged')),
  variance_reason TEXT,
  
  -- Linked Ledger Transaction (Populated when status = 'posted')
  financial_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  posted_at TIMESTAMPTZ,
  posted_by UUID REFERENCES profiles(id) ON DELETE RESTRICT,
  
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Invariants
  CONSTRAINT uq_offering_session_service UNIQUE (church_id, service_date, service_name),
  CONSTRAINT chk_counters_different CHECK (counter1_id IS NULL OR counter2_id IS NULL OR counter1_id <> counter2_id)
);

-- 2. Offering Session Items (Breakdown by Category, Fund, and Channel)
CREATE TABLE IF NOT EXISTS offering_session_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_session_id UUID NOT NULL REFERENCES offering_sessions(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  fund_id UUID NOT NULL REFERENCES funds(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  payment_channel TEXT NOT NULL DEFAULT 'cash' CHECK (payment_channel IN ('cash', 'bank_transfer', 'qr_code', 'other')),
  source_type TEXT NOT NULL DEFAULT 'envelopes' CHECK (source_type IN ('envelopes', 'bags', 'manual_aggregate', 'electronic_slip')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Offering Cash Denominations (Physical Bill & Coin Proof)
CREATE TABLE IF NOT EXISTS offering_cash_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_session_id UUID NOT NULL UNIQUE REFERENCES offering_sessions(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  bill_1000 INTEGER NOT NULL DEFAULT 0 CHECK (bill_1000 >= 0),
  bill_500 INTEGER NOT NULL DEFAULT 0 CHECK (bill_500 >= 0),
  bill_100 INTEGER NOT NULL DEFAULT 0 CHECK (bill_100 >= 0),
  bill_50 INTEGER NOT NULL DEFAULT 0 CHECK (bill_50 >= 0),
  bill_20 INTEGER NOT NULL DEFAULT 0 CHECK (bill_20 >= 0),
  coins_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (coins_amount >= 0),
  total_cash_counted NUMERIC(14,2) NOT NULL DEFAULT 0.00 CHECK (total_cash_counted >= 0),
  counted_by_1 UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  counted_by_2 UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  counted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_cash_count_counters_different CHECK (counted_by_1 <> counted_by_2)
);

-- 4. Offering Session Revisions (Immutable History of Expected Amount Changes)
CREATE TABLE IF NOT EXISTS offering_session_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_session_id UUID NOT NULL REFERENCES offering_sessions(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  revision_number INTEGER NOT NULL DEFAULT 1,
  previous_cash_amount NUMERIC(14,2) NOT NULL,
  new_cash_amount NUMERIC(14,2) NOT NULL,
  previous_total_amount NUMERIC(14,2) NOT NULL,
  new_total_amount NUMERIC(14,2) NOT NULL,
  revision_reason TEXT NOT NULL,
  revised_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 3. State Machine & Lifecycle Transitions

```text
                             ┌───────────┐
                             │   DRAFT   │ ◄── Envelopes & category entry
                             └─────┬─────┘
                                   │ submit_offering_for_counting()
                                   ▼
                             ┌───────────┐
                             │ COUNTING  │ ◄── 2 Counters counting physical cash
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
                                     │  CONFIRMED  │ (Dual sign-off complete, locked)
                                     └──────┬──────┘
                                            │ post_offering_to_ledger()
                                            ▼
                                     ┌─────────────┐
                                     │   POSTED    │ (Immutable General Ledger Record)
                                     └─────────────┘
```

---

## 4. PostgreSQL 17 RPC Contracts

### RPC 1: `create_offering_session`
Creates the session and its item breakdown atomically, computing channel totals automatically.
```sql
create_offering_session(
  p_service_date DATE,
  p_service_name TEXT,
  p_items JSONB, -- Array of { fund_id, category_id, payment_channel, source_type, amount, notes }
  p_notes TEXT DEFAULT NULL
) RETURNS UUID
```

### RPC 2: `revise_offering_expected_amount`
Revises expected category amounts before/during counting, persisting full revision history and reason.
```sql
revise_offering_expected_amount(
  p_session_id UUID,
  p_new_items JSONB,
  p_revision_reason TEXT
) RETURNS JSONB
```

### RPC 3: `record_cash_count`
Records physical cash count across denominations with dual-counter validation. Computes `cash_variance = counted_cash - expected_cash`.
```sql
record_cash_count(
  p_session_id UUID,
  p_counter1_id UUID,
  p_counter2_id UUID,
  p_bill_1000 INT,
  p_bill_500 INT,
  p_bill_100 INT,
  p_bill_50 INT,
  p_bill_20 INT,
  p_coins NUMERIC(14,2)
) RETURNS JSONB -- Returns { counted_cash, expected_cash, cash_variance, variance_status }
```

### RPC 4: `resolve_offering_variance`
Handles variance review when `cash_variance != 0`.
```sql
resolve_offering_variance(
  p_session_id UUID,
  p_action TEXT, -- 'recount' | 'explain'
  p_explanation TEXT DEFAULT NULL
) RETURNS JSONB
```

### RPC 5: `confirm_offering_session`
Locks the session with dual-counter and treasurer sign-off. Transitions status to `confirmed`.
```sql
confirm_offering_session(
  p_session_id UUID
) RETURNS JSONB
```

### RPC 6: `post_offering_to_ledger`
Creates the Financial Transaction in General Ledger. Allocates splits into destination funds under `Cash Drawer` (for cash) and `Bank Account` (for transfer/QR). Transitions status to `posted`.
```sql
post_offering_to_ledger(
  p_session_id UUID,
  p_cash_account_id UUID,
  p_bank_account_id UUID
) RETURNS JSONB -- Returns { session_id, transaction_id, status: 'posted' }
```

---

## 5. Domain Engine & Service Layer (TypeScript)

### 5.1 Types (`src/lib/offering/types.ts`)
* `OfferingSession`, `OfferingSessionItem`, `OfferingCashCount`, `OfferingDenominations`, `OfferingRevision`
* `VarianceStatus = 'zero_match' | 'variance_detected' | 'recounted' | 'explained' | 'acknowledged'`
* `OfferingSessionStatus = 'draft' | 'counting' | 'counted' | 'variance_review' | 'confirmed' | 'posted' | 'voided'`

### 5.2 Denomination Engine (`src/lib/offering/denomination-calculator.ts`)
* Pure domain calculation using `Money` arithmetic:
  $$\text{Counted Cash} = (1000 \times N_{1000}) + (500 \times N_{500}) + (100 \times N_{100}) + (50 \times N_{50}) + (20 \times N_{20}) + \text{Coins}$$
* Channel-aware variance:
  $$\text{Cash Variance} = \text{Counted Cash} - \text{Expected Cash}$$

### 5.3 Offering Service (`src/lib/offering/offering-service.ts`)
* Client-side service orchestrating PostgREST queries, RPC mutations, and error handling.

---

## 6. Frontend UI Workflow (Screens 04, 05, 06, 07)

1. **`OfferingEntryPage` (Screen 04):**
   - Category input rows: General, Tithe, Mission, Building, Youth.
   - Channel pill selector (Cash / Transfer / QR).
   - Real-time channel sum: Expected Cash vs Expected Total.
   - Action: "ต่อไป · ตรวจทาน".
2. **`OfferingReviewSheet` (Screen 05):**
   - Bottom sheet displaying summary per fund and breakdown by channel.
   - Creator audit stamp (*"บันทึกโดย คุณสมชาย"*).
   - Action: "ยืนยันและส่งไปนับเงิน".
3. **`CashCountPage` (Screen 06):**
   - Denomination steppers (1000, 500, 100, 50, 20 + coins).
   - Live comparison card: Expected Cash (`฿10,000.00`) vs Counted Cash (`฿10,000.00`) vs Variance (`฿0.00`).
   - Dual-counter selector & sign-off cards (Counter 1 & Counter 2).
   - Action: "ยืนยันการนับเงิน".
4. **`VarianceHandlerModal` (Screen 07):**
   - Variance banner (*"ยอดไม่ตรง: −฿200.00"*).
   - Action 1: นับใหม่อีกครั้ง (Recount).
   - Action 2: ระบุเหตุผลของผลต่าง (Explain Variance & Acknowledge).
   - Action 3: ขอแก้ยอดบันทึกเดิม (Revise Expected Amount with Audit).

---

## 7. Verification & Quality Gate Plan

| Suite | Scope | Target |
|:---|:---|:---:|
| **Vitest Unit Tests** | Denomination math, channel arithmetic, revision tracking | 100% Pass |
| **PostgreSQL 17 Integration Tests** | `scripts/m3_offering_integration_test.mjs` (RPCs, constraints, RLS, audit logs) | 100% Pass |
| **Chromium Browser E2E Tests** | `scripts/m3_offering_browser_e2e.mjs` (Complete 4-screen workflow + variance handling) | 100% Pass |
| **TypeScript Typecheck** | `tsc --noEmit` | 0 Errors |
| **Production Build** | `npm run build` | 0 Errors |

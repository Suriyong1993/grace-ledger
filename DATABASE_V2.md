# Grace Ledger v2 — Database Schema Design

**Version:** 2.0
**Date:** 22 July 2026
**Database:** PostgreSQL 16 (via Supabase)
**ORM:** Drizzle ORM

---

## Table of Contents

1. [Schema Design Principles](#1-schema-design-principles)
2. [Entity Relationship Diagram](#2-entity-relationship-diagram)
3. [Core Accounting Tables](#3-core-accounting-tables)
4. [Fund Accounting Tables](#4-fund-accounting-tables)
5. [Transaction Tables](#5-transaction-tables)
6. [Period & Reconciliation Tables](#6-period--reconciliation-tables)
7. [Budget Tables](#7-budget-tables)
8. [Member & Organization Tables](#8-member--organization-tables)
9. [Authentication & Authorization Tables](#9-authentication--authorization-tables)
10. [Audit Trail Tables](#10-audit-trail-tables)
11. [System Tables](#11-system-tables)
12. [Indexing Strategy](#12-indexing-strategy)
13. [Row-Level Security Policies](#13-row-level-security-policies)
14. [Migration Strategy](#14-migration-strategy)
15. [Data Retention Policy](#15-data-retention-policy)

---

## 1. Schema Design Principles

### 1.1 Financial Data Integrity

- **DECIMAL(18,2)** for all monetary values — never FLOAT, REAL, or DOUBLE PRECISION
- All monetary operations use PostgreSQL's arbitrary precision NUMERIC type
- CHECK constraints prevent negative amounts where semantically invalid
- FOREIGN KEY constraints on all relationships — no orphan records
- NOT NULL on all columns unless the field is explicitly optional

### 1.2 Immutability

- **Journal entries are immutable once posted** — no UPDATE allowed on journal_entry or journal_entry_line tables
- **Audit trail is append-only** — application-level INSERT only, no UPDATE/DELETE
- **Reconciliation records are immutable** — once a period is reconciled, the record is permanent
- Void operations create reversing entries rather than modifying originals

### 1.3 Temporal Data

- `created_at` TIMESTAMPTZ on all tables — server-generated, immutable
- `updated_at` TIMESTAMPTZ on mutable tables — auto-updated via trigger
- `posted_at` TIMESTAMPTZ for journal entries — the official posting timestamp
- `voided_at` TIMESTAMPTZ for voided transactions — when the void was executed

### 1.4 Concurrency Control

- `version` INTEGER column on all mutable tables for optimistic locking
- Application-level check: `UPDATE ... WHERE version = :expected_version`
- Database-level: SERIALIZABLE isolation level for financial transactions

### 1.5 Naming Conventions

- Tables: `snake_case`, plural (e.g., `chart_of_accounts`, `journal_entries`)
- Columns: `snake_case` (e.g., `account_code`, `fiscal_year`)
- Primary keys: `id` (UUID v7 — time-ordered)
- Foreign keys: `{table_singular}_id` (e.g., `fund_id`, `account_id`)
- Indexes: `idx_{table}_{column}` (e.g., `idx_journal_entries_posting_date`)

---

## 2. Entity Relationship Diagram

```
┌─────────────────────┐
│     users           │
│  id (PK)            │
│  name               │
│  role               │
│  password_hash      │
│  mfa_enabled        │
└──────┬──────────────┘
       │
       │ created_by / approved_by
       │
┌──────▼─────────────────────────────────────┐
│              journal_entries                │
│  id (PK)                                    │
│  entry_number (sequential, per-type)        │
│  entry_type (offering/expense/income/       │
│              transfer/opening/adjustment)    │
│  posting_date                               │
│  description                                │
│  status (draft/pending/approved/rejected/   │
│          voided)                             │
│  created_by → users.id                      │
│  approved_by → users.id                     │
│  rejection_reason                           │
│  void_parent_id → journal_entries.id        │
│  fund_id → funds.id                         │
│  reference_document                         │
│  total_debit  DECIMAL(18,2)                 │
│  total_credit DECIMAL(18,2)                 │
│  fiscal_year  INTEGER                       │
│  fiscal_period INTEGER (1-12)               │
│  version      INTEGER                       │
│  created_at   TIMESTAMPTZ                   │
│  posted_at    TIMESTAMPTZ                   │
│  updated_at   TIMESTAMPTZ                   │
└──────┬─────────────────────────────────────┘
       │
       │ 1:N
       │
┌──────▼─────────────────────────────────────┐
│          journal_entry_lines                │
│  id (PK)                                    │
│  journal_entry_id → journal_entries.id      │
│  account_id → chart_of_accounts.id          │
│  line_type (debit | credit)                 │
│  amount DECIMAL(18,2)                       │
│  fund_id → funds.id                         │
│  member_id → members.id (nullable)          │
│  department_id → departments.id (nullable)  │
│  project_id → projects.id (nullable)        │
│  description                                │
│  created_at   TIMESTAMPTZ                   │
└──────┬─────────────────────────────────────┘
       │
       │ references
       │
┌──────▼─────────────────────────────────────┐
│          chart_of_accounts                  │
│  id (PK)                                    │
│  account_code  VARCHAR(20) UNIQUE           │
│  account_name  VARCHAR(255)                 │
│  account_type  (asset/liability/equity/     │
│                 income/expense)              │
│  parent_id → chart_of_accounts.id           │
│  is_active     BOOLEAN                      │
│  is_contra     BOOLEAN                      │
│  normal_balance (debit | credit)            │
│  description   TEXT                         │
│  sort_order    INTEGER                      │
│  tfrs_code     VARCHAR(20)                  │
│  created_at    TIMESTAMPTZ                  │
│  updated_at    TIMESTAMPTZ                  │
│  version       INTEGER                      │
└─────────────────────────────────────────────┘

┌─────────────────────┐
│  general_ledger     │
│  id (PK)            │
│  account_id → COA   │
│  posting_date       │
│  journal_entry_id → journal_entries.id     │
│  journal_line_id → journal_entry_lines.id  │
│  fund_id → funds.id │
│  debit_amount       │
│  credit_amount      │
│  running_balance    │
│  fiscal_year        │
│  fiscal_period      │
│  created_at         │
│  UNIQUE(journal_line_id)                   │
└─────────────────────┘

┌───────────────────────────────────────────┐
│                 funds                      │
│  id (PK)                                   │
│  account_id → chart_of_accounts.id         │
│  fund_code      VARCHAR(20) UNIQUE         │
│  name           VARCHAR(255)               │
│  description    TEXT                       │
│  is_active      BOOLEAN                    │
│  is_restricted  BOOLEAN                    │
│  opening_balance DECIMAL(18,2)             │
│  current_balance DECIMAL(18,2)             │
│  last_calculated_at TIMESTAMPTZ            │
│  created_at     TIMESTAMPTZ                │
│  updated_at     TIMESTAMPTZ                │
│  version        INTEGER                    │
└───────────────────────────────────────────┘

┌───────────────────────────────────────────┐
│             offering_count_sheets          │
│  id (PK)                                   │
│  date               DATE                   │
│  counter_1_id → users.id                   │
│  counter_1_amount   DECIMAL(18,2)          │
│  counter_2_id → users.id                   │
│  counter_2_amount   DECIMAL(18,2)          │
│  counter_3_id → users.id (nullable)        │
│  counter_3_amount   DECIMAL(18,2)          │
│  reconciled_amount  DECIMAL(18,2)          │
│  status (counting/in_review/reconciled/    │
│          locked)                            │
│  locked_by → users.id                      │
│  locked_at         TIMESTAMPTZ             │
│  notes             TEXT                    │
│  created_at        TIMESTAMPTZ             │
│  updated_at        TIMESTAMPTZ             │
│  version           INTEGER                 │
└───────────────────────────────────────────┘

┌───────────────────────────────────────────┐
│            fiscal_periods                  │
│  id (PK)                                   │
│  fiscal_year      INTEGER                  │
│  period_number    INTEGER (1-12)           │
│  start_date       DATE                     │
│  end_date         DATE                     │
│  status (open | closed | reconciled)       │
│  closed_by → users.id                      │
│  closed_at        TIMESTAMPTZ              │
│  reopened_by → users.id                    │
│  reopened_at      TIMESTAMPTZ              │
│  created_at       TIMESTAMPTZ              │
│  updated_at       TIMESTAMPTZ              │
│  version          INTEGER                  │
│  UNIQUE(fiscal_year, period_number)        │
└───────────────────────────────────────────┘

┌───────────────────────────────────────────┐
│           reconciliations                  │
│  id (PK)                                   │
│  period_id → fiscal_periods.id             │
│  fund_id → funds.id                        │
│  system_balance      DECIMAL(18,2)         │
│  actual_balance      DECIMAL(18,2)         │
│  variance            DECIMAL(18,2)         │
│  explanation         TEXT                  │
│  previous_reconciliation_id                 │
│      → reconciliations.id                  │
│  reconciled_by → users.id                  │
│  reconciled_at       TIMESTAMPTZ           │
│  created_at          TIMESTAMPTZ           │
│  UNIQUE(period_id, fund_id)                │
└───────────────────────────────────────────┘

┌───────────────────────────────────────────┐
│              budgets                       │
│  id (PK)                                   │
│  name               VARCHAR(255)           │
│  account_id → chart_of_accounts.id         │
│  period_type (annual|monthly|department|   │
│               project)                      │
│  fiscal_year        INTEGER                │
│  fiscal_period      INTEGER (nullable)     │
│  department_id → departments.id (nullable) │
│  project_id → projects.id (nullable)       │
│  budgeted_amount    DECIMAL(18,2)          │
│  status (draft|pending|approved|rejected)  │
│  approved_by → users.id                    │
│  created_by → users.id                     │
│  created_at         TIMESTAMPTZ            │
│  updated_at         TIMESTAMPTZ            │
│  version            INTEGER                │
└───────────────────────────────────────────┘

┌───────────────────────────────────────────┐
│              members                       │
│  id (PK)                                   │
│  first_name         VARCHAR(100)           │
│  last_name          VARCHAR(100)           │
│  family_name        VARCHAR(100)           │
│  phone              VARCHAR(20)            │
│  email              VARCHAR(255)           │
│  address            TEXT                   │
│  department_id → departments.id            │
│  status (active|inactive)                  │
│  joined_at          DATE                   │
│  consent_given      BOOLEAN                │
│  consent_date       DATE                   │
│  created_at         TIMESTAMPTZ            │
│  updated_at         TIMESTAMPTZ            │
│  version            INTEGER                │
└───────────────────────────────────────────┘

┌───────────────────────────────────────────┐
│              departments                   │
│  id (PK)                                   │
│  name               VARCHAR(255)           │
│  description        TEXT                   │
│  created_at         TIMESTAMPTZ            │
│  updated_at         TIMESTAMPTZ            │
└───────────────────────────────────────────┘

┌───────────────────────────────────────────┐
│              projects                      │
│  id (PK)                                   │
│  name               VARCHAR(255)           │
│  description        TEXT                   │
│  budget_amount      DECIMAL(18,2)          │
│  start_date         DATE                   │
│  end_date           DATE (nullable)        │
│  status (planning|active|paused|completed) │
│  department_id → departments.id            │
│  owner_id → users.id                       │
│  created_at         TIMESTAMPTZ            │
│  updated_at         TIMESTAMPTZ            │
│  version            INTEGER                │
└───────────────────────────────────────────┘

┌───────────────────────────────────────────┐
│            offering_categories             │
│  id (PK)                                   │
│  name               VARCHAR(100)           │
│  description        TEXT                   │
│  color              VARCHAR(7)             │
│  icon               VARCHAR(50)            │
│  sort_order         INTEGER                │
│  is_active          BOOLEAN                │
│  account_id → chart_of_accounts.id         │
│  created_at         TIMESTAMPTZ            │
│  updated_at         TIMESTAMPTZ            │
│  version            INTEGER                │
└───────────────────────────────────────────┘

┌───────────────────────────────────────────┐
│            audit_log                       │
│  id (PK)                                   │
│  event_type         VARCHAR(100)           │
│  entity_type        VARCHAR(50)            │
│  entity_id          UUID                   │
│  user_id → users.id                        │
│  user_name          VARCHAR(255)           │
│  action             VARCHAR(50)            │
│  before_state       JSONB (nullable)       │
│  after_state        JSONB (nullable)       │
│  ip_address         INET                   │
│  user_agent         TEXT                   │
│  correlation_id     UUID                   │
│  previous_hash      VARCHAR(64)            │
│  current_hash       VARCHAR(64)            │
│  created_at         TIMESTAMPTZ            │
└───────────────────────────────────────────┘

┌───────────────────────────────────────────┐
│              user_sessions                 │
│  id (PK)                                   │
│  user_id → users.id                        │
│  token_hash         VARCHAR(64)            │
│  ip_address         INET                   │
│  user_agent         TEXT                   │
│  expires_at         TIMESTAMPTZ            │
│  last_activity_at   TIMESTAMPTZ            │
│  created_at         TIMESTAMPTZ            │
└───────────────────────────────────────────┘

┌───────────────────────────────────────────┐
│          app_settings                      │
│  id (PK)  (singleton — id = 'default')     │
│  church_name        VARCHAR(255)           │
│  church_address     TEXT                   │
│  tax_id             VARCHAR(20)            │
│  fiscal_year_start  INTEGER (1-12)         │
│  idle_timeout_min   INTEGER                │
│  session_max_hours  INTEGER                │
│  currency           VARCHAR(3) DEFAULT 'THB'│
│  updated_by → users.id                     │
│  updated_at         TIMESTAMPTZ            │
└───────────────────────────────────────────┘

┌───────────────────────────────────────────┐
│             attachments                    │
│  id (PK)                                   │
│  entity_type        VARCHAR(50)            │
│  entity_id          UUID                   │
│  file_name          VARCHAR(255)           │
│  file_size          INTEGER                │
│  content_type       VARCHAR(100)           │
│  storage_path       VARCHAR(500)           │
│  uploaded_by → users.id                    │
│  created_at         TIMESTAMPTZ            │
└───────────────────────────────────────────┘
```

---

## 3. Core Accounting Tables

### 3.1 chart_of_accounts

The foundational table for double-entry accounting. Every financial transaction posts to accounts in this chart.

```sql
CREATE TABLE chart_of_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code    VARCHAR(20) NOT NULL UNIQUE,
  account_name    VARCHAR(255) NOT NULL,
  account_type    VARCHAR(20) NOT NULL
    CHECK (account_type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  parent_id       UUID REFERENCES chart_of_accounts(id),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_contra       BOOLEAN NOT NULL DEFAULT FALSE,
  normal_balance  VARCHAR(6) NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
  description     TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  tfrs_code       VARCHAR(20),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1
);

-- Indexes
CREATE INDEX idx_coa_account_type ON chart_of_accounts(account_type);
CREATE INDEX idx_coa_parent_id ON chart_of_accounts(parent_id);
CREATE INDEX idx_coa_active ON chart_of_accounts(is_active) WHERE is_active = TRUE;
```

**Default Chart of Accounts (Thai Church):**

| Code                   | Name (TH)               | Name (EN)                | Type      | Normal   |
| ---------------------- | ----------------------- | ------------------------ | --------- | -------- |
| **1xxx — Assets**      |                         |                          |           |          |
| 1-1001                 | เงินสด                  | Cash on Hand             | asset     | debit    |
| 1-1002                 | เงินฝากธนาคาร           | Bank Deposits            | asset     | debit    |
| 1-1003                 | ลูกหนี้                 | Accounts Receivable      | asset     | debit    |
| 1-1004                 | ที่ดิน                  | Land                     | asset     | debit    |
| 1-1005                 | อาคาร                   | Buildings                | asset     | debit    |
| 1-1006                 | อุปกรณ์                 | Equipment                | asset     | debit    |
| 1-1007                 | ค่าเสื่อมราคาสะสม       | Accumulated Depreciation | asset     | credit\* |
| **2xxx — Liabilities** |                         |                          |           |          |
| 2-2001                 | เจ้าหนี้การค้า          | Accounts Payable         | liability | credit   |
| 2-2002                 | เงินกู้ยืม              | Loans Payable            | liability | credit   |
| 2-2003                 | ภาษีหัก ณ ที่จ่าย       | Withholding Tax Payable  | liability | credit   |
| 2-2004                 | เงินประกันสังคมค้างจ่าย | Social Security Payable  | liability | credit   |
| **3xxx — Equity**      |                         |                          |           |          |
| 3-3001                 | กองทุนทั่วไป            | General Fund             | equity    | credit   |
| 3-3002                 | กองทุนที่ดิน            | Building Fund            | equity    | credit   |
| 3-3003                 | กองทุนพันธกิจ           | Mission Fund             | equity    | credit   |
| 3-3004                 | กำไรสะสม                | Retained Earnings        | equity    | credit   |
| **4xxx — Income**      |                         |                          |           |          |
| 4-4001                 | เงินถวายสิบลด           | Tithes                   | income    | credit   |
| 4-4002                 | เงินถวายพิเศษ           | Special Offerings        | income    | credit   |
| 4-4003                 | เงินถวายพันธกิจ         | Mission Offerings        | income    | credit   |
| 4-4004                 | เงินบริจาค              | Donations                | income    | credit   |
| 4-4005                 | ดอกเบี้ยรับ             | Interest Income          | income    | credit   |
| 4-4006                 | รายได้ค่าเช่า           | Rental Income            | income    | credit   |
| 4-4007                 | รายรับอื่น ๆ            | Other Income             | income    | credit   |
| **5xxx — Expenses**    |                         |                          |           |          |
| 5-5001                 | เงินเดือนบุคลากร        | Staff Salaries           | expense   | debit    |
| 5-5002                 | ค่าสาธารณูปโภค          | Utilities                | expense   | debit    |
| 5-5003                 | ค่าซ่อมบำรุง            | Maintenance              | expense   | debit    |
| 5-5004                 | ค่าพันธกิจ              | Mission Expenses         | expense   | debit    |
| 5-5005                 | ค่าอุปกรณ์              | Supplies                 | expense   | debit    |
| 5-5006                 | ค่าเดินทาง              | Travel Expenses          | expense   | debit    |
| 5-5007                 | ค่าใช้จ่ายอื่น ๆ        | Other Expenses           | expense   | debit    |

\*Account 1-1007 (สะสมค่าเสื่อมราคา) is a contra-asset with `is_contra = TRUE`

### 3.2 journal_entries

Every financial operation creates exactly one journal entry with balanced debits and credits.

```sql
CREATE TABLE journal_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number      VARCHAR(30) NOT NULL,        -- e.g., 'EXP-2026-0001'
  entry_type        VARCHAR(20) NOT NULL
    CHECK (entry_type IN ('offering', 'expense', 'income', 'transfer',
                          'opening', 'adjustment', 'void')),
  posting_date      DATE NOT NULL,
  description       TEXT,
  status            VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'voided')),
  created_by        UUID NOT NULL REFERENCES users(id),
  approved_by       UUID REFERENCES users(id),
  rejection_reason  TEXT,
  void_parent_id    UUID REFERENCES journal_entries(id),
  fund_id           UUID NOT NULL REFERENCES funds(id),
  reference_document VARCHAR(255),
  total_debit       DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  total_credit      DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  fiscal_year       INTEGER NOT NULL,
  fiscal_period     INTEGER NOT NULL CHECK (fiscal_period BETWEEN 1 AND 12),
  version           INTEGER NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  posted_at         TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_balanced CHECK (total_debit = total_credit),
  CONSTRAINT chk_positive_totals CHECK (total_debit > 0 AND total_credit > 0)
);

-- Indexes
CREATE INDEX idx_journal_entries_posting_date ON journal_entries(posting_date);
CREATE INDEX idx_journal_entries_status ON journal_entries(status);
CREATE INDEX idx_journal_entries_fund ON journal_entries(fund_id);
CREATE INDEX idx_journal_entries_fiscal ON journal_entries(fiscal_year, fiscal_period);
CREATE INDEX idx_journal_entries_entry_type ON journal_entries(entry_type);
CREATE UNIQUE INDEX idx_journal_entries_number ON journal_entries(entry_number);
```

### 3.3 journal_entry_lines

Each journal entry has at least 2 lines (one debit, one credit).

```sql
CREATE TABLE journal_entry_lines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id  UUID NOT NULL REFERENCES journal_entries(id),
  account_id        UUID NOT NULL REFERENCES chart_of_accounts(id),
  line_type         VARCHAR(6) NOT NULL CHECK (line_type IN ('debit', 'credit')),
  amount            DECIMAL(18,2) NOT NULL CHECK (amount > 0),
  fund_id           UUID NOT NULL REFERENCES funds(id),
  member_id         UUID REFERENCES members(id),
  department_id     UUID REFERENCES departments(id),
  project_id        UUID REFERENCES projects(id),
  description       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_journal_lines_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX idx_journal_lines_account ON journal_entry_lines(account_id);
CREATE INDEX idx_journal_lines_fund ON journal_entry_lines(fund_id);
CREATE INDEX idx_journal_lines_member ON journal_entry_lines(member_id);
```

### 3.4 general_ledger

The general ledger maintains running balances per account per fund per period. Each journal line creates one GL entry.

```sql
CREATE TABLE general_ledger (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID NOT NULL REFERENCES chart_of_accounts(id),
  posting_date      DATE NOT NULL,
  journal_entry_id  UUID NOT NULL REFERENCES journal_entries(id),
  journal_line_id   UUID NOT NULL REFERENCES journal_entry_lines(id),
  fund_id           UUID NOT NULL REFERENCES funds(id),
  debit_amount      DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  credit_amount     DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  running_balance   DECIMAL(18,2) NOT NULL,
  fiscal_year       INTEGER NOT NULL,
  fiscal_period     INTEGER NOT NULL CHECK (fiscal_period BETWEEN 1 AND 12),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_gl_journal_line UNIQUE (journal_line_id)
);

-- Indexes
CREATE INDEX idx_gl_account_date ON general_ledger(account_id, posting_date);
CREATE INDEX idx_gl_fund_date ON general_ledger(fund_id, posting_date);
CREATE INDEX idx_gl_entry ON general_ledger(journal_entry_id);
CREATE INDEX idx_gl_fiscal ON general_ledger(fiscal_year, fiscal_period);
CREATE INDEX idx_gl_posting_date ON general_ledger(posting_date);
```

---

## 4. Fund Accounting Tables

### 4.1 funds

Each fund is backed by one or more equity accounts in the chart of accounts.

```sql
CREATE TABLE funds (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id        UUID NOT NULL REFERENCES chart_of_accounts(id),
  fund_code         VARCHAR(20) NOT NULL UNIQUE,
  name              VARCHAR(255) NOT NULL,
  description       TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  is_restricted     BOOLEAN NOT NULL DEFAULT FALSE,
  opening_balance   DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  current_balance   DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  last_calculated_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_funds_active ON funds(is_active) WHERE is_active = TRUE;
```

---

## 5. Transaction Tables

### 5.1 offering_count_sheets

Records the Sunday count sheet process with independent counter verification.

```sql
CREATE TABLE offering_count_sheets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                DATE NOT NULL,
  counter_1_id        UUID NOT NULL REFERENCES users(id),
  counter_1_amount    DECIMAL(18,2) NOT NULL CHECK (counter_1_amount >= 0),
  counter_2_id        UUID NOT NULL REFERENCES users(id),
  counter_2_amount    DECIMAL(18,2) NOT NULL CHECK (counter_2_amount >= 0),
  counter_3_id        UUID REFERENCES users(id),
  counter_3_amount    DECIMAL(18,2) CHECK (counter_3_amount >= 0),
  reconciled_amount   DECIMAL(18,2),
  status              VARCHAR(20) NOT NULL DEFAULT 'counting'
    CHECK (status IN ('counting', 'in_review', 'reconciled', 'locked')),
  locked_by           UUID REFERENCES users(id),
  locked_at           TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  version             INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT chk_counters_different_12 CHECK (counter_1_id <> counter_2_id),
  CONSTRAINT chk_counters_different_13 CHECK (counter_1_id <> counter_3_id OR counter_3_id IS NULL),
  CONSTRAINT chk_counters_different_23 CHECK (counter_2_id <> counter_3_id OR counter_3_id IS NULL)
);

CREATE INDEX idx_ocs_date ON offering_count_sheets(date);
CREATE INDEX idx_ocs_status ON offering_count_sheets(status);
```

### 5.2 offering_categories

Links offering categories to chart of accounts for automatic journal entry creation.

```sql
CREATE TABLE offering_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL,
  description     TEXT,
  color           VARCHAR(7),
  icon            VARCHAR(50),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  account_id      UUID NOT NULL REFERENCES chart_of_accounts(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_oc_active ON offering_categories(is_active) WHERE is_active = TRUE;
```

---

## 6. Period & Reconciliation Tables

### 6.1 fiscal_periods

```sql
CREATE TABLE fiscal_periods (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year     INTEGER NOT NULL,
  period_number   INTEGER NOT NULL CHECK (period_number BETWEEN 1 AND 12),
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'reconciled')),
  closed_by       UUID REFERENCES users(id),
  closed_at       TIMESTAMPTZ,
  reopened_by     UUID REFERENCES users(id),
  reopened_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT uq_fiscal_year_period UNIQUE (fiscal_year, period_number),
  CONSTRAINT chk_end_after_start CHECK (end_date >= start_date)
);

CREATE INDEX idx_fp_status ON fiscal_periods(status);
```

### 6.2 reconciliations

```sql
CREATE TABLE reconciliations (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id                   UUID NOT NULL REFERENCES fiscal_periods(id),
  fund_id                     UUID NOT NULL REFERENCES funds(id),
  opening_balance             DECIMAL(18,2) NOT NULL,
  system_balance              DECIMAL(18,2) NOT NULL,
  actual_balance              DECIMAL(18,2) NOT NULL,
  variance                    DECIMAL(18,2) NOT NULL,
  explanation                 TEXT,
  is_reconciled               BOOLEAN NOT NULL DEFAULT FALSE,
  previous_reconciliation_id  UUID REFERENCES reconciliations(id),
  reconciled_by               UUID NOT NULL REFERENCES users(id),
  reconciled_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_period_fund UNIQUE (period_id, fund_id)
);

CREATE INDEX idx_rec_period ON reconciliations(period_id);
CREATE INDEX idx_rec_fund ON reconciliations(fund_id);
```

---

## 7. Budget Tables

### 7.1 budgets

```sql
CREATE TABLE budgets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  account_id      UUID NOT NULL REFERENCES chart_of_accounts(id),
  fund_id         UUID NOT NULL REFERENCES funds(id),
  period_type     VARCHAR(20) NOT NULL
    CHECK (period_type IN ('annual', 'monthly', 'department', 'project')),
  fiscal_year     INTEGER NOT NULL,
  fiscal_period   INTEGER CHECK (fiscal_period BETWEEN 1 AND 12),
  department_id   UUID REFERENCES departments(id),
  project_id      UUID REFERENCES projects(id),
  budgeted_amount DECIMAL(18,2) NOT NULL CHECK (budgeted_amount >= 0),
  status          VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
  approved_by     UUID REFERENCES users(id),
  created_by      UUID NOT NULL REFERENCES users(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT chk_budget_period
    CHECK (
      (period_type = 'annual' AND fiscal_period IS NULL AND department_id IS NULL AND project_id IS NULL) OR
      (period_type = 'monthly' AND fiscal_period IS NOT NULL AND department_id IS NULL AND project_id IS NULL) OR
      (period_type = 'department' AND fiscal_period IS NULL AND department_id IS NOT NULL AND project_id IS NULL) OR
      (period_type = 'project' AND fiscal_period IS NULL AND department_id IS NULL AND project_id IS NOT NULL)
    )
);

CREATE INDEX idx_budgets_year ON budgets(fiscal_year, fiscal_period);
CREATE INDEX idx_budgets_status ON budgets(status);
CREATE INDEX idx_budgets_account ON budgets(account_id);
```

Budget utilization is calculated dynamically:

```sql
-- Budget vs. Actual query
SELECT
  b.id AS budget_id,
  b.name,
  b.budgeted_amount,
  COALESCE(SUM(gl.debit_amount), 0) AS actual_spent,
  b.budgeted_amount - COALESCE(SUM(gl.debit_amount), 0) AS remaining
FROM budgets b
LEFT JOIN general_ledger gl
  ON gl.account_id = b.account_id
  AND gl.fund_id = b.fund_id
  AND gl.fiscal_year = b.fiscal_year
  AND (b.fiscal_period IS NULL OR gl.fiscal_period <= b.fiscal_period)
  AND (b.department_id IS NULL OR EXISTS (
    SELECT 1 FROM journal_entry_lines jel
    WHERE jel.id = gl.journal_line_id
    AND jel.department_id = b.department_id
  ))
  AND (b.project_id IS NULL OR EXISTS (
    SELECT 1 FROM journal_entry_lines jel
    WHERE jel.id = gl.journal_line_id
    AND jel.project_id = b.project_id
  ))
WHERE b.status = 'approved'
GROUP BY b.id, b.name, b.budgeted_amount;
```

---

## 8. Member & Organization Tables

### 8.1 members

```sql
CREATE TABLE members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name      VARCHAR(100) NOT NULL,
  last_name       VARCHAR(100) NOT NULL,
  family_name     VARCHAR(100),
  phone           VARCHAR(20),
  email           VARCHAR(255),
  address         TEXT,
  department_id   UUID REFERENCES departments(id),
  status          VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  joined_at       DATE,
  consent_given   BOOLEAN NOT NULL DEFAULT FALSE,
  consent_date    DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_members_status ON members(status) WHERE status = 'active';
CREATE INDEX idx_members_name ON members(last_name, first_name);
CREATE UNIQUE INDEX idx_members_email ON members(email) WHERE email IS NOT NULL;
```

### 8.2 departments

```sql
CREATE TABLE departments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 8.3 projects

```sql
CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  budget_amount   DECIMAL(18,2) NOT NULL DEFAULT 0.00,
  start_date      DATE NOT NULL,
  end_date        DATE,
  status          VARCHAR(20) NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning', 'active', 'paused', 'completed')),
  department_id   UUID REFERENCES departments(id),
  owner_id        UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  version         INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_projects_status ON projects(status);
```

Project spending is tracked dynamically through journal entry lines:

```sql
SELECT
  p.id,
  p.name,
  p.budget_amount,
  COALESCE(SUM(jel.amount), 0) AS total_spent
FROM projects p
LEFT JOIN journal_entry_lines jel ON jel.project_id = p.id
  AND jel.line_type = 'debit'
GROUP BY p.id, p.name, p.budget_amount;
```

---

## 9. Authentication & Authorization Tables

### 9.1 users

```sql
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(255) NOT NULL,
  role              VARCHAR(20) NOT NULL
    CHECK (role IN ('super_admin', 'pastor', 'treasurer', 'finance_staff', 'auditor', 'viewer')),
  password_hash     VARCHAR(255) NOT NULL,
  mfa_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret        VARCHAR(64),
  avatar_color      VARCHAR(7),
  failed_attempts   INTEGER NOT NULL DEFAULT 0,
  locked_until      TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  version           INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX idx_users_active_name ON users(name) WHERE is_active = TRUE;
```

### 9.2 user_sessions

```sql
CREATE TABLE user_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  token_hash        VARCHAR(64) NOT NULL,
  ip_address        INET,
  user_agent        TEXT,
  expires_at        TIMESTAMPTZ NOT NULL,
  last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(token_hash);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);
```

---

## 10. Audit Trail Tables

### 10.1 audit_log

The audit log is **append-only**. Application code must never execute UPDATE or DELETE on this table. This is enforced through database permissions.

```sql
CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      VARCHAR(100) NOT NULL,
  entity_type     VARCHAR(50) NOT NULL,
  entity_id       UUID,
  user_id         UUID REFERENCES users(id),
  user_name       VARCHAR(255) NOT NULL,
  action          VARCHAR(50) NOT NULL,
  before_state    JSONB,
  after_state     JSONB,
  ip_address      INET,
  user_agent      TEXT,
  correlation_id  UUID NOT NULL,
  previous_hash   VARCHAR(64),
  current_hash    VARCHAR(64) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The critical index: chronological ordering for hash chain verification
CREATE INDEX idx_audit_created ON audit_log(created_at);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_event ON audit_log(event_type);
CREATE INDEX idx_audit_correlation ON audit_log(correlation_id);

-- Prevent updates and deletes
-- GRANT INSERT ON audit_log TO app_user;
-- GRANT SELECT ON audit_log TO app_user;
-- REVOKE UPDATE, DELETE ON audit_log FROM app_user;
```

---

## 11. System Tables

### 11.1 app_settings

Single-row table for system configuration.

```sql
CREATE TABLE app_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_name         VARCHAR(255) NOT NULL,
  church_address      TEXT,
  tax_id              VARCHAR(20),
  fiscal_year_start   INTEGER NOT NULL DEFAULT 1 CHECK (fiscal_year_start BETWEEN 1 AND 12),
  idle_timeout_min    INTEGER NOT NULL DEFAULT 15 CHECK (idle_timeout_min >= 1),
  session_max_hours   INTEGER NOT NULL DEFAULT 8 CHECK (session_max_hours >= 1),
  currency            VARCHAR(3) NOT NULL DEFAULT 'THB',
  updated_by          UUID REFERENCES users(id),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure only one row exists
CREATE UNIQUE INDEX idx_settings_singleton ON app_settings((TRUE));
```

### 11.2 attachments

```sql
CREATE TABLE attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     VARCHAR(50) NOT NULL,
  entity_id       UUID NOT NULL,
  file_name       VARCHAR(255) NOT NULL,
  file_size       INTEGER NOT NULL CHECK (file_size <= 10485760), -- 10MB max
  content_type    VARCHAR(100) NOT NULL,
  storage_path    VARCHAR(500) NOT NULL,
  uploaded_by     UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attachments_entity ON attachments(entity_type, entity_id);
```

---

## 12. Indexing Strategy

### 12.1 Primary Access Patterns

| Query Pattern                      | Index Used                                | Reason                                |
| ---------------------------------- | ----------------------------------------- | ------------------------------------- |
| List journal entries by date range | `idx_journal_entries_posting_date`        | Date-range queries for reporting      |
| Get journal entry by number        | `idx_journal_entries_number` (UNIQUE)     | Lookup by sequential ID               |
| Get GL by account + date range     | `idx_gl_account_date`                     | Account history queries               |
| Get GL by fund + date range        | `idx_gl_fund_date`                        | Fund balance queries                  |
| List audit log chronologically     | `idx_audit_created`                       | Audit viewer (always time-ordered)    |
| Find audit entries for entity      | `idx_audit_entity`                        | Drill-down: "who changed this record" |
| Authenticate user (token hash)     | `idx_sessions_token`                      | Session validation                    |
| Find active periods                | `idx_fp_status`                           | Period management                     |
| Budget vs. actual queries          | `idx_budgets_year`, `idx_gl_account_date` | Report generation                     |

### 12.2 Partitioning Strategy

The `general_ledger` table should be partitioned by `fiscal_year` for performance:

```sql
CREATE TABLE general_ledger (
  -- ... columns ...
) PARTITION BY RANGE (fiscal_year);

-- Create partitions for each fiscal year
CREATE TABLE general_ledger_2026 PARTITION OF general_ledger
  FOR VALUES FROM (2026) TO (2027);
CREATE TABLE general_ledger_2027 PARTITION OF general_ledger
  FOR VALUES FROM (2027) TO (2028);
-- etc.
```

---

## 13. Row-Level Security Policies

### 13.1 Enabling RLS

```sql
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE general_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
```

### 13.2 Core Policies

```sql
-- Users can read their own data only
CREATE POLICY users_self ON users
  FOR SELECT USING (id = current_setting('app.current_user_id')::uuid);

-- Viewers can read all financial data but not modify
CREATE POLICY gl_viewer_read ON general_ledger
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = current_setting('app.current_user_id')::uuid)
  );

-- Only finance_staff+ can create journal entries (via application)
-- The application uses a service role with full access; RLS backs application-level auth
CREATE POLICY audit_log_read ON audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = current_setting('app.current_user_id')::uuid
      AND role IN ('super_admin', 'pastor', 'treasurer', 'auditor')
    )
  );

-- Members: mask PII for non-privileged roles
CREATE POLICY members_viewer_read ON members
  FOR SELECT USING (
    CASE
      WHEN (SELECT role FROM users WHERE id = current_setting('app.current_user_id')::uuid)
           IN ('super_admin', 'pastor', 'treasurer', 'finance_staff')
      THEN TRUE
      ELSE FALSE  -- viewer + auditor: see anonymized data via application layer
    END
  );
```

**Note:** The application uses a Supabase `service_role` key for server-side operations, bypassing RLS. RLS serves as a defense-in-depth measure — if the application layer has a bug, RLS prevents unauthorized direct table access. All authorization logic lives in the application layer (see AUTHORIZATION_MODEL.md).

---

## 14. Migration Strategy

### 14.1 From v1 (localStorage) to v2 (PostgreSQL)

**Step 1: Extract v1 data**

- User exports JSON from the v1 application
- Export contains all localStorage data in a structured format

**Step 2: Transform**

- Map `Income`, `Expense`, `Offering` records to `journal_entries` + `journal_entry_lines`
- Each v1 record becomes a balanced journal entry:
  - **Offering:** Debit `1-1001 Cash` / Credit `4-4001 Tithes`
  - **Expense:** Debit `5-5xxx Expense Account` / Credit `1-1001 Cash`
  - **Income:** Debit `1-1001 Cash` / Credit `4-4xxx Income Account`
  - **Transfer:** Debit source fund equity / Credit destination fund equity
- Map v1 funds to v2 chart of accounts equity section
- Convert users: hash existing PINs with bcrypt

**Step 3: Validate**

- Calculate total debits = total credits across all migrated entries
- Reconcile fund balances against v1 computed balances
- Verify audit trail completeness

**Step 4: Import**

- Run migration script against a staging database
- Run reconciliation verification queries
- Get church treasurer approval before production migration

### 14.2 Drizzle Migrations

```bash
# Generate migration from schema changes
bun run db:generate

# Apply migrations
bun run db:migrate

# Rollback (if supported)
bun run db:rollback
```

Migrations are versioned files stored in `src/server/infrastructure/migrations/` and tracked by Drizzle.

---

## 15. Data Retention Policy

| Data Type             | Retention                   | Justification                                                      |
| --------------------- | --------------------------- | ------------------------------------------------------------------ |
| Journal entries       | Permanent                   | Core financial records — never deleted                             |
| General ledger        | Permanent                   | Core financial records                                             |
| Audit log             | 7 years (minimum)           | Thai Revenue Code + TFRS requirement                               |
| User sessions         | 90 days after expiry        | Security forensics                                                 |
| Attachments           | 7 years                     | Tax receipt documentation                                          |
| Soft-deleted records  | 30 days from deletion       | Recovery window                                                    |
| Backups               | See ARCHITECTURE_V2.md §7.3 | Operational resilience                                             |
| Archived fiscal years | 7 years after close         | Tax audit requirements; can be moved to cold storage after 2 years |

---

_This database schema is the authoritative data model for Grace Ledger v2. All data access must go through the repository layer defined in ARCHITECTURE_V2.md. Direct table access (except via database administration tools) is prohibited._

_Next: See ACCOUNTING_ENGINE.md for the double-entry accounting engine design._

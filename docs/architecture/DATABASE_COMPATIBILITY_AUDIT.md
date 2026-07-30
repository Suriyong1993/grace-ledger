# Database Compatibility Audit

**Date:** 2026-07-29  
**Auditor:** Principal Architect  
**Purpose:** Compare Drizzle ORM schema, Supabase SQL migrations, and server domain layer to determine if the existing server can safely write to the current Supabase database.

---

## Executive Summary

**Verdict: ⚠️ CONDITIONAL PASS — Server can activate, but 5 critical schema drifts must be resolved first.**

The Drizzle schema (`src/db/schema.ts`) and the Supabase SQL migrations (`supabase/migrations/001–005`) have **diverged significantly**. The server domain layer imports the Drizzle schema directly — if the schema doesn't match the database, queries will fail at runtime.

| Severity    | Count |
| ----------- | ----- |
| 🔴 CRITICAL | 5     |
| 🟠 HIGH     | 4     |
| 🟡 MEDIUM   | 2     |
| 🟢 LOW      | 3     |

---

## Compatibility Matrix

### Legend

| Symbol | Meaning                                |
| ------ | -------------------------------------- |
| ✅     | Match                                  |
| ⚠️     | Minor difference (backward compatible) |
| 🔴     | Mismatch — blocks server activation    |
| ❌     | Missing entirely                       |
| ➕     | Extra (in database not in schema)      |

---

### 1. `churches` — ✅ MATCH

| Column            | Drizzle                    | Supabase SQL               | Status |
| ----------------- | -------------------------- | -------------------------- | ------ |
| id                | UUID PK defaultRandom      | UUID PK gen_random_uuid()  | ✅     |
| name              | VARCHAR(255) NOT NULL      | VARCHAR(255) NOT NULL      | ✅     |
| address           | TEXT                       | TEXT                       | ✅     |
| tax_id            | VARCHAR(20)                | VARCHAR(20)                | ✅     |
| fiscal_year_start | INTEGER NOT NULL DEFAULT 1 | INTEGER NOT NULL DEFAULT 1 | ✅     |
| currency          | VARCHAR(3) DEFAULT 'THB'   | VARCHAR(3) DEFAULT 'THB'   | ✅     |
| is_active         | BOOLEAN DEFAULT true       | BOOLEAN DEFAULT true       | ✅     |
| created_at        | TIMESTAMPTZ DEFAULT now()  | TIMESTAMPTZ DEFAULT NOW()  | ✅     |
| updated_at        | TIMESTAMPTZ DEFAULT now()  | TIMESTAMPTZ DEFAULT NOW()  | ✅     |
| version           | INTEGER DEFAULT 1          | INTEGER DEFAULT 1          | ✅     |

**Verdict:** Safe to write.

---

### 2. `users` — 🔴 CRITICAL MISMATCH

| Column                  | Drizzle                                | Supabase SQL                                   | Status |
| ----------------------- | -------------------------------------- | ---------------------------------------------- | ------ |
| id                      | UUID PK defaultRandom                  | UUID PK gen_random_uuid()                      | ✅     |
| church_id               | UUID NOT NULL → churches               | UUID NOT NULL → churches                       | ✅     |
| auth_user_id            | UUID unique()                          | UUID UNIQUE NOT NULL REFERENCES auth.users(id) | ⚠️     |
| name                    | VARCHAR(255) NOT NULL                  | VARCHAR(255) NOT NULL                          | ✅     |
| email                   | VARCHAR(255)                           | Added by migration 003                         | ✅     |
| role                    | user_role NOT NULL                     | user_role NOT NULL DEFAULT 'admin'             | ✅     |
| **password_hash**       | **VARCHAR(255) NOT NULL**              | **❌ MISSING from SQL**                        | **🔴** |
| **password_changed_at** | **TIMESTAMPTZ NOT NULL DEFAULT now()** | **❌ MISSING from SQL**                        | **🔴** |
| mfa_enabled             | BOOLEAN DEFAULT false                  | BOOLEAN DEFAULT false                          | ✅     |
| mfa_secret              | VARCHAR(64)                            | VARCHAR(64)                                    | ✅     |
| avatar_color            | VARCHAR(7)                             | VARCHAR(7)                                     | ✅     |
| failed_attempts         | INTEGER DEFAULT 0                      | INTEGER DEFAULT 0                              | ✅     |
| locked_until            | TIMESTAMPTZ                            | TIMESTAMPTZ                                    | ✅     |
| token_version           | INTEGER DEFAULT 1                      | INTEGER DEFAULT 1                              | ✅     |
| is_active               | BOOLEAN DEFAULT true                   | BOOLEAN DEFAULT true                           | ✅     |
| created_at              | TIMESTAMPTZ DEFAULT now()              | TIMESTAMPTZ DEFAULT NOW()                      | ✅     |
| updated_at              | TIMESTAMPTZ DEFAULT now()              | TIMESTAMPTZ DEFAULT NOW()                      | ✅     |
| version                 | INTEGER DEFAULT 1                      | INTEGER DEFAULT 1                              | ✅     |

**Impact:** The server auth layer (`src/server/auth/password.ts`, `src/server/auth/session.ts`) expects `password_hash` and `password_changed_at` columns. Without them, the server's authentication system will crash on first query.

**Fix required BEFORE server activation.**

---

### 3. `user_sessions` — ✅ MATCH

| Column           | Drizzle                            | Supabase SQL                       | Status |
| ---------------- | ---------------------------------- | ---------------------------------- | ------ |
| id               | UUID PK defaultRandom              | UUID PK gen_random_uuid()          | ✅     |
| user_id          | UUID → users                       | UUID → users                       | ✅     |
| church_id        | UUID → churches                    | UUID → churches                    | ✅     |
| token_hash       | VARCHAR(64) NOT NULL               | VARCHAR(64) NOT NULL               | ✅     |
| ip_address       | VARCHAR(45)                        | VARCHAR(45)                        | ✅     |
| user_agent       | TEXT                               | TEXT                               | ✅     |
| expires_at       | TIMESTAMPTZ NOT NULL               | TIMESTAMPTZ NOT NULL               | ✅     |
| last_activity_at | TIMESTAMPTZ NOT NULL DEFAULT now() | TIMESTAMPTZ NOT NULL DEFAULT NOW() | ✅     |
| created_at       | TIMESTAMPTZ NOT NULL DEFAULT now() | TIMESTAMPTZ NOT NULL DEFAULT NOW() | ✅     |

**Verdict:** Safe to write.

---

### 4. `chart_of_accounts` — ✅ MATCH

All columns match. Index structure differs slightly (Drizzle has `idx_coa_active` partial index not in SQL), but this is additive and won't cause errors.

**Verdict:** Safe to write.

---

### 5. `funds` — 🟠 HIGH (missing sort_order in Drizzle)

| Column                 | Drizzle                      | Supabase SQL               | Status |
| ---------------------- | ---------------------------- | -------------------------- | ------ |
| ... (all base columns) | Match                        | Match                      | ✅     |
| **sort_order**         | **❌ NOT in Drizzle schema** | **Added by migration 004** | **🟠** |

**Impact:** Drizzle schema doesn't know about `sort_order` but the database has it. Drizzle queries using `$inferSelect` won't expose `sort_order`. The frontend service `church.ts` queries this column directly — works fine via Supabase REST API. The server, when activated, won't have type-safe access to `sort_order`.

**Fix:** Add `sort_order` to Drizzle funds table.

---

### 6. `fiscal_periods` — ✅ MATCH

All columns and constraints match.

**Verdict:** Safe to write.

---

### 7. `journal_entries` — ✅ MATCH

All columns and constraints match. This is the primary table the server domain layer writes to.

**Verdict:** Safe to write. ✅

---

### 8. `journal_entry_lines` — ✅ MATCH

Base columns match. Drizzle defines additional indexes (`idx_jel_member`, `idx_jel_project`, `idx_jel_department`) not in SQL — additive only.

**Verdict:** Safe to write.

---

### 9. `general_ledger` — ✅ MATCH

| Column               | Drizzle    | Supabase SQL            | Status |
| -------------------- | ---------- | ----------------------- | ------ |
| idx_gl_church_fiscal | ✅ Defined | ❌ Not in SQL migration | ⚠️     |

Index difference is additive — won't cause errors.

**Verdict:** Safe to write.

---

### 10. `incomes` — 🔴 NOT IN DRIZZLE SCHEMA

The `incomes` table exists in Supabase (created by migration 001, modified by 002, 004, 005) but has **zero representation in the Drizzle schema**.

| Column                  | Drizzle | Supabase SQL                 |
| ----------------------- | ------- | ---------------------------- |
| id                      | ❌      | UUID PK                      |
| church_id               | ❌      | UUID → churches              |
| date                    | ❌      | DATE NOT NULL                |
| category_id             | ❌      | VARCHAR(20)                  |
| amount                  | ❌      | DECIMAL(18,2)                |
| fund_id                 | ❌      | UUID → funds                 |
| description             | ❌      | TEXT                         |
| attachment_name         | ❌      | VARCHAR(255)                 |
| attachment_data_url     | ❌      | TEXT                         |
| attachment_type         | ❌      | VARCHAR(100)                 |
| attachment_size         | ❌      | INTEGER                      |
| attachment_storage_path | ❌      | VARCHAR(500) (migration 005) |
| source                  | ❌      | VARCHAR(20) DEFAULT 'manual' |
| line_message_id         | ❌      | VARCHAR(255)                 |
| created_by              | ❌      | UUID → users                 |
| approved_by             | ❌      | UUID → users                 |
| status                  | ❌      | tx_status DEFAULT 'pending'  |
| created_at              | ❌      | TIMESTAMPTZ                  |

**Impact:** The server doesn't need to write to `incomes` directly (Proof of Concept will route through the server), but the Drizzle schema should at minimum be aware of this table to avoid import errors.

---

### 11. `expenses` — 🔴 NOT IN DRIZZLE SCHEMA

Same situation as `incomes` — all columns missing from Drizzle schema.

**Impact:** Same as incomes.

---

### 12. `offerings` — 🔴 NOT IN DRIZZLE SCHEMA

Full columns: `id, church_id, date, category_id, subcategory_id, channel, amount, member_id, fund_id, note, created_by, created_at`.

**Impact:** The server will route offering mutations eventually; schema awareness needed.

---

### 13. `budgets` — 🔴 CRITICAL SCHEMA MISMATCH

| Aspect         | Drizzle                                                                                                                         | Supabase SQL                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| PK             | UUID id                                                                                                                         | UUID id                                                              |
| church_id      | UUID → churches                                                                                                                 | UUID → churches                                                      |
| name           | VARCHAR(255)                                                                                                                    | VARCHAR(255)                                                         |
| **Columns**    | accountId, fundId, periodType, fiscalYear, fiscalPeriod, departmentId, projectId, budgetedAmount, status, approvedBy, createdBy | period_type, year, month, department, project_id, amount, used, note |
| **Status**     | budget_status enum                                                                                                              | No status column                                                     |
| **Timestamps** | created_at, updated_at                                                                                                          | created_at, updated_at                                               |

**Complete structural mismatch.** The Drizzle budgets table has a modern normalized structure, while the SQL migration has a legacy flat structure. Server services don't currently write to budgets, so this doesn't block server activation, but it must be resolved before write operations.

---

### 14. `members` — 🟠 HIGH MISMATCH

| Column                 | Drizzle                          | Supabase SQL             |
| ---------------------- | -------------------------------- | ------------------------ |
| id                     | UUID PK                          | UUID PK                  |
| church_id              | UUID → churches                  | UUID → churches          |
| **firstName/lastName** | **firstName + lastName (split)** | **name (single field)**  |
| **familyName**         | familyName                       | family                   |
| **departmentId**       | **departmentId (FK)**            | **department (VARCHAR)** |
| phone                  | phone                            | phone                    |
| email                  | email                            | email                    |
| address                | address                          | ❌                       |
| status                 | member_status                    | member_status            |
| joined_at              | joined_at                        | joined_at                |
| consentGiven           | consentGiven                     | ❌                       |
| consentDate            | consentDate                      | ❌                       |
| created_at             | created_at                       | created_at               |
| updated_at             | updated_at                       | updated_at               |

**Impact:** Different column names will cause Drizzle insert/select failures. Server services don't currently write to members, so this doesn't block server activation.

---

### 15. `projects` — 🟠 HIGH MISMATCH

| Column           | Drizzle                             | Supabase SQL            |
| ---------------- | ----------------------------------- | ----------------------- |
| id               | UUID PK                             | UUID PK                 |
| church_id        | UUID → churches                     | UUID → churches         |
| name             | VARCHAR(255)                        | VARCHAR(255)            |
| **budgetAmount** | **budgetAmount (DECIMAL)**          | **budget (DECIMAL)**    |
| **description**  | description                         | description             |
| startDate        | startDate                           | start_date              |
| endDate          | endDate                             | end_date                |
| status           | project_status                      | project_status          |
| **departmentId** | **departmentId (FK → departments)** | ❌                      |
| **ownerId**      | ownerId (UUID → users)              | owner_id (UUID → users) |
| **used**         | ❌                                  | **used DECIMAL**        |
| **progress**     | ❌                                  | **progress INTEGER**    |

**Impact:** Different column structures. Server doesn't write to projects currently.

---

### 16. `audit_log` — 🔴 CRITICAL MISMATCH

This is the **most important table for server activation** because the server's `AuditService` writes to it for every financial transaction.

| Column             | Drizzle (server expects)    | Supabase SQL (actual)               | Status      |
| ------------------ | --------------------------- | ----------------------------------- | ----------- |
| id                 | UUID PK                     | UUID PK                             | ✅          |
| church_id          | UUID → churches             | UUID → churches                     | ✅          |
| **event_type**     | **VARCHAR(100) NOT NULL**   | **❌**                              | **🔴**      |
| **entity_type**    | **VARCHAR(50) NOT NULL**    | **entity (VARCHAR(50))**            | **🔴**      |
| **entity_id**      | **UUID**                    | **entity_id (VARCHAR(50))**         | **🔴 TYPE** |
| **user_id**        | **UUID → users (nullable)** | **user_id UUID → users (NOT NULL)** | **🔴**      |
| **user_name**      | **VARCHAR(255) NOT NULL**   | **user_name VARCHAR(255) NOT NULL** | ✅          |
| **action**         | **VARCHAR(50) NOT NULL**    | **action VARCHAR(50) NOT NULL**     | ✅          |
| **before_state**   | **TEXT**                    | **details TEXT**                    | **🔴**      |
| **after_state**    | **TEXT**                    | ❌                                  | **🔴**      |
| ip_address         | VARCHAR(45)                 | VARCHAR(45)                         | ✅          |
| user_agent         | TEXT                        | TEXT                                | ✅          |
| **correlation_id** | **UUID NOT NULL**           | **❌**                              | **🔴**      |
| **previous_hash**  | **VARCHAR(64)**             | **❌**                              | **🔴**      |
| **current_hash**   | **VARCHAR(64) NOT NULL**    | **❌**                              | **🔴**      |
| created_at         | TIMESTAMPTZ DEFAULT now()   | TIMESTAMPTZ DEFAULT NOW()           | ✅          |

**Impact:** The `AuditService.log()` method attempts to insert `eventType`, `entityType`, `beforeState`, `afterState`, `correlationId`, `previousHash`, and `currentHash` columns. These columns DO NOT EXIST in the Supabase database's `audit_log` table. Every financial transaction logged by the server will throw a PostgreSQL error.

**This is the #1 blocker for Phase 1, Task 2 server activation.**

---

### 17. `categories` — 🟠 NOT IN DRIZZLE SCHEMA

Created by migration 004 with columns: `id, church_id, name, kind, icon, sort_order, is_active, created_at, updated_at, version`. Not defined in Drizzle schema.

**Impact:** The server domain layer doesn't need to write to categories directly, but Drizzle is unaware of this table.

---

### 18. `church_settings` — 🟠 HIGH MISMATCH

Drizzle has `appSettings` table; Supabase has `church_settings` table. Different table names, different columns:

| Drizzle (`app_settings`)  | Supabase SQL (`church_settings`) |
| ------------------------- | -------------------------------- |
| id UUID PK                | ❌                               |
| church_id UUID → churches | church_id UUID PK → churches     |
| church_name               | church_name                      |
| church_address            | address                          |
| tax_id                    | tax_id                           |
| fiscal_year_start         | fiscal_year_start                |
| idle_timeout_min          | idle_timeout_min                 |
| session_max_hours INTEGER | ❌                               |
| currency                  | currency                         |
| updated_by UUID → users   | ❌                               |
| updated_at TIMESTAMPTZ    | updated_at TIMESTAMPTZ           |
| created_at TIMESTAMPTZ    | created_at TIMESTAMPTZ           |

**Impact:** Server doesn't directly write to settings. Frontend accesses via Supabase REST API.

---

### 19. `attachments` — 🔴 CRITICAL (table exists in Drizzle but NOT in Supabase)

The Drizzle schema defines a full `attachments` table with hash-chain columns, but the **Supabase database does NOT have this table**.

**Verdict:** Cannot write. Table must be created first.

---

### 20. `offering_subcategories` — ✅ MATCH

---

### 21. `offering_categories` — ✅ MATCH

---

### 22. `inter_fund_loans` — ❌ NOT IN SUPABASE

Exists in Drizzle as `interFundLoans` but never created in SQL migrations.

---

### 23. `entry_number_counters` — ❌ NOT IN SUPABASE

Exists in Drizzle as `entryNumberCounters` but never created in SQL migrations.

**Impact:** The server's `JournalService.assignEntryNumber()` attempts to write to this table. It will fail if the table doesn't exist.

---

### 24. `line_users` — ✅ MATCH (created by migration 002)

---

## Server Activation Impact Assessment

### Can the server write to the database?

| Server Component                    | Tables Used                                                                        | Compatible? | Blocker                                             |
| ----------------------------------- | ---------------------------------------------------------------------------------- | ----------- | --------------------------------------------------- |
| `JournalService.createEntry()`      | journal_entries, journal_entry_lines, fiscal_periods, funds, chart_of_accounts     | ✅ YES      | None                                                |
| `JournalService.approveEntry()`     | journal_entries, journal_entry_lines, general_ledger, funds, entry_number_counters | **🔴 NO**   | `entry_number_counters` table missing from Supabase |
| `AuditService.log()`                | audit_log                                                                          | **🔴 NO**   | Hash chain columns missing                          |
| `FundService.createFund()`          | funds, chart_of_accounts, audit_log                                                | **🔴 NO**   | audit_log incompatible                              |
| `PeriodService.closePeriod()`       | fiscal_periods, journal_entries, audit_log                                         | **🔴 NO**   | audit_log incompatible                              |
| `TransferService.createTransfer()`  | chart_of_accounts, funds, fiscal_periods, journal_entries, audit_log               | **🔴 NO**   | audit_log incompatible                              |
| `ReconciliationService.reconcile()` | reconciliations, fiscal_periods, audit_log                                         | **🔴 NO**   | audit_log incompatible                              |

**Without fixing the audit_log table, every server service fails.**

---

## Migration Plan (Required Before Server Activation)

### Migration 006: Fix `audit_log` table

```sql
-- Add hash chain columns for AuditService
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS event_type VARCHAR(100);
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50);
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS before_state TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS after_state TEXT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS correlation_id UUID;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS previous_hash VARCHAR(64);
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS current_hash VARCHAR(64);
ALTER TABLE audit_log ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE audit_log ALTER COLUMN entity_id TYPE UUID USING entity_id::uuid;
-- Migrate existing data
UPDATE audit_log SET entity_type = entity;
UPDATE audit_log SET current_hash = 'legacy-' || id;
UPDATE audit_log SET correlation_id = gen_random_uuid() WHERE correlation_id IS NULL;
```

### Migration 007: Add missing columns to `users`

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
```

### Migration 008: Create missing tables

```sql
-- entry_number_counters
CREATE TABLE IF NOT EXISTS entry_number_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  entry_type entry_type NOT NULL,
  fiscal_year INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(church_id, entry_type, fiscal_year)
);

-- attachments (from Drizzle schema)
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);
ALTER TABLE attachments ADD CONSTRAINT chk_file_size CHECK (file_size <= 10485760);

-- inter_fund_loans (from Drizzle schema)
CREATE TABLE IF NOT EXISTS inter_fund_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id),
  from_fund_id UUID NOT NULL REFERENCES funds(id),
  to_fund_id UUID NOT NULL REFERENCES funds(id),
  amount DECIMAL(18,2) NOT NULL,
  expected_repayment_date DATE,
  interest_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'outstanding',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Migration 009: Add `sort_order` to Drizzle schema (code change only)

Add to `funds` table in `src/db/schema.ts`:

```typescript
sortOrder: integer("sort_order").notNull().default(0),
```

---

## Recommended Execution Order

| Step | Description                                 | Risk                       | Depends On         |
| ---- | ------------------------------------------- | -------------------------- | ------------------ |
| 1    | Apply migration 006 (fix audit_log)         | High — column types change | None               |
| 2    | Apply migration 007 (fix users)             | Low — additive             | None               |
| 3    | Apply migration 008 (create missing tables) | Low — additive             | Migrations 006-007 |
| 4    | Apply migration 009 (Drizzle schema update) | Low — additive             | None               |
| 5    | Run Drizzle codegen                         | Low                        | Migration 009      |
| 6    | Verify typecheck passes                     | Low                        | Step 5             |
| 7    | Activate server                             | Medium                     | Steps 1-6          |

**Total: 4 database migrations + 1 Drizzle schema change required before Phase A activation.**

---

## Risk Summary

1. **🔴 audit_log hash chain columns missing** — Blocks all server services that log
2. **🔴 entry_number_counters table missing** — Blocks journal approval flow
3. **🔴 password_hash/password_changed_at missing** — Blocks server auth
4. **🔴 attachments table missing** — Blocks attachment storage integration
5. **🟠 budgets table schemas completely different** — Must resolve before budget features
6. **🟠 members table columns different** — Must resolve before member features
7. **🟠 projects table columns different** — Must resolve before project features
8. **🟠 funds.sort_order missing from Drizzle** — Minor, additive fix
9. **🟠 categories table not in Drizzle** — Low priority

---

## Conclusion

**The server CANNOT safely activate on the current database without schema repairs.**

The good news: The core domain tables that `JournalService` writes to — `journal_entries`, `journal_entry_lines`, `fiscal_periods`, `funds`, `chart_of_accounts`, `general_ledger`, `reconciliations` — are all structurally compatible. The central double-entry accounting engine will work.

The blocking issues are:

1. **`audit_log` columns** — missing hash chain columns
2. **`entry_number_counters` table** — doesn't exist
3. **`users` columns** — missing password_hash
4. **`attachments` table** — doesn't exist

These 4 migrations can be applied independently without data loss and are backward compatible. Recommend proceeding with the migration plan, then Phase A server activation.

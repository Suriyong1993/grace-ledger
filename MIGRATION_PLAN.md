# Grace Ledger v2 — Migration Plan

**Version:** 2.0
**Date:** 22 July 2026
**Purpose:** Complete migration roadmap from current prototype (v1) to production architecture (v2)

---

## Table of Contents

1. [Strategy Overview](#1-strategy-overview)
2. [Persistence Layer](#2-persistence-layer)
3. [Authentication & Session](#3-authentication--session)
4. [Domain Model (Accounting)](#4-domain-model-accounting)
5. [Authorization & Permissions](#5-authorization--permissions)
6. [Transaction Lifecycle & Approval](#6-transaction-lifecycle--approval)
7. [Audit Trail](#7-audit-trail)
8. [Offering & Sunday Count](#8-offering--sunday-count)
9. [Reconciliation](#9-reconciliation)
10. [Budget Management](#10-budget-management)
11. [Reporting & Tax](#11-reporting--tax)
12. [Members & Privacy](#12-members--privacy)
13. [DevOps & Operations](#13-devops--operations)
14. [Data Migration Script](#14-data-migration-script)
15. [Rollback Strategy](#15-rollback-strategy)

---

## 1. Strategy Overview

### 1.1 Migration Principles

1. **Data integrity above all:** No financial data loss is acceptable. Every migration step is verified.
2. **Parallel run:** v1 and v2 can coexist during migration; v1 exports data, v2 imports and transforms it.
3. **Incremental rollout:** Each subsystem migrates independently, verified, then locked before moving to the next.
4. **Rollback capability:** Every migration step has a documented rollback procedure.
5. **User continuity:** v1 users export their data → import into v2. No downtime required during transition.

### 1.2 Migration Sequence

```
Step 0: Data Export from v1 (user-initiated)
  ↓
Step 1: Infrastructure Provisioning (PostgreSQL, Supabase, CI/CD)
  ↓
Step 2: Database Schema Migration (Drizzle migrations)
  ↓
Step 3: Authentication Migration (PIN → bcrypt passwords)
  ↓
Step 4: Data Import & Transformation (v1 records → journal entries)
  ↓
Step 5: Application Service Migration (client-side → server-side)
  ↓
Step 6: Domain Logic Migration (single-entry → double-entry)
  ↓
Step 7: Authorization Migration (client checks → server middleware)
  ↓
Step 8: Audit Trail Migration (mutable → immutable hash chain)
  ↓
Step 9: UI Migration (connect to new API endpoints)
  ↓
Step 10: Cutover & Verification
```

---

## 2. Persistence Layer

### Current State
- **Storage:** `window.localStorage` — single JSON blob per browser
- **Capacity:** ~5-10MB per origin
- **Concurrency:** None — single browser, single tab
- **Backup:** None
- **Attachments:** Base64-encoded in the same localStorage blob

### Problems
- **P0-01:** Browser cache clear = total data loss
- **P0-02:** No atomicity — `updateDb(fn)` is a read-modify-write with no rollback
- **P0-11:** Multi-tab/multi-user corruption guaranteed
- **P1-18:** No backup mechanism
- **P2-06:** localStorage quota exhausted by base64 attachments

### Target Architecture
- **Storage:** PostgreSQL 16 on Supabase
- **ORM:** Drizzle ORM with declarative schema and migrations
- **Attachments:** Supabase Storage (S3-compatible)
- **Backup:** Daily full backups + continuous WAL archiving (PITR)
- **Concurrency:** Optimistic locking (version column) + SERIALIZABLE isolation

### Migration Steps

| Step | Action | Tool | Time |
|------|--------|------|------|
| 2.1 | Provision Supabase project with PostgreSQL 16 | Supabase CLI / Dashboard | 1 day |
| 2.2 | Run Drizzle schema migration (all tables from DATABASE_V2.md) | `bun run db:migrate` | 1 day |
| 2.3 | Configure PITR and daily backups | Supabase Dashboard | 1 day |
| 2.4 | Create storage bucket for attachments | Supabase Storage | 0.5 day |
| 2.5 | Implement repository layer (Drizzle queries) | TypeScript | 5 days |
| 2.6 | Implement migration script (v1 JSON → v2 PostgreSQL) | TypeScript | 3 days |
| 2.7 | Seed COA with default Thai church chart of accounts | Migration script | 1 day |

### Risks
- **Migration data corruption:** Mitigated by validation queries (Σ debits = Σ credits) after import
- **Supabase region latency:** Choose Southeast Asia region (Singapore)
- **LocalStorage data extraction failure:** v1 user must export data before clearing browser

### Dependencies
- None (first migration step)

### Estimated Effort
**10 days** (1 backend engineer + 1 DevOps)

---

## 3. Authentication & Session

### Current State
- **Method:** 6-digit numeric PIN, stored in plaintext in localStorage
- **Session:** `session.userId` field in the same JSON blob as financial data
- **MFA:** None
- **Rate Limiting:** None
- **Timeout:** `idleTimeoutMin` setting exists but is never enforced

### Problems
- **P0-09:** 6-digit PIN (~20 bits entropy) — trivially brute-forced
- **P3-08:** Session stored in same DB as financial data — no isolation
- **P1-17:** No session timeout enforcement
- **14.3:** Plaintext PIN storage

### Target Architecture
- **Method:** Password-based with argon2id hashing
- **Session:** httpOnly JWT cookie (`gl_session`) — Secure, SameSite=Strict
- **MFA:** TOTP-based, mandatory for super_admin and treasurer
- **Rate Limiting:** 5 failed attempts → 15-minute lockout
- **Timeout:** Enforced idle timeout based on configurable `idleTimeoutMin`

### Migration Steps

| Step | Action | Time |
|------|--------|------|
| 3.1 | Add password_hash, mfa_secret, failed_attempts, locked_until columns to users table | 0.5 day |
| 3.2 | Implement PasswordService (argon2id hash/verify) | 1 day |
| 3.3 | Implement SessionService (JWT create/validate/revoke) | 2 days |
| 3.4 | Implement LoginRateLimiter (per-user + per-IP) | 1 day |
| 3.5 | Implement MFAService (TOTP enroll/verify) | 2 days |
| 3.6 | Implement session timeout enforcement middleware | 1 day |
| 3.7 | Create user_sessions table and session cleanup job | 1 day |
| 3.8 | Migrate existing users: hash PINs → passwords; notify users | 1 day |

### Risks
- **User lockout during transition:** Provide transition period where v1 PINs work via a migration endpoint
- **Password reset requests:** Implement admin password reset flow before migration
- **MFA rollout for non-technical users:** Provide printed setup guide and in-person assistance

### Dependencies
- Persistence Layer (PostgreSQL must be available)

### Estimated Effort
**8 days** (1 security engineer + 1 backend engineer)

---

## 4. Domain Model (Accounting)

### Current State
- **Model:** Three independent lists: `Income[]`, `Expense[]`, `Offering[]`
- **Categories:** Flat `Category { id, name, kind }` with no account codes
- **Funds:** `Fund { id, name, openingBalance }` — balance computed ad-hoc
- **Transfers:** Two independent records (expense + income) with no linking

### Problems
- **P0-04:** No double-entry bookkeeping — cannot guarantee balanced books
- **P0-05:** Fund balance computed, not stored — no authoritative balance
- **P0-06:** No chart of accounts — no 1xxx-5xxx structure
- **P0-07:** No period controls — transactions in any past period
- **P1-02:** Fiscal year start setting never consumed
- **P1-03:** Fund opening balance is negative (-7,553)
- **P1-05:** Fund transfers not atomic
- **P2-07:** Income and Offering represented as separate types with different schemas

### Target Architecture
- **Model:** Double-entry: Journal Entry → Journal Lines → General Ledger
- **Chart of Accounts:** 1xxx Assets, 2xxx Liabilities, 3xxx Equity, 4xxx Income, 5xxx Expenses
- **Funds:** Each fund is an equity account with a stored running balance
- **Transfers:** Single atomic journal entry: Debit source fund equity, Credit destination fund equity
- **Unified transactions:** All financial operations create journal entries with `entry_type` discriminator

### Migration Steps

| Step | Action | Time |
|------|--------|------|
| 4.1 | Seed chart of accounts (DEFAULT_CHART_OF_ACCOUNTS from ACCOUNTING_ENGINE.md) | 0.5 day |
| 4.2 | Implement Money value object (satang-based, exact precision) | 1 day |
| 4.3 | Implement JournalService (create, validate balance, post to GL) | 4 days |
| 4.4 | Implement GeneralLedgerPostingEngine (running balances) | 3 days |
| 4.5 | Implement FundAccountingService (balance validation, transfers) | 3 days |
| 4.6 | Implement PeriodService (open/close/reopen with validations) | 4 days |
| 4.7 | Implement TrialBalanceService | 2 days |
| 4.8 | Map v1 records to journal entries in migration script | 5 days |

### v1 → v2 Data Mapping

| v1 Record Type | → v2 Journal Entry | Debit Account | Credit Account |
|---------------|-------------------|---------------|----------------|
| Offering | `entry_type: 'offering'` | 1-1001 Cash (if cash) / 1-1002 Bank (if bank) | 4-4xxx Income (based on offering category) |
| Expense | `entry_type: 'expense'` | 5-5xxx Expense (based on category) | 1-1001 Cash |
| Income | `entry_type: 'income'` | 1-1001 Cash | 4-4xxx Income (based on category) |
| Fund Transfer | `entry_type: 'transfer'` | 3-3xxx Source fund equity | 3-3xxx Dest fund equity |

### Risks
- **Double-entry implementation errors:** Engage accounting consultant for review; run 100+ test cases
- **Fund balance mismatch after migration:** Reconcile each fund's v1 computed balance against v2 stored balance
- **Historical data with missing info:** Default to "cash" channel and "f1" fund where information is missing

### Dependencies
- Persistence Layer (PostgreSQL with COA seeded)
- Authentication Layer (to record `created_by`)

### Estimated Effort
**22 days** (2 backend engineers + 1 financial domain expert)

---

## 5. Authorization & Permissions

### Current State
- **Matrix:** `MATRIX: Record<Role, Permission[]>` — checked client-side only
- **Enforcement:** `can(perm)` in React components for UI hiding
- **Service functions:** `by: User` parameter is decorative — used for audit, not auth

### Problems
- **P1-16:** All permission checks are client-side only — bypassable via DevTools
- **P3-06:** Permission matrix has overlaps — treasurer can create offerings (no approval needed)
- **P3-07:** Sidebar shows all menu items regardless of role

### Target Architecture
- **Enforcement:** Server-side middleware (`requirePermission()`) on every server function
- **Layers:** Middleware → Domain rules → RLS at database
- **Matrix:** V2 matrix (AUTHORIZATION_MODEL.md) with cleaner separation
- **UI hiding:** Sidebar filtered by role (UX only, not security)

### Migration Steps

| Step | Action | Time |
|------|--------|------|
| 5.1 | Define v2 permission types and matrix (AUTHORIZATION_MODEL.md) | 0.5 day |
| 5.2 | Implement `requirePermission()` middleware | 1 day |
| 5.3 | Apply middleware to all server functions | 2 days |
| 5.4 | Remove client-side `can()` from all service function calls | 1 day |
| 5.5 | Implement RLS policies on PostgreSQL tables | 2 days |
| 5.6 | Filter sidebar navigation by role | 0.5 day |
| 5.7 | Test every role × every operation combination | 2 days |

### Risks
- **Role misconfiguration blocking legitimate operations:** Exhaustive permission test suite
- **Existing users assigned wrong roles:** Audit user roles during migration; church pastor reviews

### Dependencies
- Authentication Layer (session must be validated before permission check)
- Persistence Layer (RLS policies require PostgreSQL tables)

### Estimated Effort
**7 days** (1 security engineer + 1 QA)

---

## 6. Transaction Lifecycle & Approval

### Current State
- **State machine:** Not enforced — `setExpenseStatus()` accepts any status transition
- **Approval:** Checkbox UI but no validation of transition validity
- **Self-approval:** No check that creator ≠ approver
- **Deletion:** `deleteExpense()` / `deleteIncome()` works at any status including `approved`

### Problems
- **P0-08:** Status transitions not enforced
- **P1-06:** No segregation of duties (self-approval possible)
- **P1-07:** Rejection has no reason field
- **P1-11:** Expenses deletable at any status
- **P1-12:** Income deletable at any status
- **P2-02:** No amount-based tiered approval

### Target Architecture
- **State machine:** Implemented as TransactionStateMachine (TRANSACTION_ENGINE.md)
- **Approval:** Tiered: <฿5,000 single, ฿5k-50k pastor, >฿50k dual approval
- **Self-approval:** Server-side check `createdBy !== approvedBy`
- **Deletion:** Void-only for approved entries; soft-delete for draft/rejected

### Migration Steps

| Step | Action | Time |
|------|--------|------|
| 6.1 | Implement TransactionStateMachine with valid transitions | 3 days |
| 6.2 | Implement ApprovalService with tiered thresholds | 3 days |
| 6.3 | Implement self-approval prevention check | 0.5 day |
| 6.4 | Implement void workflow (reversing journal entries) | 2 days |
| 6.5 | Implement soft-delete with 30-day recovery | 2 days |
| 6.6 | Add rejection_reason field to journal_entries + UI | 1 day |
| 6.7 | Implement sequential entry numbering (EXP-2026-0001) | 2 days |

### Risks
- **Approval workflow disrupting church operations:** Make thresholds configurable per-church
- **Historical data status:** All v1 approved records become `status: 'approved'` in v2 by default

### Dependencies
- Domain Model (journal entries must exist)
- Authorization (approval permission checks)

### Estimated Effort
**12 days** (2 backend engineers + 1 frontend engineer)

---

## 7. Audit Trail

### Current State
- **Storage:** Same localStorage JSON blob as all data
- **Capacity:** Capped at 500 entries — oldest silently discarded
- **Content:** Action + entity ID only — no before/after state, no amounts
- **Integrity:** No cryptographic verification; trivially deletable

### Problems
- **P0-10:** Audit trail client-side, mutable, truncated — fails external audit
- **15.2:** No retention policy
- **15.3:** No IP/device metadata

### Target Architecture
- **Storage:** Append-only PostgreSQL table with GRANT INSERT, SELECT only
- **Content:** Full before/after JSONB snapshots; change_summary; forensic metadata
- **Integrity:** SHA-256 hash chain; verifiable by external auditor
- **Retention:** 7 years (active) + cold archive after
- **Forwarding:** Optional SIEM export for independent copy

### Migration Steps

| Step | Action | Time |
|------|--------|------|
| 7.1 | Create audit_log table with hash columns and permissions | 1 day |
| 7.2 | Implement AuditHashService (compute, verify chain) | 2 days |
| 7.3 | Implement AuditInterceptor (before/after capture in transactions) | 3 days |
| 7.4 | Wire interceptor into all service methods | 2 days |
| 7.5 | Implement audit integrity verification endpoint | 1 day |
| 7.6 | Implement audit log viewer UI with filtering | 3 days |
| 7.7 | Implement SIEM forwarder (optional) | 2 days |
| 7.8 | Remove v1 localStorage audit log (replace with new implementation) | 1 day |

### Risks
- **Hash chain performance with high volume:** Hash computation is O(1) per entry; no performance concern
- **JSONB storage growth:** Partition audit_log by year; archive entries older than 7 years

### Dependencies
- Persistence Layer
- Domain Model (must know which events to audit)
- Authentication (must know who performed action)

### Estimated Effort
**12 days** (1 backend engineer + 1 security engineer + 1 frontend engineer)

---

## 8. Offering & Sunday Count

### Current State
- **Sunday count:** Three counter names are free-text (not authenticated users)
- **Count verification:** No independent entry — single user enters all counters' data
- **Fund assignment:** Hardcoded to `fundId: "f1"` in SundayCountSheet
- **Approval:** Offerings have no `status` field — bypass entire approval workflow
- **Correction:** Only `deleteOffering()` — no update/correction workflow

### Problems
- **P1-08:** Offerings have no status/approval — committed immediately
- **P1-09:** No independent counter verification — single-person cash count = fraud vector
- **P1-10:** All Sunday offerings hardcoded to Fund f1
- **P2-03:** No offering correction workflow
- **P2-04:** Member not linked to offering records

### Target Architecture
- **Sunday count:** Minimum 2 authenticated users as counters; independent entry; system comparison
- **Fund assignment:** User selects destination fund per offering row
- **Approval:** Offerings go through same approval workflow as income
- **Correction:** Create correction record with full audit trail
- **Member linkage:** Dropdown to select member (from members table)

### Migration Steps

| Step | Action | Time |
|------|--------|------|
| 8.1 | Redesign SundayCountSheet to require authenticated counters | 2 days |
| 8.2 | Implement independent counter entry (counters enter separately) | 3 days |
| 8.3 | Implement counter reconciliation UI (compare amounts, flag discrepancies) | 2 days |
| 8.4 | Add fund selection per offering row | 1 day |
| 8.5 | Add member linkage per offering row | 1 day |
| 8.6 | Wire offerings through approval workflow (same as income) | 1 day |
| 8.7 | Implement offering correction (update with audit trail) | 2 days |

### Risks
- **Two counters not always available:** Allow single counter for small churches with pastor override
- **Counter authentication on shared device:** Support PIN-based re-authentication for counters on shared kiosk

### Dependencies
- Transaction Lifecycle (approval workflow)
- Member Management (member linkage)

### Estimated Effort
**10 days** (2 full-stack engineers)

---

## 9. Reconciliation

### Current State
- **Calculation:** Client-side `useMemo` — not persisted
- **Actual balance:** `useState` — lost on page refresh
- **Period locking:** None — transactions can be modified after "reconciliation"
- **Per-fund breakdown:** Uses all-time data instead of period-specific data (inconsistent)

### Problems
- **P1-14:** Reconciliation is a calculator, not a reconciliation — not persisted; no period locking

### Target Architecture
- **Persisted records:** Each reconciliation stored as immutable `ReconciliationRecord`
- **Period chaining:** Current period's opening balance = prior period's closing balance
- **Period locking:** After all funds reconciled for a period → period becomes `reconciled`
- **Fund-specific:** Each fund reconciled independently; per-fund variance tracked

### Migration Steps

| Step | Action | Time |
|------|--------|------|
| 9.1 | Implement ReconciliationService (balance calculation, variance, period chaining) | 4 days |
| 9.2 | Create reconciliation UI (fund list, system balance display, actual balance input) | 3 days |
| 9.3 | Implement reconciliation locking (period status → reconciled) | 1 day |
| 9.4 | Remove v1 client-side reconciliation code | 1 day |

### Risks
- **Prior period unreconciled blocks current period close:** Provide clear error messaging and escalation path
- **Bank statement timing mismatch:** Allow explanatory variance notes; auditor reviews

### Dependencies
- Domain Model (journal entries, general ledger, periods)
- Period Management (period must be closed before reconciliation)

### Estimated Effort
**7 days** (1 backend engineer + 1 frontend engineer)

---

## 10. Budget Management

### Current State
- **Tracking:** `Budget.used` field exists but is never updated — always 0
- **CRUD:** `listBudget()` only — no create/update/delete
- **Period validation:** No enforcement of budget period types

### Problems
- **P2-08:** Budget 'used' field never updated — budget tracking completely broken
- **P2-09:** No budget creation/approval workflow
- **P2-10:** No budget period enforcement

### Target Architecture
- **Dynamic calculation:** Budget utilization computed from general ledger query (no stored 'used' field)
- **CRUD:** Full create/read/update/delete with approval workflow
- **Validation:** DB CHECK constraints enforce period type rules

### Migration Steps

| Step | Action | Time |
|------|--------|------|
| 10.1 | Remove `used` column from budgets table | 0.5 day |
| 10.2 | Implement dynamic budget utilization query (GL aggregation) | 2 days |
| 10.3 | Implement budget CRUD server functions with approval workflow | 3 days |
| 10.4 | Build budget management UI (create, approve, view utilization) | 3 days |
| 10.5 | Add budget period validation constraints | 1 day |

### Risks
- **Budget data loss:** Existing budget seed data may have been entered manually; verify before migration

### Dependencies
- Domain Model (general ledger must exist to calculate utilization)
- Transaction Lifecycle (approval workflow)

### Estimated Effort
**8 days** (1 backend engineer + 1 frontend engineer)

---

## 11. Reporting & Tax

### Current State
- **Reports:** 6-month summary table only — no formal financial statements
- **Date filtering:** `date.startsWith()` string matching (fragile)
- **Tax compliance:** No donor receipts, no WHT tracking, no annual member statements

### Problems
- **P1-15:** No balance sheet, income statement, or cash flow statement
- **P2-19:** No Thai tax compliance features
- **P3-04:** Reports use string-based date filtering
- **P3-05:** Export functions have no data validation

### Target Architecture
- **Financial statements:** Balance sheet, income statement, cash flow statement generated server-side
- **Tax receipts:** ใบอนุโมทนาบัตร with sequential receipt numbers; annual member giving statements
- **WHT tracking:** Salary journal entries with withholding tax payable
- **Date filtering:** Proper date range queries with bounds

### Migration Steps

| Step | Action | Time |
|------|--------|------|
| 11.1 | Implement ReportService (balance sheet, income statement, cash flow) | 5 days |
| 11.2 | Build report UI with period selection and rendering | 3 days |
| 11.3 | Implement donor tax receipt generation (ใบอนุโมทนาบัตร) | 3 days |
| 11.4 | Implement annual member giving statement generation | 2 days |
| 11.5 | Add WHT and SSO tracking to salary journal entries | 3 days |
| 11.6 | Fix all date filtering to use proper range queries | 1 day |
| 11.7 | Add export data validation (column definitions vs. data keys) | 1 day |

### Risks
- **Financial statement accuracy:** Verify against trial balance; involve accounting consultant for review
- **Tax receipt regulatory compliance:** Consult with Thai tax advisor on receipt format requirements

### Dependencies
- Domain Model (trial balance, general ledger)
- Member Management (member giving statements)

### Estimated Effort
**15 days** (1 backend engineer + 1 frontend engineer + 1 tax consultant)

---

## 12. Members & Privacy

### Current State
- **PII:** Member phone/email/address stored alongside financial data — no access control
- **Consent:** No consent tracking mechanism
- **PDPA:** No compliance features

### Problems
- **P2-20:** No data privacy controls
- **P3-07:** No role-based PII masking

### Target Architecture
- **PII masking:** API response DTO masks PII based on viewer's role
- **Consent tracking:** `consent_given` + `consent_date` fields; consent required for statements
- **PDPA:** Member data export and anonymization endpoints

### Migration Steps

| Step | Action | Time |
|------|--------|------|
| 12.1 | Add consent fields to members table | 0.5 day |
| 12.2 | Implement PII masking in API response DTOs | 1 day |
| 12.3 | Add consent collection UI | 1 day |
| 12.4 | Implement member data export endpoint | 1 day |
| 12.5 | Implement member anonymization endpoint | 1 day |

### Risks
- **Existing members without consent:** Default to `consent_given = false`; prompt for consent on first use

### Dependencies
- Authorization (role-based PII visibility)

### Estimated Effort
**4 days** (1 full-stack engineer)

---

## 13. DevOps & Operations

### Current State
- **Build:** `vite build` works but no production deployment config
- **Monitoring:** No error tracking; no health endpoints
- **Testing:** Zero tests
- **Error handling:** Corrupted data silently replaced with seed data

### Problems
- **P0-12:** No production build configuration
- **P2-12:** No error boundary — corrupt localStorage → silent data loss
- **P2-17:** No automated testing
- **P2-18:** No API versioning

### Target Architecture
- **CI/CD:** GitHub Actions — build, lint, type-check on PR
- **Monitoring:** Sentry for errors; Pino for structured logging; health check endpoint
- **Testing:** Unit tests (80% service coverage), integration tests for critical workflows, financial regression tests
- **API versioning:** `/api/v1/` prefix; OpenAPI/Swagger documentation

### Migration Steps

| Step | Action | Time |
|------|--------|------|
| 13.1 | Set up GitHub Actions CI/CD pipeline | 2 days |
| 13.2 | Configure Sentry SDK and error boundaries | 1 day |
| 13.3 | Implement health check endpoint | 0.5 day |
| 13.4 | Set up Pino structured logging | 1 day |
| 13.5 | Write unit tests for all services (target 80%) | 8 days |
| 13.6 | Write integration tests for critical workflows | 5 days |
| 13.7 | Write financial regression tests | 4 days |
| 13.8 | Write permission matrix tests | 4 days |
| 13.9 | Implement API versioning and OpenAPI docs | 3 days |
| 13.10 | Set up staging environment on Supabase | 1 day |

### Risks
- **Test coverage gaps:** Prioritize financial calculation tests over UI tests

### Dependencies
- All prior migrations (testing requires complete system)

### Estimated Effort
**25 days** (1 DevOps + 1 QA + 1 backend engineer)

---

## 14. Data Migration Script

### 14.1 Export from v1

```typescript
// Added to v1 application as an export feature
function exportV1Data(): string {
  const db = loadDb(); // localStorage
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      users: db.users,
      funds: db.funds,
      offerings: db.offerings,
      expenses: db.expenses,
      incomes: db.incomes,
      members: db.members,
      budgets: db.budgets,
      projects: db.projects,
      categories: db.categories,
      settings: db.settings,
    },
  });
}
```

### 14.2 Import into v2

```typescript
// src/server/migrations/import-v1-data.ts
async function importV1Data(jsonExport: string): Promise<ImportReport> {
  const input = JSON.parse(jsonExport);
  const report: ImportReport = {
    users: 0, funds: 0, offerings: 0, expenses: 0, incomes: 0,
    journalEntries: 0, errors: [],
  };

  await db.transaction(async (tx) => {
    // 1. Import users (with password reset required)
    for (const user of input.data.users) {
      const passwordHash = await hashPassword(user.pin); // Hash PIN as initial password
      await tx.insert(users).values({
        id: user.id,
        name: user.name,
        role: user.role,
        passwordHash,
        passwordChangedAt: new Date(), // Force password change on first login
      });
      report.users++;
    }

    // 2. Import funds as equity accounts
    for (const fund of input.data.funds) {
      // Each fund gets a COA account and a fund record
      await tx.insert(chartOfAccounts).values({
        accountCode: `3-${3001 + report.funds}`,
        accountName: fund.name,
        accountType: 'equity',
        normalBalance: 'credit',
      });
      // ... also create fund record with reference to COA account
      report.funds++;
    }

    // 3. Convert offerings to journal entries
    for (const offering of input.data.offerings) {
      const entryNumber = await nextSequence('OFF', getFiscalYear(offering.date));
      await createJournalEntry(tx, {
        entryType: 'offering',
        entryNumber,
        postingDate: offering.date,
        status: 'approved', // v1 offerings were always approved
        fundId: offering.fundId,
        createdBy: offering.createdBy,
        lines: [
          { accountId: '1-1001', type: 'debit', amount: offering.amount },
          { accountId: getIncomeAccount(offering.categoryId), type: 'credit', amount: offering.amount },
        ],
      });
      report.offerings++;
      report.journalEntries++;
    }

    // 4. Convert expenses to journal entries (similar)
    // 5. Convert incomes to journal entries (similar)

    // 6. Verify: Σ debits = Σ credits
    const trialBalance = await computeTrialBalance(tx);
    if (!trialBalance.isBalanced) {
      throw new Error('Migration produced unbalanced books!');
    }
  });

  return report;
}
```

### 14.3 Validation Queries

```sql
-- After migration, verify:
-- 1. Total debits = total credits
SELECT SUM(total_debit) - SUM(total_credit) AS imbalance
FROM journal_entries;

-- 2. Fund balances match v1 computed values
SELECT f.name, f.current_balance, f.opening_balance
FROM funds f;

-- 3. No orphan journal lines
SELECT COUNT(*) FROM journal_entry_lines jel
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE je.id IS NULL;

-- 4. GL running balances are consistent
-- (Sample check: verify the latest running_balance per account)
```

---

## 15. Rollback Strategy

### 15.1 Per-Subsystem Rollback

| Subsystem | Rollback Method | Data Impact |
|-----------|----------------|-------------|
| Persistence | Keep v1 localStorage intact during migration; export backup before any DB write | None (v1 data preserved) |
| Authentication | v1 login endpoint remains active until all users migrated | None |
| Domain Model | Migration script is idempotent — can re-run after fixes | v2 data is re-imported |
| Authorization | Permission matrix is configuration; can revert to v1 matrix | None |
| Audit Trail | New audit_log table is independent of business data | No audit data loss |

### 15.2 Full Rollback

If a critical issue is discovered after cutover:
1. Export all v2 data from PostgreSQL (pg_dump)
2. Re-import v1 data from the backup export file into v1 application
3. Fix the issue in v2
4. Re-run migration after fix validated in staging

### 15.3 Cutover Checklist

- [ ] All v1 data exported and verified (checksum)
- [ ] V2 migration script run and trial balance verified (Σ debits = Σ credits)
- [ ] Fund balances in v2 match v1 computed balances
- [ ] All users can login with new password flow
- [ ] Critical workflows tested: create offering → approve → verify balance change
- [ ] Sunday count sheet tested with 2 independent counters
- [ ] Reconciliation tested for one period
- [ ] Audit trail integrity verified
- [ ] Backup schedule confirmed (daily full + PITR)
- [ ] Church pastor + treasurer sign-off obtained

---

*This migration plan covers all subsystems from the current v1 prototype to the production-grade v2 architecture. Each section identifies the current state, problems (mapped to audit findings), target architecture, step-by-step migration actions, risks, dependencies, and estimated effort. No subsystem is left undocumented.*

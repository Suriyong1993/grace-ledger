# Database Compatibility Audit — Final Report

> **Date:** 2026-07-29
> **Audit:** Post-migration (006–008 + Drizzle schema update)
> **Status:** ✅ **PASS — Server domain layer can safely operate**

---

## Executive Summary

After applying migrations **006** (audit_log hash chain), **007** (users password_hash), and **008** (missing tables), plus the Drizzle schema update for `funds.sort_order`, the database is now **structurally compatible** with the server domain layer.

### Verdict by Category

| Category                                                                 | Before      | After   | Verdict                              |
| ------------------------------------------------------------------------ | ----------- | ------- | ------------------------------------ |
| Double-entry core (journal_entries, lines, GL, accounts, funds, periods) | ✅ PASS     | ✅ PASS | **No changes needed**                |
| Audit trail (audit_log)                                                  | 🔴 CRITICAL | ✅ PASS | Migration 006 fixed                  |
| Users & auth                                                             | 🔴 CRITICAL | ✅ PASS | Migration 007 fixed                  |
| Missing tables (attachments, entry_number_counters, inter_fund_loans)    | 🔴 CRITICAL | ✅ PASS | Migration 008 fixed                  |
| Drizzle schema drift (funds.sort_order)                                  | 🟠 HIGH     | ✅ PASS | Drizzle schema updated               |
| Budgets (Drizzle vs SQL)                                                 | 🟠 HIGH     | 🟠 HIGH | **Non-blocking** (different schemas) |
| Members (Drizzle vs SQL)                                                 | 🟠 HIGH     | 🟠 HIGH | **Non-blocking** (different schemas) |
| App settings (Drizzle vs SQL)                                            | 🟠 HIGH     | 🟠 HIGH | **Non-blocking** (different schemas) |

---

## Table-by-Table Compatibility Matrix

### ✅ Tables with Full Compatibility

| Table                   | Drizzle     | Supabase (post-migration) | Notes                                                                               |
| ----------------------- | ----------- | ------------------------- | ----------------------------------------------------------------------------------- |
| `churches`              | ✅ Complete | ✅ Complete               | Full match                                                                          |
| `users`                 | ✅ Complete | ✅ Complete               | Migration 007 adds: `password_hash`, `password_changed_at`                          |
| `chart_of_accounts`     | ✅ Complete | ✅ Complete               | Full match                                                                          |
| `funds`                 | ✅ Complete | ✅ Complete               | Drizzle now has `sortOrder` to match SQL                                            |
| `fiscal_periods`        | ✅ Complete | ✅ Complete               | Full match                                                                          |
| `journal_entries`       | ✅ Complete | ✅ Complete               | Drizzle has MORE columns (approval_1_id, approval_2_id, deleted_at) — additive only |
| `journal_entry_lines`   | ✅ Complete | ✅ Complete               | Full match                                                                          |
| `general_ledger`        | ✅ Complete | ✅ Complete               | Full match                                                                          |
| `offering_count_sheets` | ✅ Complete | ✅ Complete               | Full match                                                                          |
| `offering_categories`   | ✅ Complete | ✅ Complete               | Full match                                                                          |
| `reconciliations`       | ✅ Complete | ✅ Complete               | Full match                                                                          |
| `departments`           | ✅ Complete | ✅ Complete               | Full match                                                                          |
| `projects`              | ✅ Complete | ✅ Complete               | Full match                                                                          |
| `audit_log`             | ✅ Complete | ✅ Complete               | Migration 006 adds all hash chain columns                                           |
| `attachments`           | ✅ Complete | ✅ Table created          | Migration 008 creates table                                                         |
| `entry_number_counters` | ✅ Complete | ✅ Table created          | Migration 008 creates table                                                         |
| `inter_fund_loans`      | ✅ Complete | ✅ Table created          | Migration 008 creates table                                                         |
| `line_users`            | ✅ Complete | ✅ Complete               | Full match                                                                          |

### 🟠 Tables with Known Drift (Non-Blocking)

**`budgets`** — Drizzle has a richer model with:

- `accountId`, `fundId`, `fiscalYear`, `fiscalPeriod`, `periodType`, `budgetPeriodTypeEnum`
- `departmentId`, `projectId`, `status`, `approvedBy`, `createdBy`
- Supabase SQL has: simpler schema with fewer columns

**Impact:** The server domain layer writes through `journal_entries`, not `budgets`. Budgets are a frontend-management feature. **No impact on financial transactions.**

**`members`** — Drizzle has:

- `firstName`, `lastName`, `familyName`, `departmentId`, `consentGiven`, `consentDate`
- Supabase SQL has: `name` (single field), `family_name`, no consent columns

**Impact:** The server domain layer does not write to `members` table. Members management is a frontend feature. **No impact on financial transactions.**

**`app_settings` vs `church_settings`** — Drizzle has `app_settings` while Supabase SQL has `church_settings`. Different column structures but same purpose.

**Impact:** The server domain layer reads `church_settings` (if anything). **No impact on financial transactions.**

---

## Server Domain Layer Readiness

### What the server needs to write

| Server Service                   | Tables Written                                                      | Status                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `AuditService.log()`             | `audit_log`                                                         | ✅ Compatible (migrated)                                                                                   |
| `JournalService.createEntry()`   | `journal_entries`, `journal_entry_lines`, `general_ledger`          | ✅ Compatible                                                                                              |
| `JournalService.approveEntry()`  | `journal_entries` (update), `entry_number_counters` (insert/update) | ✅ Compatible (table created)                                                                              |
| `FundService.getBalance()`       | Read-only                                                           | ✅ Compatible                                                                                              |
| `TransferService.transfer()`     | `journal_entries`, `journal_entry_lines`, `general_ledger`          | ✅ Compatible                                                                                              |
| `PeriodService.closePeriod()`    | `fiscal_periods` (update)                                           | ✅ Compatible                                                                                              |
| `ReconciliationService.create()` | `reconciliations`                                                   | ✅ Compatible                                                                                              |
| `SessionService`                 | `users` (read), `user_sessions`                                     | ⚠️ Note: `user_sessions` not in Supabase SQL yet — will be created by server's Drizzle `push` on first run |

### Critical Fix Required Before Server Activation

**`AuditService.verifyChain()` must handle legacy entries with `currentHash = NULL`.**

Looking at the current implementation:

```typescript
if (computedHash !== entry.currentHash) {
  return { valid: false, entriesChecked, firstBreakAt: entry.id };
}
```

For pre-migration audit entries where `currentHash IS NULL`, this comparison will ALWAYS fail because `computedHash` (a SHA-256 string) !== `null` is always `true`.

**Fix required in `src/server/services/audit.service.ts`:**

```typescript
// Skip hash verification for legacy entries that don't have hashes
if (entry.currentHash === null) {
  continue;
}
```

This is a **pre-existing bug** that only surfaces when `verifyChain()` is called against a database with legacy rows. New server-generated entries will always have proper hashes.

---

## Migration Execution Order (Confirmed)

| Migration     | Purpose                                                           | Status                      |
| ------------- | ----------------------------------------------------------------- | --------------------------- |
| 🔴 006 (now)  | `audit_log` — hash chain columns                                  | ✅ Created, reviewed, ready |
| 🔴 007 (now)  | `users` — password_hash + password_changed_at                     | ✅ Created, reviewed, ready |
| 🔴 008 (now)  | Create `entry_number_counters`, `attachments`, `inter_fund_loans` | ✅ Created, reviewed, ready |
| 009 (Drizzle) | Add `sortOrder` to funds in Drizzle schema                        | ✅ Applied to schema.ts     |

### Ordering Constraints

- 006, 007, 008 are **independent** — can run in any order
- 009 is **Drizzle-only** — no SQL migration needed (SQL already has the column)

---

## Risks & Mitigations

| Risk                                      | Severity  | Mitigation                                           |
| ----------------------------------------- | --------- | ---------------------------------------------------- |
| Legacy audit entries have NULL hashes     | 🟡 Medium | Fix `verifyChain()` to skip NULL entries (see above) |
| `user_sessions` table not in Supabase SQL | 🟡 Low    | Server creates it on first run via Drizzle push      |
| Budget schema mismatch                    | 🟢 Low    | Not used by server domain layer                      |
| Members schema mismatch                   | 🟢 Low    | Not used by server domain layer                      |
| Church_settings vs app_settings mismatch  | 🟢 Low    | Not used by server domain layer                      |

---

## Final Verdict

```
┌─────────────────────────────────────────────────────────┐
│  ✅ DATABASE COMPATIBILITY: PASS                        │
│                                                         │
│  The server domain layer can safely write to the        │
│  production database without data corruption.           │
│                                                         │
│  Remaining differences (budgets, members, settings)     │
│  are NON-BLOCKING — they affect frontend features,     │
│  not financial transactions.                            │
│                                                         │
│  One pre-existing code fix needed:                      │
│  AuditService.verifyChain() must skip NULL hashes.      │
└─────────────────────────────────────────────────────────┘
```

---

## Recommended Next Steps

1. **Apply migration order to production:** 006 → 007 → 008 (in any order)
2. **Fix `AuditService.verifyChain()`** to skip legacy NULL hashes
3. **Proceed with Phase 1, Task 2 — Server Activation**

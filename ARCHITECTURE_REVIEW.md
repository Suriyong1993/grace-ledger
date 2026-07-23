# Grace Ledger v2 — Architecture Review Board Report

**Date:** 22 July 2026
**Review Type:** Independent Architecture Review
**Reviewers:** Architecture Review Board (simulated)
**Documents Reviewed:** 10 architecture documents
**Review Scope:** Architecture only — no code review

---

## Table of Contents

1. [Overall Score](#1-overall-score)
2. [Executive Summary](#2-executive-summary)
3. [Critical Findings](#3-critical-findings)
4. [Major Findings](#4-major-findings)
5. [Minor Findings](#5-minor-findings)
6. [Positive Decisions](#6-positive-decisions)
7. [Cross-Document Contradictions](#7-cross-document-contradictions)
8. [Database Review](#8-database-review)
9. [Accounting Review](#9-accounting-review)
10. [Security Review](#10-security-review)
11. [Operational Review](#11-operational-review)
12. [Alternative Designs](#12-alternative-designs)
13. [Risk Matrix](#13-risk-matrix)
14. [Scalability Assessment](#14-scalability-assessment)
15. [Compliance Assessment](#15-compliance-assessment)
16. [Final Scores](#16-final-scores)
17. [Final Recommendation](#17-final-recommendation)

---

## 1. Overall Score

| Category | Score | Max |
|----------|-------|-----|
| Production Readiness | 62 | 100 |
| Implementation Readiness | 71 | 100 |
| Maintainability | 68 | 100 |
| Scalability | 55 | 100 |
| Security | 67 | 100 |
| Accounting Integrity | 65 | 100 |
| Operational Readiness | 44 | 100 |
| **Composite** | **62** | **100** |

**Grade: C+ — NOT READY FOR PRODUCTION DEPLOYMENT**

The architecture is fundamentally well-intentioned and the team clearly understands the domain. However, this architecture CANNOT be deployed to manage real church finances in its current documented state. There are 6 critical findings that would cause financial data corruption, audit failure, or security breaches in production. An additional 18 major findings represent significant risk.

---

## 2. Executive Summary

Grace Ledger v2 represents a massive improvement over the v1 prototype. The shift from client-side localStorage to a server-authoritative PostgreSQL double-entry system is the right direction. The team has clearly studied church accounting requirements and Thai regulatory context.

However, the architecture documents contain **contradictions between each other**, **accounting gaps that would fail an audit**, **security weaknesses that expose church funds to insider fraud**, **operational blind spots that would cause data loss in a disaster**, and **scalability assumptions that break at 100 churches**.

The most concerning pattern is **cross-document inconsistency**. Different documents describe different implementations for the same subsystem. For example, the Approval Workflow is described three different ways across BUSINESS_RULES.md, AUTHORIZATION_MODEL.md, and TRANSACTION_ENGINE.md — and they disagree on who can approve sub-฿5,000 transactions.

This architecture needs **8-12 weeks of focused remediation** before any code should be written. The documents must be reconciled first.

---

## 3. Critical Findings

### CF-1: Treasurer Approval Authority Contradiction Creates Fraud Vector

**Severity:** CRITICAL
**Affected Documents:** BUSINESS_RULES.md §3.1, AUTHORIZATION_MODEL.md §2.1

BUSINESS_RULES.md APV-001 states: "<฿5,000 requires Treasurer OR Pastor approval."

AUTHORIZATION_MODEL.md §2.1 explicitly denies treasurer the `journal.approve` permission. The permission matrix shows `❌` for treasurer under `journal.approve`, `offering.approve`, `expense.approve`, and `income.approve`.

This is a **direct contradiction**. If the code implements AUTHORIZATION_MODEL.md, treasurers cannot approve any amount — forcing all transactions to pastor, creating a bottleneck. If the code implements BUSINESS_RULES.md, treasurers can approve sub-฿5,000 transactions — creating a fraud vector because the same person who creates transactions can approve small ones (the self-approval check would catch this only if `createdBy !== approvedBy`).

**Impact:** Either approval bottleneck or undetected fraud on sub-฿5,000 transactions.
**Fix:** Reconcile into a single authority. Recommend: treasurer CANNOT approve (AUTHORIZATION_MODEL.md position) because segregation of duties requires creator≠approver. If small churches need this, make it configurable per-church with explicit auditor notification.

### CF-2: Dual Approval Race Condition Enables Single-Person Approval of >฿50,000

**Severity:** CRITICAL
**Affected Documents:** TRANSACTION_ENGINE.md §3.1, BUSINESS_RULES.md §3.1

The dual approval logic in TRANSACTION_ENGINE.md §3.1 has a **race condition**. The `handleTier3Approval` method:

1. Checks if approver is super_admin → approves alone
2. Checks if approver is pastor → records first approval, keeps entry pending
3. If two pastor approvers call `approve()` simultaneously:
   - Both read `entry.status === 'pending'`
   - Both see no `approvedBy` set
   - Both call `recordFirstApproval`
   - One overwrites the other
   - The entry stays pending forever or the second call fails silently

Additionally, the method allows super_admin to single-approve ANY amount. This means the dual approval control for >฿50,000 is bypassable if the super_admin account is compromised — which is precisely the account that needs the MOST protection.

**Impact:** >฿50,000 transactions can be approved by a single super_admin without oversight. Two pastors can race on approval, potentially corrupting the approval state.
**Fix:** Use `SELECT ... FOR UPDATE` to lock the journal entry row during approval. Require dual approval even for super_admin on >฿50,000 (add a second super_admin or require pastor countersignature). Use a dedicated `approval_1_id` and `approval_2_id` column pair instead of a single `approved_by`.

### CF-3: Audit Hash Chain Creates Write Serialization Point at Scale

**Severity:** CRITICAL
**Affected Documents:** AUDIT_TRAIL.md §4, ARCHITECTURE_V2.md §1.3

The audit trail hash chain requires reading `getLatestHash()` before inserting each audit entry. This is a **global serialization point**. At 100 churches with 50 transactions/day each (5,000 entries/day), every journal entry creation must wait for the previous audit entry to commit before its hash can be computed.

With SERIALIZABLE isolation level (TRANSACTION_ENGINE.md §4.3), this creates a dependency chain across ALL churches sharing a database. If Church A's transaction is slow, Church B's transaction blocks waiting for the hash.

At 10,000 churches, this is a **total write bottleneck**. The hash chain effectively serializes all writes across the entire system.

**Impact:** At multi-church scale, write throughput collapses to single-digit transactions per second regardless of hardware.
**Fix:** Per-church hash chains (each church has its own audit chain). Or use a Merkle tree structure where blocks of audit entries are hashed together periodically. Or compute the hash without waiting for the previous entry to commit by using the previous entry's hash at read time rather than at commit time.

### CF-4: No Tenant Isolation — Single Database for All Churches

**Severity:** CRITICAL
**Affected Documents:** All — implicit in all documents

No document defines a tenant/church isolation strategy. The schema has no `church_id` column on any table. The architecture assumes a single PostgreSQL instance for all data. This means:

1. **RLS policies cannot enforce cross-church isolation** without a `church_id` on every table
2. **A bug in RLS or app code exposes ALL churches' data**, not just one
3. **Performance**: All churches share the same general_ledger partition. A large church's reporting query blocks small churches' transactions.
4. **Backup**: One church's data corruption requires restoring ALL churches' data.
5. **Compliance**: Thai PDPA requires data isolation per data controller. If each church is a separate data controller, they cannot share a database without explicit contractual arrangements.
6. **Migration**: Churches cannot migrate independently to different hosting.

**Impact:** Fatal for multi-church deployment. A single church deployment works but the architecture claims to support "thousands of churches."
**Fix:** Add `church_id` to every table. Implement either: (a) schema-per-church (strongest isolation), (b) row-level with `church_id` partitioning and RLS, or (c) separate Supabase projects per church. Option (a) or (c) is recommended for financial data.

### CF-5: Staging Environment Sync Creates Massive Data Breach Risk

**Severity:** CRITICAL
**Affected Documents:** ARCHITECTURE_V2.md §7.2

ARCHITECTURE_V2.md §7.2 states: "Staging: Anonymized copy of production (daily sync)."

This is a **data breach waiting to happen**. Financial data is extremely difficult to properly anonymize:

1. Member names, phone numbers, emails are PII under PDPA
2. Church tax IDs are confidential
3. Transaction amounts + dates can re-identify individuals
4. "Anonymization" must be cryptographically irreversible — not just masking
5. Staging environments typically have weaker access controls than production
6. Daily sync means the breach window is 24 hours

If the anonymization script has a bug (and they always do), real PII and financial data is exposed in a lower-security environment.

**Impact:** PDPA violation, potential fines up to 5 million THB, reputational damage.
**Fix:** Use synthetic/seed data for staging. Never sync production data to staging. If real-data testing is needed, use a dedicated "pre-production" environment with identical security controls to production.

### CF-6: No Fiscal Year-End Closing Procedure

**Severity:** CRITICAL
**Affected Documents:** ACCOUNTING_ENGINE.md, BUSINESS_RULES.md

The architecture describes period (monthly) closing but has **no year-end closing procedure**. This is a fundamental accounting gap:

1. **Income/Expense accounts must be zeroed** at year-end and net income transferred to Retained Earnings (3-3004)
2. **No closing journal entries** are defined for year-end
3. **Balance sheet accounts** carry forward; income/expense accounts reset
4. The trial balance would show accumulated income/expense across years — incorrect for financial statements
5. Fiscal year is configurable (SYS-003) but the closing procedure doesn't account for different fiscal year start months

**Impact:** Financial statements spanning fiscal years will be incorrect. Income statements will include prior-year income/expense. External auditor will reject financial statements.
**Fix:** Define a year-end close process that: (a) generates closing journal entries (Debit each Income account, Credit Retained Earnings; Debit Retained Earnings, Credit each Expense account), (b) creates these as `entry_type: 'closing'`, (c) runs only after all 12 periods are reconciled, (d) is irreversible without auditor override.

---

## 4. Major Findings

### MF-1: Fund Balance Denormalized Across Two Storage Locations

**Affected Documents:** ACCOUNTING_ENGINE.md §5, DATABASE_V2.md §4.1

`funds.current_balance` is stored alongside `general_ledger.running_balance`. The code updates both atomically (ACCOUNTING_ENGINE.md §5.1), but this is a **denormalization**. If a bug or direct DB access updates one without the other, the system has two conflicting sources of truth.

The architecture claims "single source of truth" (Principle 1.5) but violates it for fund balances. The invariant says "Fund balance = stored value" but stored WHERE? In `funds.current_balance` or recomputed from `general_ledger`?

**Fix:** Pick one. Either: (a) `funds.current_balance` is the source of truth and `general_ledger` is an audit artifact, or (b) fund balance is always recomputed from `general_ledger` and `funds.current_balance` is a cached view. Option (a) is stronger for audit but requires absolute trust in the update path. Option (b) is more normalized but requires recomputation. Recommend (a) with a periodic reconciliation job that compares the two and alerts on mismatch.

### MF-2: Chart of Accounts Conflates Funds with Equity Accounts

**Affected Documents:** ACCOUNTING_ENGINE.md, DATABASE_V2.md

The COA treats each fund as a single equity account (e.g., `3-3001 กองทุนทั่วไป`). But a fund is a **self-balancing set of accounts** (assets + liabilities + equity + income + expenses), not a single equity account. In proper fund accounting:

- Each fund has its own cash, its own liabilities, its own income, its own expenses
- Fund transfers affect ASSET accounts (cash moves), not just equity accounts
- The current design means: assets (1-1001 Cash) are NOT fund-specific — you can't tell which fund's cash is which

This means the system cannot produce per-fund balance sheets showing each fund's assets and liabilities independently.

**Fix:** Either: (a) Segment all asset/liability accounts by fund (e.g., `1-1001-01` Cash-General, `1-1001-02` Cash-Building), or (b) use fund as a dimension/tag on journal lines rather than a separate entity, with fund balance statements generated by filtering GL by fund dimension. Option (b) is more flexible and common in modern fund accounting systems.

### MF-3: Optimistic Locking with SERIALIZABLE Isolation Is Redundant and Harmful

**Affected Documents:** TRANSACTION_ENGINE.md §4.1, §4.3, DATABASE_V2.md §1.4

The architecture uses BOTH optimistic locking (version column) AND SERIALIZABLE transaction isolation. These conflict:

1. **SERIALIZABLE isolation** already detects concurrent modifications by tracking read/write dependencies. PostgreSQL will abort one transaction with a serialization failure.
2. **Optimistic locking** with `WHERE version = :expected` also detects concurrent modifications by checking rows affected.
3. **Using both means**: Under SERIALIZABLE, if the version check passes but PostgreSQL detects a serialization anomaly, the transaction aborts. The retry logic (max 3 retries) in TRANSACTION_ENGINE.md §4.3 will retry the whole transaction. But if the version check FAILS, the application throws a `ConcurrencyConflictError` — which is NOT retried.

This creates inconsistent behavior: PostgreSQL-detected conflicts are retried; application-detected conflicts are not. The user experience differs depending on which layer catches the conflict first.

Additionally, SERIALIZABLE isolation is the most expensive isolation level. It will cause significant throughput degradation under concurrent load.

**Fix:** Use REPEATABLE READ with optimistic locking, not SERIALIZABLE. REPEATABLE READ + explicit row locking (`SELECT ... FOR UPDATE`) provides the same financial integrity guarantees with better performance. Or use SERIALIZABLE without optimistic locking — let PostgreSQL handle all concurrency.

### MF-4: JWT Session Revocation Is Incomplete

**Affected Documents:** SECURITY_MODEL.md §3

The session management design stores sessions in `user_sessions` table and validates on each request. However:

1. **No JWT token blacklist**: If a JWT is stolen (XSS, MITM), the attacker can use it until expiration. Deleting the session record blocks future requests but there's a race window.
2. **JWT secret compromise**: If the JWT signing secret is compromised, ALL sessions are effectively valid. No mechanism to rotate secrets and invalidate existing tokens.
3. **httpOnly cookies prevent theft but not misuse**: If an attacker gains physical access to a logged-in device, the cookie is valid until idle timeout or manual logout.

**Fix:** Add a token version (`tok_ver`) to the user record. Increment on password change, role change, or admin-forced logout. Include in JWT payload. On validation, reject tokens with outdated version. This provides instant global revocation without a blacklist.

### MF-5: No Mechanism to Reopen Reconciled Periods (Data Integrity Risk)

**Affected Documents:** BUSINESS_RULES.md §7, ACCOUNTING_ENGINE.md §8.2

BUSINESS_RULES.md PRD-007 states: "Reopening RECONCILED period is forbidden (requires DB admin)." But ACCOUNTING_ENGINE.md §8.2 `reopenPeriod()` checks `if (period.status === 'reconciled')` and throws `PeriodAlreadyReconciledError`.

This means a RECONCILED period can NEVER be reopened. In real church operations:

1. A bank statement arrives late showing an error
2. A duplicate offering is discovered months later
3. An expense receipt is found after period close

The only recourse is "DB admin" — meaning someone with direct PostgreSQL access must manually change the period status. This is a separation-of-duties violation and circumvents the entire audit trail.

**Fix:** Allow reopening of reconciled periods with: (a) super_admin + auditor dual approval, (b) mandatory audit entry explaining why, (c) all period balances recalculated after the correction, (d) a new reconciliation required after the correction. The reopening should create a correcting journal entry in the CURRENT period that reverses the incorrect entry in the prior period (not modify the prior period).

### MF-6: Missing Materialized Views Referenced in Architecture

**Affected Documents:** ARCHITECTURE_V2.md §11.1, DATABASE_V2.md

ARCHITECTURE_V2.md §11.1 states: "Materialized views for frequently used aggregations" and "Reports: Built from materialized views refreshed on period close."

DATABASE_V2.md defines **zero materialized views**. Not a single `CREATE MATERIALIZED VIEW` statement. The report generation code in ACCOUNTING_ENGINE.md §11 queries the general_ledger directly for every report.

For a single church with 1,000 transactions/year, this is fine. For 100 churches with 500,000 transactions/year each, this will cause report generation to timeout or consume excessive database resources.

**Fix:** Define materialized views for at minimum: (a) monthly account balances by fund, (b) budget vs. actual by account, (c) member giving summaries. Refresh on period close or nightly. Document refresh strategies.

### MF-7: No Budget Encumbrance / Commitment Tracking

**Affected Documents:** BUSINESS_RULES.md §6, ACCOUNTING_ENGINE.md §10

The budget system is advisory only (BUD-010: "Over-budget detection is advisory (warns but does not block)"). But IMPLEMENTATION_ROADMAP.md M7.13 promises "purchase order / commitment tracking" which implies encumbrance accounting.

Encumbrance accounting is the process of reserving budget when a purchase order is committed (before the actual expense). This is standard in governmental and non-profit accounting. Without it:

1. A church can approve an expense that exceeds budget because budget is only checked at expense time
2. Two large expenses approved simultaneously can both pass budget check because neither has posted yet
3. The PO/commitment feature in M7.13 has no accounting integration documented

**Fix:** Either remove PO/commitment from the roadmap, or define the encumbrance accounting model: pre-encumbrance (requisition), encumbrance (PO issued), expenditure (invoice paid). Each step creates journal entries in a separate encumbrance ledger.

### MF-8: SQL Injection via `current_setting()` in RLS Policies

**Affected Documents:** DATABASE_V2.md §13.2

All RLS policies use `current_setting('app.current_user_id')::uuid`. This function reads a PostgreSQL runtime parameter set by the application. If an attacker can:

1. Execute arbitrary SQL (via a different vulnerability)
2. Inject into the parameter setting mechanism

They can set `app.current_user_id` to any user ID and bypass RLS.

Additionally, `current_setting()` returns text that must be cast to UUID. If the parameter is not set (application bug), the cast fails with an error that may leak information. If set to a non-UUID value, the error is unhandled.

**Fix:** Use a `SECURITY DEFINER` function that reads from a temporary table (set per-session by a trusted function) rather than `current_setting()`. Or use Supabase's built-in `auth.uid()` function which is harder to spoof. Add a CHECK to validate UUID format before casting.

### MF-9: Money Domain Class Leaks Floating-Point

**Affected Documents:** ACCOUNTING_ENGINE.md §1.3

The `Money` class uses `BigInt` for internal storage (satang), which is correct. However:

1. `Money.fromBaht(baht: number)` accepts a `number` (IEEE 754 float) and does `Math.round(baht * 100)`. This can lose precision: `0.1 * 100 = 10.000000000000002` → `Math.round = 10` (correct in this case but not guaranteed for all values).
2. `Money.toNumber()` converts back to float: `Number(this.amountInSatang) / 100`. This loses precision for amounts > `Number.MAX_SAFE_INTEGER / 100` (~90 trillion THB — unlikely but architecturally unsound).
3. `Money.multiply(factor: number)` uses `Number(this.amountInSatang) * factor` — floating-point multiplication on financial data.

**Fix:** `fromBaht` should accept a string (`'100.50'`) and parse it as integer satang: `parseInt(baht.replace('.', ''))`. Never accept float for financial input. Use `BigInt` multiplication everywhere. Use `Decimal` library or string-based formatting.

### MF-10: No Cash Flow Statement Implementation

**Affected Documents:** ACCOUNTING_ENGINE.md §11, IMPLEMENTATION_ROADMAP.md M6.3

IMPLEMENTATION_ROADMAP.md M6.3 promises "Implement cash flow statement report" but ACCOUNTING_ENGINE.md §11 only documents Balance Sheet (§11.1) and Income Statement (§11.2). There is **no cash flow statement generation logic** in the accounting engine.

A proper cash flow statement requires:
1. Classifying transactions as operating, investing, or financing
2. Reconciling net income to cash from operations
3. Tracking changes in working capital accounts

None of this is modeled in the chart of accounts or the reporting service.

**Fix:** Define cash flow statement categories in the COA (or as metadata). Implement the indirect method starting from net income with adjustments for non-cash items (depreciation) and changes in working capital. This is complex — it may need to be deferred to a later milestone if not critical for MVP.

### MF-11: No Opening Balance Equity Account

**Affected Documents:** ACCOUNTING_ENGINE.md §2.2, §7.4

When a church first sets up the system, they enter opening balances for all accounts. The double-entry for this is:
- Debit: All asset accounts (for their opening balances)
- Credit: All liability accounts (for their opening balances)
- Credit: An **Opening Balance Equity** account (for the difference, making A = L + E)

The chart of accounts (ACCOUNTING_ENGINE.md §2.2) has no Opening Balance Equity account. The opening balance entry in §7.4 only shows one asset and one equity account — it doesn't show the full multi-line opening entry needed for initial setup.

Without this, a church with existing assets and liabilities cannot correctly initialize the system.

**Fix:** Add account `3-3005 กำไรสะสมต้นงวด / Opening Balance Equity` to the COA. Document the full opening balance entry procedure. This account should be zeroed out after the first fiscal year close.

### MF-12: v1 PIN-to-Password Migration Creates Immediate Security Risk

**Affected Documents:** MIGRATION_PLAN.md §3, §14

The migration plan hashes the v1 6-digit PIN as the initial v2 password:

```typescript
const passwordHash = await hashPassword(user.pin); // Hash PIN as initial password
```

A 6-digit PIN has ~20 bits of entropy. While bcrypt/argon2id makes brute-forcing the HASH slow, an attacker who:
1. Knows a user's old PIN (shoulder-surfed, shared among staff, written down)
2. Can attempt login with that PIN before the user changes their password

The migration script marks `passwordChangedAt: new Date()` to "force password change on first login" — but this is a client-side enforcement. The server doesn't check `passwordChangedAt` on login to force a change. An attacker can log in with the old PIN and access the system.

**Fix:** On first login after migration, check if `passwordChangedAt` equals `createdAt` (or is within the migration window). If so, force a password change BEFORE allowing any other API access. Return a `PASSWORD_CHANGE_REQUIRED` response that the client must handle.

### MF-13: No Depreciation Calculation Module

**Affected Documents:** ACCOUNTING_ENGINE.md, DATABASE_V2.md

The chart of accounts includes:
- `1-1005 อาคาร` (Buildings)
- `1-1006 อุปกรณ์` (Equipment)
- `1-1007 ค่าเสื่อมราคาสะสม` (Accumulated Depreciation)

But there is **no depreciation calculation module**. No:
- Asset useful life tracking
- Depreciation method (straight-line, declining balance)
- Monthly/annual depreciation journal entry generation
- Asset register / fixed asset subledger

Without this, accumulated depreciation must be entered manually — error-prone and unlikely to be done regularly.

**Fix:** Either add a fixed asset submodule with depreciation calculations, or remove contra-asset accounts from the COA for MVP and add them when the module is built. Churches with buildings/equipment should track depreciation for proper financial statements.

### MF-14: No API Input Validation for Date Ranges in Reporting

**Affected Documents:** ACCOUNTING_ENGINE.md, ARCHITECTURE_V2.md §9

Report endpoints accept `from` and `to` date parameters. There is no documented validation for:
1. `from` before `to`
2. Date range within reasonable bounds (not 100 years)
3. Date range not in the far future
4. Maximum range limit (preventing queries that span 50 years of data)

A malicious or buggy client could request a report from year 1900 to 2100, causing a full table scan of the general_ledger.

**Fix:** Add Zod validation on all report endpoint date parameters. Enforce maximum range (e.g., 5 years for any single report query).

### MF-15: Sequential Numbering Gaps in Voided/Deleted Transactions

**Affected Documents:** TRANSACTION_ENGINE.md §5.2

The `detectGaps` method finds gaps in sequential numbering. The comment says "These represent voided or deleted entries" — but this is misleading. Legitimate gaps occur when:
1. A PostgreSQL sequence allocates a number but the transaction rolls back (sequence values are never returned)
2. A draft is soft-deleted after being assigned a number (if numbers are assigned at draft creation)

If numbers are assigned at DRAFT creation but the draft is deleted, the sequence has a permanent gap. This is normal for PostgreSQL sequences but may concern auditors who expect gapless sequentially-numbered financial documents.

**Fix:** Assign entry numbers at APPROVAL time, not at draft creation. This way, only approved (and voided) entries consume sequence numbers. Gap detection should distinguish between "entry was voided" (legitimate) and "sequence jumped" (potential manipulation).

### MF-16: No Tenant-Level Backup and Restore

**Affected Documents:** ARCHITECTURE_V2.md §7.3, DATABASE_V2.md

Backup strategy is database-level: "Full database backup daily." If one church corrupts their data, restoring from backup restores ALL churches' data, potentially losing recent transactions for all other churches.

This is a consequence of CF-4 (no tenant isolation). Combined, these two findings mean the system cannot safely restore data for a single church.

**Fix:** Add `church_id` isolation. Then implement per-church backup/restore using logical backups (pg_dump with `--schema` or `--table` with WHERE clause) or support point-in-time recovery per schema.

### MF-17: Reconciliation Opening Balance Depends on Prior Reconciliation, Not Ledger

**Affected Documents:** ACCOUNTING_ENGINE.md §9.2

The reconciliation engine gets the opening balance from the previous reconciliation record:

```typescript
const openingBalance = previousReconciliation?.systemBalance ?? Money.zero();
```

If the previous reconciliation had a data entry error (actualBalance was entered incorrectly), the opening balance for the current period is wrong — and all subsequent periods cascade the error.

The system should compute the opening balance from the GENERAL LEDGER directly, and compare it against the previous reconciliation's system balance. If they differ, flag it as a reconciliation break.

**Fix:** Compute `openingBalance` from `general_ledger` for the period. Compare with `previousReconciliation.systemBalance`. If they differ, require explanation and create an adjustment entry.

### MF-18: No Automatic Fiscal Period Creation

**Affected Documents:** BUSINESS_RULES.md §7, ACCOUNTING_ENGINE.md §8

BUSINESS_RULES.md PRD-001 says: "Periods auto-created on first transaction of a month." But the code in ACCOUNTING_ENGINE.md §8 shows no auto-creation logic. The `closePeriod` function reads an existing period; the `createEntry` function validates a period exists. If a period doesn't exist, the validation fails — it doesn't create one.

This means an administrator must manually create all 12 fiscal periods before any transactions can be recorded. For a new church setup, this is a friction point.

**Fix:** Implement the auto-creation logic. In `validatePeriod()`, if the period doesn't exist, create it within the same transaction (or a separate one before the main transaction).

---

## 5. Minor Findings

### mF-1: ARCHITECTURE_V2.md Uses "bcrypt" and "argon2id" Inconsistently

§4.1 table says "Auth: Supabase Auth (modified)" but §8.1 says "bcrypt hashing (argon2id recommended)". The SECURITY_MODEL.md correctly uses argon2id. Standardize all references to argon2id.

### mF-2: Imbalance Between READ and WRITE Documentation

All 10 documents focus heavily on write paths (creating journal entries, approvals, audit). Read paths (reporting, dashboards, member lookups, reconciliation views) are under-documented. The general ledger query patterns are mentioned in indexes but not in API design or performance architecture.

### mF-3: No Data Dictionary or Glossary

Terms like "fund," "account," "period," "entry," and "posting" are used across documents with slightly different meanings. A centralized glossary would prevent implementation errors. For example, "posting" in ACCOUNTING_ENGINE.md means "writing to general ledger," but in BUSINESS_RULES.md it means "setting posting_date."

### mF-4: `offering_count_sheets` Has No DISCREPANCY State

The status enum is `counting | in_review | reconciled | locked`. Business rule OFF-004 says "if counters differ by >฿100, recount required." But there's no `discrepancy` or `needs_recount` state. The sheet stays in `counting` or `in_review` indefinitely, with no explicit UI state for "attention needed."

### mF-5: Budget vs. Actual Query Has Expensive Subqueries

The SQL in DATABASE_V2.md §7 for budget utilization includes correlated subqueries (`EXISTS (SELECT 1 FROM journal_entry_lines WHERE ...)`) that will perform poorly at scale. For 100+ budgets with 50,000+ GL entries each, this query will cause performance issues.

### mF-6: No Soft-Delete Column Visible in Schema

IMPLEMENTATION_ROADMAP.md M3.9 mentions "soft-delete / trash bin with 30-day recovery window." TRANSACTION_ENGINE.md §1.2 mentions `deleted` state. But the `journal_entries` table in DATABASE_V2.md has no `deleted_at` or `is_deleted` column. The state machine includes `deleted` as a state — but mixing soft-delete with a status enum is confusing. Is `deleted` a status or a separate flag?

### mF-7: `Money.isLessThan()` Referenced but Not Defined

ACCOUNTING_ENGINE.md §5.1 calls `balance.isLessThan(amount)` but the `Money` class in §1.3 only defines `isGreaterThan`, `isGreaterThanOrEqual`, `isZero`, `isNegative`, and `equals`. `isLessThan` and `abs()` are missing from the class definition.

### mF-8: No Pagination Strategy for List Endpoints

ARCHITECTURE_V2.md §11.1 says "Cursor-based for all list endpoints." But the API endpoints in §9.1 show `GET /journal?from=&to=` with no cursor, limit, or pagination parameters. The response format shows `meta.total/page/pageSize` but cursor-based pagination doesn't use page numbers.

### mF-9: Correlation ID Not Included in Error Response

ARCHITECTURE_V2.md §9.2 includes `correlationId` in the error response format. AUDIT_TRAIL.md §5 documents correlation IDs comprehensively. But the error handling in ARCHITECTURE_V2.md §10.1 generates a fresh `getCorrelationId()` call — this should use the request-scoped correlation ID set by middleware, not generate a new one.

### mF-10: No HTTP Method for Report Generation

ARCHITECTURE_V2.md §9.1 shows `POST /reports/balance-sheet` for report generation. Generating a report is a read operation — it should be `GET` or `POST` with an idempotency key. Using `POST` for reads violates REST conventions and prevents caching.

---

## 6. Positive Decisions

The following architectural decisions are sound and should be preserved:

1. **Double-Entry Foundation**: The shift from single-entry to double-entry is the correct and necessary change. The journal→GL→trial balance chain is properly modeled.

2. **PostgreSQL Choice**: ACID transactions, DECIMAL type, CHECK constraints, and PITR make PostgreSQL the right database for financial data. No document proposes a NoSQL alternative — this is correct.

3. **Server-Authoritative Architecture**: Moving all business logic to the server is essential for financial integrity. The layered enforcement (middleware → domain → RLS) is proper defense-in-depth.

4. **Hash-Chained Audit Trail**: Immutable, cryptographically verifiable audit records with before/after snapshots and external verifier script are a strong design. The bash verifier script is an excellent touch for external auditor independence.

5. **Money as a Value Object**: Using BigInt with satang precision (1/100 THB) is correct for financial calculations. Despite the floating-point leak issues (MF-9), the approach is fundamentally sound.

6. **Sequential Transaction Numbering**: Type-prefixed, year-scoped, sequence-backed entry numbers (OFF-2026-0042) provide auditor-friendly tracking.

7. **Void-by-Reversal Pattern**: Voiding creates reversing journal entries rather than modifying originals. This preserves the immutable ledger while allowing corrections.

8. **Sunday Count Sheet Design**: Independent counter verification with CHECK constraints preventing same-user counters, discrepancy flagging, and separate locking step is excellent fraud prevention for church cash handling.

9. **Period Chaining in Reconciliation**: Each reconciliation links to the previous one, creating an unbroken chain of verified balances. Despite the ledger-vs-reconciliation issue (MF-17), the chain concept is correct.

10. **Role-Based UI Hiding as UX Only**: Explicit documentation that client-side permission checks are cosmetic, not security. This is properly emphasized across multiple documents.

11. **Idempotency Key Support**: Optional idempotency keys on mutations prevent duplicate transactions from network retries — critical for financial operations.

12. **External Auditor Toolkit**: The independent verifier script and export format are evidence the team considered external audit requirements seriously.

---

## 7. Cross-Document Contradictions

| # | Documents | Contradiction | Severity |
|---|-----------|--------------|----------|
| 1 | BUSINESS_RULES.md §3.1 vs AUTHORIZATION_MODEL.md §2.1 | Treasurer approval authority (<฿5,000) | CRITICAL |
| 2 | ARCHITECTURE_V2.md §8.1 vs SECURITY_MODEL.md §2.2 | bcrypt vs argon2id for password hashing | Minor |
| 3 | ARCHITECTURE_V2.md §8.2 vs DATABASE_V2.md §13.2 | RLS policies: "service role bypasses RLS" vs RLS as "defense-in-depth" | Major |
| 4 | ARCHITECTURE_V2.md §1.5 vs ACCOUNTING_ENGINE.md §5.1 | Single source of truth: GL vs funds.current_balance | Major |
| 5 | ARCHITECTURE_V2.md §11.1 vs DATABASE_V2.md | Materialized views referenced but never defined | Major |
| 6 | ARCHITECTURE_V2.md §11.1 vs §9.1 | Cursor-based pagination vs page-based response format | Minor |
| 7 | TRANSACTION_ENGINE.md §2.1 vs BUSINESS_RULES.md §2.1 | TRANSACTION_ENGINE has `deleted` state in state machine; BUSINESS_RULES has "soft deleted" as separate concept | Minor |
| 8 | IMPLEMENTATION_ROADMAP.md M1.4 vs SECURITY_MODEL.md §2.2 | "bcrypt/argon2" vs "argon2id" | Minor |
| 9 | SECURITY_MODEL.md §8.1 vs DATABASE_V2.md §9.1 | Password hash stored in users table vs Supabase Vault | Major |
| 10 | BUSINESS_RULES.md §5.1 OFF-003 vs ARCHITECTURE_V2 | "Counters cannot view each other's inputs" — not reflected in table schema (all amounts in one row) | Major |
| 11 | DATABASE_V2.md §3.2 vs TRANSACTION_ENGINE.md §5.1 | Entry number format: VARCHAR(30) allows any format; code generates TYPE-YEAR-SEQ | Minor |
| 12 | SECURITY_MODEL.md §6.1 vs MIGRATION_PLAN.md §3 | Rate limiting at API level vs per-user/global; different threshold values | Minor |

**Most concerning**: The approval authority contradiction (CF-1) and the dual approval race condition (CF-2) would directly manifest as bugs in production if implemented as documented.

---

## 8. Database Review

### 8.1 Normalization Assessment

| Table | Normal Form | Issues |
|-------|-------------|--------|
| `chart_of_accounts` | 3NF | Clean |
| `journal_entries` | 2NF | `total_debit`/`total_credit` are derivable from journal_entry_lines (denormalized for CHECK constraint) |
| `journal_entry_lines` | 3NF | Clean |
| `general_ledger` | 2NF | `running_balance` is derivable from prior entries (denormalized intentionally for performance) |
| `funds` | 2NF | `current_balance` duplicates general_ledger data |
| `offering_count_sheets` | 1NF | Counter amounts in columns (counter_1_amount, counter_2_amount) rather than rows — limits to exactly 3 counters |
| `budgets` | 3NF | Clean |
| `audit_log` | 3NF | Clean; JSONB for state snapshots is appropriate |
| `user_sessions` | 3NF | Clean |

**Assessment**: Intentionally denormalized for financial integrity (CHECK constraints on journal entries) and performance (running balances). The `offering_count_sheets` design is the most concerning — it hardcodes 3 counters rather than using a normalized `count_sheet_counters` table with one row per counter. This limits flexibility and makes querying counter history awkward.

### 8.2 Index Review

**Missing Indexes:**

1. `general_ledger(account_id, fund_id, posting_date DESC)` — for "get latest balance per account+fund" queries used by the posting engine
2. `journal_entries(created_by, status)` — for "my drafts" queries
3. `journal_entries(approved_by, posting_date)` — for approver audit queries
4. `journal_entry_lines(project_id, line_type)` — for project spending queries
5. `journal_entry_lines(department_id, line_type)` — for department spending queries
6. `audit_log(user_id, created_at)` — already has separate indexes but a composite would be more efficient for "user activity" queries
7. `budgets(fund_id, fiscal_year, status)` — for active budget queries per fund

**Redundant Indexes:**

1. `idx_gl_posting_date` on `general_ledger(posting_date)` — redundant with `idx_gl_account_date` and `idx_gl_fund_date` which both start with more selective columns
2. `idx_audit_event` and `idx_audit_entity` — `event_type` is likely low-cardinality; entity + entity_id is covered by the composite index already

### 8.3 Constraint Review

**Strong constraints:**
- `chk_balanced` on journal_entries: CHECK(total_debit = total_credit) — excellent
- `chk_positive_totals` on journal_entries: CHECK(total_debit > 0) — prevents zero-amount entries
- `chk_counters_different_*` on offering_count_sheets — prevents same-user counter fraud
- `chk_budget_period` on budgets — enforces period type rules at DB level

**Missing constraints:**
1. No CHECK constraint preventing `approved_by = created_by` on journal_entries (only enforced in application code)
2. No CHECK constraint ensuring `rejection_reason IS NOT NULL` when `status = 'rejected'`
3. No CHECK constraint requiring `posted_at IS NOT NULL` when `status = 'approved'`
4. No CHECK constraint validating `posting_date` is within the fiscal_period's start_date/end_date range
5. No FOREIGN KEY from `journal_entries.fiscal_period` to `fiscal_periods` — the period is referenced only by year+number, not by ID

### 8.4 Partitioning Strategy

The proposal to partition `general_ledger` by `fiscal_year` is sound, but:

1. **Only one partition method is shown** (RANGE). For the audit_log, partitioning by `created_at` with monthly or quarterly ranges would enable efficient archival.
2. **No partition maintenance plan**: New fiscal years require manual partition creation (`CREATE TABLE general_ledger_2027...`). This should be automated via pg_partman or a cron job.
3. **Partition pruning won't work for cross-year queries**: Budget vs. actual reports that span fiscal years will scan all partitions.

### 8.5 Deadlock Risk Assessment

**High-risk scenarios:**

1. **Fund transfer + expense on same fund**: Both transactions need to update `funds.current_balance` for the same fund. With SERIALIZABLE isolation, one will abort.
2. **Approval + void on same entry**: Both read the journal entry (shared lock) then try to update it (exclusive lock). The second transaction blocks.
3. **Sunday count sheet locking + individual offering creation**: If the count sheet locking creates multiple journal entries, and another user creates an offering on the same fund, they compete for the fund balance update.

**Mitigation**: The retry logic (max 3) in TRANSACTION_ENGINE.md §4.3 helps, but deadlocks under load will cause user-visible errors. Adding `SELECT ... FOR UPDATE` on the fund row at the start of journal creation would serialize access and prevent deadlocks at the cost of throughput.

### 8.6 Large Dataset Behavior

At 10 million transactions (~10,000 entries/month for 100 churches over 8 years):

| Query | Current Index Support | Performance |
|-------|----------------------|-------------|
| Trial balance at date | `idx_gl_account_date` + `idx_gl_fiscal` | Good (index scan) |
| Fund balance | `idx_gl_fund_date` | Good |
| Account history | `idx_gl_account_date` | Good |
| Budget vs. actual | Subquery approach (DATABASE_V2.md §7) | **Poor** — correlated subqueries on unindexed columns |
| Audit log verification | `idx_audit_created` | **Poor** — full scan of entire audit_log table |
| Member giving statement | `idx_journal_lines_member` | Good |
| Period close (snapshot all funds) | Per-fund query | Good (N queries, each indexed) |
| Report generation | Direct GL scan | **Poor** — full partition scan for date range |

**Critical bottleneck**: Audit hash chain verification reads every audit entry sequentially. At 10M entries with 2KB JSONB each, that's 20GB of data to read and hash-verify. This would take minutes to hours. The verification should be incremental (verify the last N entries or a random sample) with full verification as a batch job.

---

## 9. Accounting Review

### 9.1 Double-Entry Implementation

The core double-entry logic in ACCOUNTING_ENGINE.md is **fundamentally correct**. The `validateBalance()` method properly ensures Σdebits = Σcredits. The posting engine correctly handles normal balances and contra accounts. The void-by-reversal pattern is standard accounting practice.

**Issues:**

1. **Fund accounting is incomplete** (MF-2): Funds are modeled as equity accounts, not as self-balancing sets of accounts.

2. **No classification of transactions for cash flow**: The `entry_type` discriminator (offering/expense/income/transfer) doesn't map to operating/investing/financing categories for cash flow statements.

3. **No accrued accounting**: All entries are cash-basis. There's no concept of accrued expenses (recorded but not yet paid) or deferred income (received but not yet earned). While cash-basis is common for small churches, larger churches following TFRS may need accrual.

4. **Depreciation is manual**: Contra-asset accounts exist but no automated depreciation (MF-13).

### 9.2 Trial Balance

The trial balance generation in §6.1 is **correct**. It queries each account's running balance and classifies as debit or credit based on normal balance. The `isBalanced` check verifies the accounting equation.

**Issue**: The trial balance as designed is ALL-TIME (or as-of-date). There's no PERIOD-SPECIFIC trial balance showing only activity within a date range. Period-specific trial balance is needed for:
- Checking if debits = credits for just this month's activity
- Identifying entries posted to wrong periods
- Supporting period-based financial statements

### 9.3 Financial Statements

**Balance Sheet** (§11.1): Correctly builds from trial balance with net income flowing to equity.

**Income Statement** (§11.2): Correctly filters to income and expense accounts. However, it uses `creditAmount` for income and `debitAmount` for expenses — this assumes all income entries are credits and all expense entries are debits. Contra-revenue (income reversal) or expense correction entries would break this assumption.

**Cash Flow Statement**: Not implemented (MF-10).

**Fund Balance Report**: Referenced in IMPLEMENTATION_ROADMAP.md M6.4 but not documented in ACCOUNTING_ENGINE.md.

### 9.4 Opening Balances

The opening balance entry example (§7.4) shows:
```
Debit: 1-1002 Bank ฿50,000
Credit: 3-3001 General Fund ฿50,000
```

This is insufficient. A real church setup needs to enter ALL assets and ALL liabilities, with the difference going to opening balance equity. The current example works only if the church has no liabilities — unrealistic.

### 9.5 Thai Accounting Requirements

The chart of accounts includes `tfrs_code` fields mapping to Thai Financial Reporting Standards — this is good. However:

1. **No tax report templates**: ภ.ง.ด. 3 (withholding tax for individuals) and ภ.ง.ด. 53 (withholding tax for companies) forms are referenced but no generation logic is defined.
2. **No social security contribution report**: SSO contributions are in the COA but no SSO reporting format is documented.
3. **No annual financial statement format** matching Thai Revenue Department requirements for religious organizations.
4. **Donor tax receipt format** (ใบอนุโมทนาบัตร) is mentioned but not specified — Thai tax law has specific requirements for what a donation receipt must include.

### 9.6 Church Accounting Practices

The architecture acknowledges Thai church context with bilingual account names (TH/EN). However:

1. **No designated fund tracking**: Many Thai churches have "designated offerings" where donors specify a purpose (building fund, mission trip, benevolence). These are distinct from fund transfers. The offering entry allows fund selection but doesn't distinguish between "general offering" and "designated offering to specific fund."

2. **No love offering / honorarium handling**: Payments to guest speakers or visiting pastors are common. These may or may not have withholding tax implications depending on amount and recipient status.

3. **No benevolence tracking**: Churches often distribute funds to needy members. This is an expense but should be tracked separately for church board reporting.

---

## 10. Security Review

### 10.1 Authentication

**Strengths:**
- argon2id for password hashing (when consistently applied)
- httpOnly, Secure, SameSite=Strict cookies for session
- TOTP-based MFA for high-privilege roles
- Account lockout after 5 failed attempts
- Per-IP and per-user rate limiting

**Weaknesses:**
- No WebAuthn/Passkey support — TOTP is phishable
- No password breach detection (checking against HaveIBeenPwned)
- PIN-to-password migration risk (MF-12)
- No session anomaly detection (impossible travel, new device)

### 10.2 Authorization

**Strengths:**
- Clear RBAC model with explicit permission matrix
- Multi-layer enforcement (middleware, domain, RLS)
- Self-approval prevention
- Tiered approval thresholds

**Weaknesses:**
- Treasurer approval contradiction (CF-1)
- Dual approval race condition (CF-2)
- RLS bypass via `current_setting()` (MF-8)
- No scope limitation per church (CF-4)
- `super_admin` has unlimited power — no dual-control for admin actions

### 10.3 Audit Trail Security

**Strengths:**
- Append-only at database level (REVOKE UPDATE/DELETE)
- SHA-256 hash chain with verifiable integrity
- Before/after snapshots for every mutation
- External SIEM forwarding option
- Independent verifier script

**Weaknesses:**
- Hash chain serialization bottleneck (CF-3)
- Audit verification is point-in-time — continuous monitoring not built-in
- No alerting on hash chain breaks (must be manually checked)
- SIEM forwarding is optional, not mandatory

### 10.4 Data Protection

**Strengths:**
- PII masking at API response layer
- Consent tracking for member data
- TLS 1.3 for all data in transit
- Encryption at rest (Supabase managed)

**Weaknesses:**
- Staging environment contains production data (CF-5)
- No data classification/labeling system
- No automated PII scanning or data loss prevention
- No encryption key management documentation (relies entirely on Supabase)

### 10.5 Fraud Prevention Assessment

| Fraud Scenario | Detected/Prevented? | Gap |
|---------------|---------------------|-----|
| Cash skimming by single counter | ✅ Prevented (dual counter requirement) | Counter 3 is optional — two counters could collude |
| Fictitious expense | ✅ Prevented (segregation of duties) | Super admin can create AND approve — bypasses segregation |
| Fund transfer to personal account | ⚠️ Partial | No external bank account verification; no payee validation |
| Back-dated transaction to hide fraud | ✅ Prevented (period locking) | But super admin can reopen periods |
| Audit log tampering | ✅ Prevented (hash chain + append-only) | But DB admin can disable triggers |
| Ghost employee (fake salary) | ❌ Not addressed | No employee master data; no salary verification workflow |
| Duplicate reimbursement | ⚠️ Partial | Idempotency keys prevent exact duplicates; similar amounts not flagged |
| Round-dollar fraud (฿1,000 increments) | ⚠️ Partial | Anomaly detection listed as "Future Phase" only |
| Collusion (treasurer + pastor) | ❌ Not prevented | No mandatory rotation; no external notification of large transactions |
| Data deletion to hide fraud | ✅ Prevented | Void-only; immutable audit trail |

### 10.6 Vulnerability Assessment

| Vulnerability Class | Addressed? | Assessment |
|--------------------|------------|------------|
| SQL Injection | ⚠️ Partial | Drizzle ORM parameterizes queries, but `current_setting()` in RLS is an injection surface |
| XSS | ✅ Addressed | CSP headers, httpOnly cookies, React's built-in XSS protection |
| CSRF | ✅ Addressed | SameSite=Strict cookies, CORS configuration |
| JWT attacks | ⚠️ Partial | No token versioning; no key rotation plan |
| Brute force | ✅ Addressed | Rate limiting + account lockout |
| Privilege escalation | ✅ Addressed | Multi-layer enforcement |
| Session hijacking | ⚠️ Partial | httpOnly cookies prevent JS access but no device fingerprinting |
| Replay attacks | ⚠️ Partial | Idempotency keys on mutations; GET requests not protected |
| Supply chain | ❌ Not addressed | No dependency scanning; no SBOM; no build provenance |
| Insider threat | ⚠️ Partial | Audit trail captures actions but detection is manual |

---

## 11. Operational Review

### 11.1 Deployment Architecture

The deployment model (Vercel/Railway + Supabase) is simple but fragile:

1. **No multi-region deployment**: Both app server and database are in a single region. A Singapore region outage takes down all churches.
2. **No CDN for dynamic content**: Cloudflare CDN is mentioned for static assets only. API responses are not cached.
3. **No edge computing**: All server functions run in a single region. Latency from remote areas is unaddressed.
4. **Vendor lock-in**: Tight coupling to Supabase for auth, storage, and database. Migrating away would require significant rework.

### 11.2 CI/CD

GitHub Actions CI/CD is mentioned but details are sparse:

1. **No deployment strategy**: Blue-green or canary deployment is not described. The migration plan implies a hard cutover.
2. **No database migration CI integration**: No mention of running Drizzle migrations automatically in CI or validating migration safety.
3. **No staging deployment automation**: Manual staging deployment implied.
4. **No rollback automation**: Rollback is manual (pg_dump/pg_restore).

### 11.3 Monitoring & Observability

The monitoring section (ARCHITECTURE_V2.md §12) is thin:

1. **Only Sentry + Pino**: No metrics collection (Prometheus, OpenTelemetry). No distributed tracing.
2. **Alert thresholds are defined but no alerting pipeline**: Who gets alerted? How? Via what channel?
3. **No dashboard**: No operational dashboard for system health.
4. **No business metrics monitoring**: "Fund overdraft events" is listed but "monthly transaction volume," "approval queue depth," "unreconciled period count" are not tracked.
5. **No SLO/SLI defined**: Despite the architecture review criteria explicitly asking for SLO, no document defines service level objectives or indicators.

### 11.4 Backup & Disaster Recovery

**Backup:**
- Daily full backups (30-day retention) — good
- Continuous WAL archiving (7-day retention) — good for PITR
- Weekly cross-region backup (90-day retention) — good
- Annual archive (7+ years) — good

**Critical gaps:**

1. **No restore testing procedure**: Backups exist but are never tested. An untested backup is not a backup.
2. **No Recovery Time Objective (RTO)**: How long can the system be down before it's unacceptable?
3. **No Recovery Point Objective (RPO)**: How much data loss is acceptable?
4. **No disaster recovery runbook**: Step-by-step procedures for common failures (database corruption, region outage, accidental deletion).
5. **No backup integrity verification**: Backups are created but not verified for completeness or corruption.
6. **Annual archives to "cold storage" with no retrieval test**: Cold storage retrieval can take hours. Is this acceptable for a tax audit?

### 11.5 Scalability Projections

| Scale | Transactions/Year | GL Rows/Year | Audit Rows/Year | Assessment |
|-------|-------------------|-------------|-----------------|------------|
| 1 church | ~1,000 | ~2,000 | ~5,000 | No issues |
| 100 churches | ~100,000 | ~200,000 | ~500,000 | Minor bottlenecks in reporting |
| 1,000 churches | ~1,000,000 | ~2,000,000 | ~5,000,000 | Hash chain bottleneck becomes significant |
| 10,000 churches | ~10,000,000 | ~20,000,000 | ~50,000,000 | System fails without major rearchitecture |
| 100,000 churches | ~100,000,000 | ~200,000,000 | ~500,000,000 | Requires full distributed architecture |

The current architecture scales to approximately **100-200 churches** before performance degradation becomes noticeable. Beyond that, the shared database, audit hash chain, and report generation will cause problems.

### 11.6 Operational Maturity

| Practice | Status | Notes |
|----------|--------|-------|
| Infrastructure as Code | ❌ Missing | No Terraform/Pulumi/CDK |
| Configuration Management | ❌ Missing | No config-as-code; settings in database only |
| Secret Management | ⚠️ Partial | Relies on Supabase Vault; no rotation |
| Log Aggregation | ⚠️ Partial | Pino structured logs but no aggregation system |
| Distributed Tracing | ❌ Missing | No tracing infrastructure |
| Capacity Planning | ❌ Missing | No load testing or capacity model |
| Incident Management | ⚠️ Partial | Response procedure exists but no on-call rotation, escalation, or postmortem process |
| Change Management | ❌ Missing | No change approval process documented |
| Business Continuity | ❌ Missing | No BCP document; no failover testing |
| Compliance Monitoring | ❌ Missing | No automated compliance checks |

---

## 12. Alternative Designs

### 12.1 Alternative: Per-Church PostgreSQL Schemas Instead of Single Database

**Current**: All churches in one PostgreSQL database with no tenant isolation (CF-4).
**Alternative**: Each church gets its own PostgreSQL schema (`church_{id}.journal_entries`) within a shared database, or its own Supabase project.

**Trade-offs:**
- Pro: Complete data isolation; independent backup/restore; per-church performance tuning; simpler RLS (or no RLS needed)
- Pro: Churches can be on different versions (staggered upgrades)
- Pro: One church's heavy reporting doesn't impact others
- Con: Higher Supabase costs (per-project pricing); more complex migration management; cross-church reporting requires federation
- Con: Schema-per-church requires connection pooling per schema

**Recommendation**: Use separate Supabase projects for churches above a certain size threshold (e.g., 5,000 members). Use schema-per-church for smaller churches on a shared instance. This balances cost and isolation.

### 12.2 Alternative: Replace SERIALIZABLE with SELECT FOR UPDATE

**Current**: SERIALIZABLE isolation for all financial transactions (TRANSACTION_ENGINE.md §4.3).
**Alternative**: Use READ COMMITTED with explicit `SELECT ... FOR UPDATE` on rows that need serialization (fund balances, journal entries being approved).

**Trade-offs:**
- Pro: Better throughput — SERIALIZABLE aborts on any conflict; FOR UPDATE only blocks conflicting operations
- Pro: Predictable behavior — developers understand locking better than serialization failures
- Pro: Easier to debug — deadlocks show in pg_locks; serialization failures are opaque
- Con: Must explicitly lock all rows that need protection — easy to miss one
- Con: Potential for deadlocks if lock ordering is inconsistent

**Recommendation**: Use READ COMMITTED + FOR UPDATE with a defined lock ordering (always lock funds before journal entries, always lock parent before child). Keep SERIALIZABLE as an optional enforcement layer for critical operations like period closing.

### 12.3 Alternative: Per-Church Hash Chains Instead of Global Chain

**Current**: Single global hash chain for all audit entries (CF-3).
**Alternative**: Each church has an independent hash chain. The first entry for each church has `previous_hash = NULL`. Cross-church correlation uses `correlation_id`, not hash chain.

**Trade-offs:**
- Pro: No serialization across churches — parallel writes scale linearly with churches
- Pro: Church A's audit verification doesn't require reading Church B's entries
- Con: Cannot prove global ordering across churches without additional mechanism
- Con: More complex archival and SIEM forwarding

**Recommendation**: Implement per-church hash chains. The hash chain's purpose is to verify that ONE entity's audit trail is intact, not to establish global ordering. Church A doesn't need cryptographic proof that Church B's entries weren't tampered with — they're separate legal entities.

### 12.4 Alternative: Event Sourcing Instead of CRUD + Audit Trail

**Current**: Standard CRUD with separate audit trail table.
**Alternative**: Use event sourcing where the journal_entries, general_ledger, and audit_log are all projections of an immutable event stream.

**Trade-offs:**
- Pro: Natural double-entry — journal entries ARE events
- Pro: Audit trail is the source of truth, not an artifact
- Pro: Time-travel queries (reconstruct state at any point) are built-in
- Pro: No separate audit table needed
- Con: Significant learning curve for the team
- Con: Eventual consistency model (though financial projections can be synchronous)
- Con: Tooling less mature than PostgreSQL CRUD

**Recommendation**: Do NOT adopt event sourcing for v2. The current CRUD + audit trail is correct and well-understood. Revisit for v3 if the team gains event sourcing expertise. The risk of incorrect implementation in a financial system outweighs the architectural elegance.

---

## 13. Risk Matrix

| Risk | Likelihood | Impact | Mitigation Status | Residual Risk |
|------|-----------|--------|-------------------|---------------|
| Cross-document contradiction causes implementation bug | HIGH | HIGH | Not mitigated — documents unreconciled | **HIGH** |
| Insider fraud via super_admin single-approval | MEDIUM | CRITICAL | Not mitigated — super_admin has unlimited power | **CRITICAL** |
| Data breach via staging environment sync | MEDIUM | CRITICAL | Not mitigated — daily production sync to staging | **CRITICAL** |
| Database corruption without tenant isolation | LOW | CRITICAL | Not mitigated — no per-church restore | **HIGH** |
| Hash chain write bottleneck at scale | HIGH (at >100 churches) | MEDIUM | Not mitigated | **MEDIUM** |
| JWT secret compromise without rotation | LOW | CRITICAL | Not mitigated — no key rotation plan | **HIGH** |
| Migration data loss (localStorage cleared before export) | MEDIUM | HIGH | Partial — user-initiated export | **MEDIUM** |
| Supabase vendor lock-in prevents migration | LOW | MEDIUM | Not mitigated | **MEDIUM** |
| Untested backups fail during restore | MEDIUM | CRITICAL | Not mitigated — no restore testing | **CRITICAL** |
| Double-entry implementation error (accounting logic bug) | MEDIUM | CRITICAL | Partial — accounting consultant review mentioned | **HIGH** |
| Performance degradation under concurrent load | MEDIUM | MEDIUM | Partial — retry logic exists but SERIALIZABLE is expensive | **MEDIUM** |
| Thai tax law changes requiring schema changes | LOW | MEDIUM | Partial — extensible COA design | **LOW** |

---

## 14. Scalability Assessment

### 14.1 By Number of Churches

| Churches | Write Throughput | Read Throughput | Storage | Status |
|----------|-----------------|-----------------|---------|--------|
| 1 | < 1 txn/min | < 10 queries/min | < 100 MB | ✅ Trivial |
| 10 | < 5 txn/min | < 50 queries/min | < 1 GB | ✅ No issue |
| 100 | < 50 txn/min | < 500 queries/min | < 10 GB | ⚠️ Need connection pooling |
| 1,000 | < 500 txn/min | < 5,000 queries/min | < 100 GB | ❌ Hash chain bottleneck; need read replicas |
| 10,000 | < 5,000 txn/min | < 50,000 queries/min | < 1 TB | ❌ Requires full rearchitecture |
| 100,000 | < 50,000 txn/min | < 500,000 queries/min | < 10 TB | ❌ Single PostgreSQL cannot handle this |

### 14.2 By Transaction Volume

Per church:
- Small church: ~500 transactions/year (weekly offerings + monthly expenses)
- Medium church: ~2,000 transactions/year (weekly + salary + transfers)
- Large church: ~10,000 transactions/year (daily activity + projects + payroll)

The GL grows at 2x transaction rate (debit + credit lines). The audit log grows at ~5x (create + submit + approve + GL entries + fund update).

### 14.3 Scaling Recommendations (Before 100 Churches)

1. Implement per-church hash chains (CF-3 mitigation)
2. Add read replicas for report generation
3. Partition audit_log by church_id + year
4. Implement connection pooling (PgBouncer or Supabase connection pooler)
5. Move report generation to async jobs with materialized views

---

## 15. Compliance Assessment

### 15.1 PDPA (Thailand Personal Data Protection Act)

| Requirement | Status | Gap |
|-------------|--------|-----|
| Consent management | ✅ Addressed | `consent_given` + `consent_date` fields |
| Data subject access request | ⚠️ Partial | Data export endpoint mentioned but no SAR workflow |
| Right to erasure | ⚠️ Partial | Anonymization endpoint mentioned but member records may be needed for audit |
| Data breach notification | ⚠️ Partial | 72-hour notification mentioned but no notification procedure |
| Data retention policy | ✅ Addressed | 7-year retention documented |
| Cross-border data transfer | ❌ Not addressed | Supabase data residency; CDN edge locations |
| Data Protection Officer | ❌ Not addressed | No DPO role in the role hierarchy |

### 15.2 Thai Revenue Code

| Requirement | Status | Gap |
|-------------|--------|-----|
| 7-year record retention | ✅ Addressed | Archival policy to cold storage |
| Withholding tax (ภ.ง.ด.3, ภ.ง.ด.53) | ⚠️ Partial | Accounts exist but no form generation |
| Donation receipt requirements | ⚠️ Partial | Sequential numbering; format not validated against Revenue Department specs |
| Annual financial statements | ⚠️ Partial | Balance sheet + income statement exist; cash flow statement missing |
| Audit trail integrity | ✅ Addressed | Hash-chained, verifiable |

### 15.3 TFRS (Thai Financial Reporting Standards)

| Requirement | Status | Gap |
|-------------|--------|-----|
| Chart of accounts mapping | ✅ Addressed | `tfrs_code` on all accounts |
| Double-entry bookkeeping | ✅ Addressed | Core accounting engine |
| Accrual basis (if applicable) | ❌ Not addressed | Cash-basis only |
| Fixed asset depreciation | ❌ Not addressed | No depreciation module |

---

## 16. Final Scores

| Score Category | Score | Justification |
|---------------|-------|---------------|
| **Production Readiness** | 62/100 | 6 critical findings that would cause financial loss or data breach. Cannot be deployed to production as documented. |
| **Implementation Readiness** | 71/100 | Detailed implementation roadmap exists. But cross-document contradictions mean implementers will make conflicting choices. Code-level detail (Money class, state machine, SQL) is strong. |
| **Maintainability** | 68/100 | Clean layered architecture. Well-defined directory structure. The dual balance storage and global audit chain are maintenance liabilities. |
| **Scalability** | 55/100 | Single PostgreSQL with global hash chain limits to ~100 churches. No horizontal scaling strategy. No tenant isolation. |
| **Security** | 67/100 | Good defense-in-depth philosophy. Authentication and authorization are well-modeled. Undermined by staging data risk, super_admin unlimited power, and tenant isolation gap. |
| **Accounting Integrity** | 65/100 | Double-entry foundation is sound. Undermined by fund accounting gaps (funds as equity accounts), missing year-end close, missing depreciation, cash-only basis. |
| **Operational Readiness** | 44/100 | Worst-scoring category. No DR testing, no restore testing, no SLO, no capacity planning, no IaC, no runbooks. The system could be built correctly and still fail in production due to operational gaps. |
| **Composite** | **62/100** | Grade C+. Architecture is a strong foundation but is not ready for production deployment. |

---

## 17. Final Recommendation

### Verdict: CONDITIONAL APPROVAL — DO NOT PROCEED TO IMPLEMENTATION

The Grace Ledger v2 architecture is a **solid foundation with critical flaws that must be remediated before any code is written.**

**Two possible paths forward:**

### Path A: Remediate Architecture (Recommended — 8-12 weeks)

1. **Reconcile all 10 documents** into agreement. The approval workflow contradiction (CF-1) alone could cause production fraud.
2. **Resolve all 6 Critical Findings** before any code is written.
3. **Design tenant isolation** (CF-4) as a first-class architectural decision.
4. **Engage a Thai CPA** to review the chart of accounts, year-end close procedure, and tax compliance features.
5. **Engage a security architect** to review the dual approval logic and RLS implementation.
6. **Write operational runbooks** before writing application code.
7. **Define SLO/SLI/SLA** for the production system.
8. **Produce a single reconciled "source of truth" document** that supersedes the 10 separate documents where they conflict.

**After remediation, re-score and proceed only if composite score ≥ 80/100.**

### Path B: Scope Down to Single-Church MVP

If timeline pressure prevents full remediation:

1. Remove all multi-church claims from the architecture.
2. Deploy one Supabase project per church.
3. Remove the hash chain (single church with immutable audit table is sufficient for MVP).
4. Simplify approval to pastor-only (no tiered approval for single small church).
5. Add the multi-church architecture as a v3 milestone with proper tenant isolation design.

**Estimated score after scoping down: 78/100 — acceptable for single-church pilot deployment with close monitoring.**

### What the Architecture Gets Right

The team clearly understands:
- Double-entry accounting
- Financial fraud prevention
- Audit trail integrity
- Church operations (Sunday count sheet is excellent domain modeling)
- Layered security (defense in depth)
- Thai regulatory context

The architecture is worth fixing. The problems are in the **integration** between components, not in the components themselves. Reconcile the documents, fix the critical findings, and this can be a production-grade church financial system.

---

*This review was conducted by the Architecture Review Board assuming multiple professional roles. The findings represent our collective assessment that Grace Ledger v2 architecture requires significant remediation before it is safe for production deployment managing real church finances. We look forward to reviewing the remediated architecture.*

*Review Date: 22 July 2026*
*Next Review: After remediation (estimated October 2026)*
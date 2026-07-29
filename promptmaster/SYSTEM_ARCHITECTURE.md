# System Architecture & Business Domain Guide — Grace Ledger v2

This document provides AI models and human developers with a complete, authoritative overview of Grace Ledger v2's domain architecture, accounting rules, and technical implementation.

---

## 1. Double-Entry Accounting Engine (`src/server/domain/journal.ts`)

Grace Ledger v2 strictly enforces double-entry bookkeeping rules:

1. **Balanced Debits and Credits:** Every journal entry must satisfy:
   $$\sum \text{Debits} = \sum \text{Credits}$$
   If an unbalanced entry is submitted, `UnbalancedEntryError` (`UNBALANCED_ENTRY`) is thrown.
2. **Posting Date Validation:** Transactions cannot be posted to a closed fiscal period (`CLOSED_PERIOD`) or a future date (`FUTURE_DATE`).
3. **Fund Balance Management:** Drawing from a fund checks available fund balance (`checkFundBalance`). Insufficient funds throw `InsufficientFundsError` (`INSUFFICIENT_FUNDS`).
4. **Fund Linkage Enforcement:** Funds can only be linked to Equity accounts (Account code starting with `3-xxxx`). Attempting to link a fund to Asset/Income/Expense accounts throws `INVALID_ACCOUNT_TYPE`.

---

## 2. Monetary Precision & The `Money` Class (`src/server/domain/money.ts`)

- **Never Use JavaScript Floats:** Floating-point arithmetic (`0.1 + 0.2 = 0.30000000000000004`) causes financial rounding corruption.
- **`Money` Domain Class:** All monetary values are represented as integer cents internally using `decimal.js-light` precision.
- **Usage Example:**
  ```ts
  import { Money } from "@/server/domain/money";

  const amount1 = Money.fromBaht("500.00");
  const amount2 = Money.fromBaht("150.50");
  const total = amount1.add(amount2); // Money object (฿650.50)

  console.log(total.formattedTHB); // "฿650.50"
  console.log(total.toSqlDecimal()); // "650.50"
  ```

---

## 3. Financial Controls & Segregation of Duties (`src/server/auth/permissions.ts`)

To prevent fraud and satisfy audit compliance for churches:

1. **Self-Approval Prevention:** The user who creates a journal entry cannot approve their own entry (`SelfApprovalError`).
2. **Dual-Approval Threshold:**
   - Single Approval (Amount $\le$ ฿50,000): Approved by an `admin` or `super_admin`.
   - Dual Approval (Amount $>$ ฿50,000): Requires approval by two distinct approvers (`approval1Id` and `approval2Id`).

---

## 4. Multi-Tenant Scoping & SHA-256 Audit Trail (`src/server/services/audit.service.ts`)

1. **Mandatory Church Isolation:** Every database entity (`journal_entries`, `funds`, `members`, `audit_log`) contains a required `church_id` column.
2. **SHA-256 Hash Chaining:** Audit log entries compute a SHA-256 hash using the previous entry's hash for that specific church:
   $$\text{Hash}_n = \text{SHA256}(\text{ChurchID} + \text{EventType} + \text{EntityID} + \text{Timestamp} + \text{Hash}_{n-1})$$
3. **Chain Verification:** Calling `AuditService.verifyChain(churchId)` scans historical entries and detects any unauthorized database tampering or line deletions.

---

## 5. In-Memory PGlite Test Infrastructure (`src/server/infrastructure/db.ts`)

- **Zero-Dependency Testing:** When running `VITEST`, `db.ts` automatically initializes an in-memory `@electric-sql/pglite` WebAssembly PostgreSQL engine.
- **Automatic DDL Schema Injection:** All 22 tables from `src/db/schema.ts` are automatically migrated at test runtime.
- **Result:** Fast, isolated integration tests (`npm test`) execute locally without needing Docker or a live database daemon.

# Business Domain Audit — Grace Ledger (ระบบการเงินคริสตจักร)

**Date:** 22 July 2026  
**Audited by:** Principal Software Architect, Principal Security Engineer, Senior DBA, Financial Systems Architect, Church Financial Consultant, UX Lead, QA Lead, DevOps Lead  
**Scope:** Full codebase review — data models, service layer, UI flows, permissions, reconciliation, reporting, audit trail, data integrity

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture & Systemic Risks](#2-architecture--systemic-risks)
3. [Data Model & Accounting Integrity](#3-data-model--accounting-integrity)
4. [Fund Accounting & Balance Sheet](#4-fund-accounting--balance-sheet)
5. [Transaction Lifecycle & Approval Workflows](#5-transaction-lifecycle--approval-workflows)
6. [Offering Management](#6-offering-management)
7. [Expense Management](#7-expense-management)
8. [Income Management](#8-income-management)
9. [Fund Transfers](#9-fund-transfers)
10. [Budget Management](#10-budget-management)
11. [Reconciliation](#11-reconciliation)
12. [Reporting](#12-reporting)
13. [Permissions & Authorization](#13-permissions--authorization)
14. [Authentication & Session Security](#14-authentication--session-security)
15. [Audit Trail](#15-audit-trail)
16. [Concurrency & Race Conditions](#16-concurrency--race-conditions)
17. [Data Persistence & Backup](#17-data-persistence--backup)
18. [Fraud Vectors & Financial Controls](#18-fraud-vectors--financial-controls)
19. [UX & Workflow Concerns](#19-ux--workflow-concerns)
20. [DevOps & Production Readiness](#20-devops--production-readiness)
21. [Compliance & Audit Readiness](#21-compliance--audit-readiness)
22. [Prioritized Remediation Roadmap](#22-prioritized-remediation-roadmap)

---

## 1. Executive Summary

Grace Ledger is a **Phase 1 prototype** built on TanStack Start (React + Vite) with a localStorage-backed mock database. It serves as a church financial management system for Thai churches, covering offerings, income, expenses, funds, budgets, projects, members, and reconciliation.

**Critical Finding:** This application is **not ready for production** and would **fail an external financial audit immediately**. The localization to Thai language and Thai Baht currency is adequate, but the underlying financial architecture has fundamental gaps that would lead to data inconsistency, unauditability, and potential financial loss.

**Severity Summary:**

- 🔴 **Critical (9):** Issues that would cause financial data corruption, regulatory failure, or irrecoverable audit gaps
- 🟠 **High (17):** Issues that enable fraud, bypass controls, or cause unreliable reporting
- 🟡 **Medium (14):** Process gaps and UX deficiencies that degrade trust or operational efficiency
- 🟢 **Low (5):** Cosmetic or future-improvement items

---

## 2. Architecture & Systemic Risks

### 2.1 🟠 Single-Tier Client-Only Storage (Architect)

**Finding:** All financial data resides exclusively in `window.localStorage` with no server-side persistence, backup, or replication.

**Impact:**

- A browser cache clear, localStorage quota exceeded, or device failure results in **total loss of all financial records** — every offering, every expense, every audit log
- No multi-user concurrent access (data is local to one browser)
- No cross-device sync — different church staff see different data on different machines

**External Auditor Assessment:** Immediate disqualification. Financial systems require durable, server-side persistence with backup/recovery capabilities.

**Recommendation:** Migrate to an ACID-compliant database (PostgreSQL) with automated backups, point-in-time recovery, and a proper API layer.

### 2.2 🔴 No Transactional Boundaries (Senior DBA)

**Finding:** All mutations in `church.ts` operate via `updateDb(fn)` which reads, mutates, and writes the entire DB as a single JSON blob. There are no atomic operations, no rollback capabilities, and no isolation.

```typescript
// church.ts — updateDb is a simple read-modify-write with no atomicity guarantee
export function updateDb(fn: (db: DB) => void) {
  const db = loadDb();
  fn(db); // If this throws mid-way, partial mutations persist on next attempt
  saveDb();
  return db;
}
```

**Impact:**

- If `saveDb()` fails (quota exceeded, parse error), mutations are applied in memory but not persisted — next page load loses them
- If `loadDb()` fails during an operation, a brand-new `seed()` database is returned, silently replacing all data
- Multiple rapid operations can interleave and corrupt data

**Recommendation:** Implement ACID transactions at the persistence layer. Each mutation must be atomic — either fully applied or fully rolled back.

### 2.3 🔴 No Server-Side Validation (Security Engineer)

**Finding:** All business logic and validation runs in the browser. A malicious user can open DevTools, call `loadDb()` directly, and modify any record — balances, transaction amounts, statuses, audit logs, user PINs.

**Examples of what an attacker can do client-side:**

```javascript
// Anyone with DevTools can:
db.expenses.push({ id: "fake", amount: -999999, ... })  // Negative expense = free money
db.offeringCategories = []  // Delete all offering categories
db.audit = []  // Erase audit trail
db.settings.fiscalYearStart = 13  // Corrupt fiscal year
db.session.userId = "u1"  // Impersonate super_admin
```

**Impact:** Complete trust in client-side data is violated. Every single data record is mutable by any user with access to the browser.

**Recommendation:** Move all business logic, validation, and authorization checks to a server-side API. The client should only send commands; the server must verify and execute them.

### 2.4 🟠 Seed Data Contains Realistic Financial Figures (Church Consultant)

**Finding:** The `seed()` function creates offerings, expenses, and fund balances that look like real church financial data:

- Fund `f1` (กองทุนทั่วไป) has an `openingBalance` of **-7,553** (negative equity — a liability)
- Fund `f2` (บัญชีธนาคาร) has `openingBalance` of **+13,825.06**
- 150+ offering records spanning January–July 2026 with specific amounts
- 29 expense records with specific amounts

**Impact:** If this seed data were accidentally used in production, it would create phantom transactions and incorrect balances. The negative fund balance is also a financial red flag.

**Recommendation:** Seed data should use obviously synthetic values (e.g., 0 balances, "DEMO" markers, amounts that are clearly placeholders like ฿100.00). Remove or isolate seed data from production paths.

---

## 3. Data Model & Accounting Integrity

### 3.1 🔴 No Double-Entry Bookkeeping (Financial Systems Architect)

**Finding:** The system uses **single-entry bookkeeping**. Income, expenses, and offerings are stored as independent lists with no linked debit/credit entries.

```
Current model:  Income[] + Expense[] + Offering[]
Expected model: Transaction { id, date, entries: [ { account, debit, credit }, ... ] }
```

**Impact:**

- Impossible to verify that the books balance through the system itself — balancing is done ad-hoc in the reconciliation page
- No audit trail of _why_ a balance changed — only _what_ changed
- Cannot trace a fund's balance through journal entries
- A deleted income record silently changes the fund balance with no corresponding entry

**Recommendation:** Implement double-entry bookkeeping with a chart of accounts, journal entries, and a general ledger. Every transaction must have balanced debits and credits.

### 3.2 🔴 Fund Balance is Computed, Not Stored (Financial Systems Architect)

**Finding:** Fund balances are calculated at query time by summing `openingBalance + incomes - expenses + offerings`. There is no authoritative stored balance per fund.

```typescript
// Every balance calculation is ad-hoc in the UI:
const balance = f.openingBalance + income + offering - expense;
```

**Impact:**

- Any data corruption (duplicate entry, missing entry) silently propagates through all balance calculations
- Cannot verify that a fund's balance is correct without recalculating from scratch
- No way to detect if a historical balance was tampered with (since there's no stored snapshot)
- Every component that calculates a balance is a potential point of inconsistency

**Recommendation:** Store a running balance per fund that is updated atomically with each transaction. Maintain a balance history with timestamps and transaction references. The computed balance should be verified against the stored balance, not used as the sole source of truth.

### 3.3 🔴 No Chart of Accounts (Financial Systems Architect)

**Finding:** Categories are flat lists (`Category { id, name, kind }`) with no hierarchical structure, no account codes, and no accounting standard mapping.

**Example of missing structure:**

- "ค่าสาธารณูปโภค" (Utilities) — is this an operating expense or a ministry expense?
- "ดอกเบี้ย" (Interest) — should this be non-operating income?
- No distinction between restricted and unrestricted funds

**Impact:**

- Cannot generate GAAP-compliant financial statements (Income Statement, Balance Sheet, Statement of Cash Flows)
- No account numbering system (1xxx Assets, 2xxx Liabilities, 3xxx Equity, 4xxx Income, 5xxx Expenses)
- Thai Revenue Department requires specific account classifications for tax purposes

**Recommendation:** Implement a chart of accounts with:

- Account codes (e.g., 4-1001 for Tithe Income, 5-2001 for Utilities Expense)
- Account types (Asset, Liability, Equity, Income, Expense)
- Parent-child hierarchy
- Mapping to Thai accounting standards (TFRS for PAEs)

### 3.4 🟠 No Fiscal Year Handling (Church Consultant)

**Finding:** The `Settings` type has `fiscalYearStart: number` (month 1-12), but this is **never used in any calculation or report**.

```typescript
export interface Settings {
  fiscalYearStart: number; // month 1-12 — NEVER CONSUMED ANYWHERE
}
```

**Impact:**

- All date-based reports assume calendar year (Jan-Dec), which may not match the church's fiscal year
- Fiscal year close/open procedures are not implemented
- Retained earnings are not tracked across fiscal years

**Recommendation:** Actually consume `fiscalYearStart` in all period calculations. Implement fiscal year boundaries in reporting, budget cycles, and balance carry-forward.

### 3.5 🟠 No Opening/Closing Period Controls (Financial Systems Architect)

**Finding:** There is no mechanism to close a period (month/year). Transactions can be added, modified, or deleted in any past period at any time.

**Impact:**

- Financial reports for "closed" periods can silently change
- Auditors reviewing last month's report may find different numbers the next day
- No way to lock a reconciled month to prevent back-dated entries

**Recommendation:** Implement period closing that:

1. Locks all transactions dated within the closed period
2. Stores a snapshot of all balances at closing
3. Requires special authorization (auditor role) to reopen a closed period
4. Logs all period open/close events in the audit trail

---

## 4. Fund Accounting & Balance Sheet

### 4.1 🔴 Fund Opening Balance Bug — Negative Equity (Church Consultant)

**Finding:** The seed data for Fund `f1` (กองทุนทั่วไป / General Fund) has `openingBalance: -7553`. Combined with the checking account fund (`f2`, opening balance +13,825.06), the system starts with a net positive but Fund f1 is in deficit.

**Accounting Analysis:**

- A negative opening balance means the fund starts with a liability — the church owes money that doesn't exist in the records
- If this represents accumulated deficit from prior periods, it should be tracked as retained earnings, not negative fund balance
- The system has no concept of liabilities or deficit tracking

**Recommendation:**

1. Establish a proper equity structure (Net Assets = Assets - Liabilities)
2. Never allow fund balances to go negative without explicit liability entries
3. Add a fund balance floor check — transactions that would make a fund negative should require override authorization

### 4.2 🟠 No Fund Balance Validation on Transaction Creation (Financial Systems Architect)

**Finding:** When creating an expense against Fund `f1`, the system does not check if the fund has sufficient balance. The only place this check exists is in `FundTransferDialog` — and only for the _from_ fund, not for any expense.

```typescript
// FundTransferDialog.tsx — only place this check exists
const insufficient = fromId && amount > fromBal;
```

**Impact:** An expense of ฿100,000 can be recorded against a fund with only ฿5,000 — silently driving the fund negative. The reconciliation page will show the deficit but won't prevent it.

**Recommendation:**

1. Add fund balance validation on every expense and transfer creation
2. Block transactions that would make a fund negative (with authorized override for overdrafts)
3. Show a real-time fund balance when selecting a fund in the expense form

### 4.3 🟠 No Fund Transfer Atomicity (Senior DBA)

**Finding:** The `transferFund()` function creates two independent records (one expense, one income) with no atomic link between them:

```typescript
export async function transferFund(fromId: string, toId: string, amount: number, by: User) {
  updateDb((db) => {
    db.expenses.unshift({ id: newId("e"), ... });  // Record 1
    db.incomes.unshift({ id: newId("i"), ... });    // Record 2
  });
}
```

**Impact:** If one record succeeds and the other fails (or is independently deleted later), money appears from nowhere or disappears. The two entries have no cross-reference, so reconciliation cannot detect if one side is missing.

**Recommendation:** Fund transfers must be a single atomic journal entry with paired debit/credit lines that cannot be independently modified.

### 4.4 🟡 No Inter-Fund Loan Tracking (Church Consultant)

**Finding:** The fund transfer mechanism is a simple "move money from A to B" operation. There is no concept of inter-fund loans, repayments, or temporary allocations.

**Impact:** If Fund A temporarily lends money to Fund B with the intention of repayment, this cannot be tracked. The transfer looks permanent.

**Recommendation:** Add a `FundTransferType` (permanent | loan | allocation) and track loan repayment schedules if applicable.

---

## 5. Transaction Lifecycle & Approval Workflows

### 5.1 🔴 Status Transitions Not Enforced (Financial Systems Architect)

**Finding:** The `setExpenseStatus()` function accepts any `TxStatus` value without validating the transition:

```typescript
export async function setExpenseStatus(id: string, status: TxStatus, by: User) {
  updateDb((db) => {
    const it = db.expenses.find((x) => x.id === id);
    if (it) {
      it.status = status; // Any status change accepted — no validation
      if (status === "approved") it.approvedBy = by.id;
    }
  });
}
```

**Valid transitions that should be enforced:**

- `draft` → `pending` (submit for approval)
- `pending` → `approved` (approver action)
- `pending` → `rejected` (approver action)
- `rejected` → `draft` (resubmit after edits)
- `draft` → DELETED (only draft can be deleted)

**Currently possible invalid transitions:**

- `approved` → `rejected` (undoing an approval without audit)
- `approved` → `draft` (hiding an approved transaction)
- `draft` → `approved` (bypassing approval workflow)
- Direct modification of `approvedBy` without changing status

**Impact:** The approval workflow is trivially bypassable. An approved expense can be silently changed to draft and re-edited.

**Recommendation:** Implement a state machine with valid transitions, permission checks, and full audit logging of every status change.

### 5.2 🟠 No Segregation of Duties Between Creator and Approver (Security Engineer)

**Finding:** The approval check is:

```typescript
{can("expense.approve") && r.status === "pending" && (
  // Show approve button
)}
```

There is no check that the approver is **different from the creator**. A treasurer with `expense.write` + a pastor with `expense.approve` is the intended flow, but if super_admin has both permissions, they can create and approve their own transactions.

**Impact:** Self-approval defeats the purpose of the approval workflow. This is a fundamental internal control violation.

**Recommendation:**

1. Prevent a user from approving their own transactions (`r.createdBy !== user.id`)
2. Require at least two different individuals for create + approve
3. For large amounts (> threshold), require dual approval

### 5.3 🟡 No Transaction Amount Thresholds for Approval (Church Consultant)

**Finding:** All transactions go through the same approval flow regardless of amount. A ฿100 expense and a ฿100,000 expense require the same approval.

**Recommendation:** Implement tiered approval:

- < ฿5,000: finance_staff can create, treasurer approves (or auto-approve)
- ฿5,000 – ฿50,000: treasurer creates, pastor approves
- > ฿50,000: pastor creates, requires dual approval (pastor + super_admin or board)

### 5.4 🟠 Approval Rejection Has No Reason Field (UX Lead)

**Finding:** The reject action for expenses calls `setExpenseStatus(id, "rejected", user)` with no field for the rejection reason. The creator has no way to know _why_ the transaction was rejected.

**Impact:** Creates friction in the approval workflow. Rejected transactions pile up without resolution.

**Recommendation:** Add a required `rejectionReason` field to the reject flow, displayed to the creator.

---

## 6. Offering Management

### 6.1 🟠 Offerings Have No Status/Approval (Financial Systems Architect)

**Finding:** The `Offering` type has no `status` or `approvedBy` fields. Every offering is immediately committed with no approval workflow.

```typescript
export interface Offering {
  id: string;
  // ... no status field, no approvedBy
  createdBy: string;
}
```

**Impact:** Offerings bypass the entire approval workflow. Anyone with `offering.write` can record fraudulent offerings that immediately affect fund balances. Meanwhile, the income page treats all offerings as `status: "approved"` by convention, not by data.

**Recommendation:** Add `status` and `approvedBy` fields to Offering. Require offerings to go through the same approval workflow as income. The `SundayCountSheet` should create draft offerings that require approval.

### 6.2 🟠 No Sunday Count Sheet Reconciliation with Independent Counters (Church Consultant)

**Finding:** The Sunday Count Sheet (`SundayCountSheet.tsx`) has 3 counters but:

1. All three counters' data is entered into the **same** browser by the **same** user — there's no independent verification
2. The counter names are free-text fields with no authentication
3. Counters 2 and 3 are optional — the system doesn't enforce a minimum of 2 counters

**Church Financial Best Practice:** Cash counting requires at least 2 **unrelated** individuals counting independently, then comparing results. Any discrepancy requires a recount.

**Impact:** A single person can falsify the entire Sunday count by entering any names as counters. This is the single highest-risk fraud vector in a church — cash offerings counted by one person with no verification.

**Recommendation:**

1. Require minimum 2 authenticated counters
2. Implement a counter reconciliation step where counters independently enter their counts and the system compares them
3. Lock the count sheet after all counters have verified
4. Add a physical count sheet printout that counters sign (currently only a browser print)

### 6.3 🟠 All Offerings Hardcoded to Fund f1 (Architect)

**Finding:** In `SundayCountSheet.tsx`, every offering is hardcoded to `fundId: "f1"`:

```typescript
await createOffering({
  date,
  categoryId: c.catId,
  amount: c.amt,
  channel: r.channel === "cash" ? "cash" : "bank",
  fundId: "f1",  // HARDCODED
  note: `ถวายโดย: ${r.name || "ไม่ระบุชื่อ"} | ผู้นับ: ${[...].join(", ")}`,
}, user);
```

**Impact:** All Sunday offerings go to the General Fund (กองทุนทั่วไป), making it impossible to allocate offerings to specific funds (e.g., Building Fund, Mission Fund) through the Sunday count sheet.

**Recommendation:** Let the user select the destination fund per offering row or per category. The individual offering form already supports this — the Sunday sheet should too.

### 6.4 🟡 No Offering Correction Workflow (Church Consultant)

**Finding:** The only mutation on offerings is `deleteOffering()`. There is no way to correct an offering amount — you must delete and re-enter it, losing the audit trail of the correction.

**Recommendation:** Add an `updateOffering()` function with full audit logging of the before/after values. Corrections should create an audit entry showing the original and corrected amounts.

### 6.5 🟡 Member Not Linked to Offering for Tracking (Church Consultant)

**Finding:** Offerings have an optional `memberId` field, but the Sunday count sheet enters member names as free text in the `note` field, not linking to member records.

```typescript
note: `ถวายโดย: ${r.name || "ไม่ระบุชื่อ"} | ผู้นับ: ${[...].join(", ")}`
```

**Impact:** Cannot generate member giving statements, track individual tithing patterns, or issue annual tax receipts for donations. This is a critical feature for church financial management.

**Recommendation:** Link Sunday count sheet names to actual member records. If a name doesn't match, prompt to create a new member. Generate annual giving statements per member.

---

## 7. Expense Management

### 7.1 🟠 Expenses Can Be Deleted at Any Status (Financial Systems Architect)

**Finding:** `deleteExpense()` has no status check:

```typescript
export async function deleteExpense(id: string, by: User) {
  updateDb((db) => {
    db.expenses = db.expenses.filter((x) => x.id !== id); // No status check
  });
}
```

A user with `expense.write` can delete an **approved** expense, silently removing it from the books with no audit trail of what was deleted (only a "delete" audit entry with no amount).

**Impact:** Approved expenses can be silently removed. The audit log says "expense deleted" but doesn't capture the amount or details of the deleted record.

**Recommendation:**

1. Only allow deletion of `draft` or `rejected` expenses
2. Approved expenses should be voided (status changed to `voided`) rather than deleted — creating a reversing entry
3. Audit log entries for deletions must capture the full record being deleted

### 7.2 🟡 No Purchase Order / Commitment Tracking (Church Consultant)

**Finding:** Expenses are recorded after the fact. There is no purchase order, commitment, or encumbrance tracking.

**Impact:** A pastor can approve a budget of ฿100,000 for a project, and the treasurer can spend ฿120,000 because there's no pre-spend authorization check against the budget.

**Recommendation:** Add a purchase requisition/order workflow that reserves budget funds before actual expenditure.

### 7.3 🟡 Attachment Receipt Not Validated (Security Engineer)

**Finding:** The `AttachmentInput` component accepts files up to 10MB and stores them as base64 data URLs in localStorage. There is no:

- Virus/malware scanning
- File type validation beyond extension
- Size enforcement on the server side
- Duplicate attachment detection

Since data is stored in localStorage (typically 5-10MB limit per origin), a few large receipt images will exhaust the quota and cause all subsequent saves to fail silently.

**Impact:** localStorage quota exhaustion is a real risk with base64-encoded receipt images. The application provides no warning when approaching the limit.

**Recommendation:** Store attachments in server-side blob/file storage (S3-compatible) with size limits, type validation, and virus scanning. Use references/URLs instead of inline base64 data.

---

## 8. Income Management

### 8.1 🟠 Income Can Be Deleted at Any Status (Financial Systems Architect)

**Finding:** Same as expenses — `deleteIncome()` has no status check:

```typescript
export async function deleteIncome(id: string, by: User) {
  updateDb((db) => {
    db.incomes = db.incomes.filter((x) => x.id !== id);
  });
}
```

**Recommendation:** Mirror the expense recommendation — only draft/rejected can be deleted; approved must be voided with a reversing entry.

### 8.2 🟡 Income and Offering Merged in UI but Not in Data Model (UX Lead)

**Finding:** The income page (`_app.income.tsx`) merges Income and Offering records into a single combined list for display, but they remain separate in the data model with different schemas.

This creates confusion:

- Offerings appear as "approved" by convention, not by data
- Income has `status`, Offering doesn't
- Income has `attachmentDataUrl`, Offering doesn't
- Export CSV includes both but with different available fields

**Recommendation:** Unify Income and Offering into a single `Transaction` type with a `source` discriminator (income | offering). This simplifies queries, reporting, and the data model.

---

## 9. Fund Transfers

### 9.1 🟠 Fund Transfer Creates Matching Expense/Income but No Link (Financial Systems Architect)

Covered in Section 4.3. The paired entries have no cross-reference ID.

### 9.2 🟡 Fund Transfer Has No Approval Workflow (Church Consultant)

**Finding:** Fund transfers are immediately executed as `status: "approved"` with no approval step:

```typescript
db.expenses.unshift({ ...fundId: fromId, status: "approved", ... });
db.incomes.unshift({ ...fundId: toId, status: "approved", ... });
```

**Impact:** Anyone with `fund.write` can transfer arbitrary amounts between funds with no oversight.

**Recommendation:** Require fund transfers to go through approval, especially for large amounts. Add transfer limits per role.

### 9.3 🟡 Fund Transfer Overdraft Prevention is Client-Side Only (Security Engineer)

**Finding:** The overdraft check exists in the React component (`FundTransferDialog.tsx`) but not in the service function (`transferFund()`):

```typescript
// Only in FundTransferDialog.tsx onSubmit:
if (v.amount > (balances[v.fromId] ?? 0)) {
  form.setError("amount", { message: `ยอดกองทุนต้นทางไม่เพียงพอ...` });
  return;
}
```

The `transferFund()` service function has no such check. A user bypassing the UI (or a bug) could transfer more money than exists in a fund.

**Recommendation:** Add server-side balance validation in `transferFund()` itself.

---

## 10. Budget Management

### 10.1 🟡 Budget `used` Field is Never Updated by Any Transaction (Financial Systems Architect)

**Finding:** The `Budget` type has a `used: number` field, but **no code in the entire application updates it**:

```typescript
export interface Budget {
  used: number; // NEVER UPDATED ANYWHERE
}
```

The `listBudget()` function returns budgets from the data store, and the budget page and dashboard display `used / amount` ratios. But since `used` is always 0 (or whatever seed value), the budget tracking is completely non-functional.

**Impact:** Budget vs. actual comparison is a core church financial control. This is completely broken — every budget shows 0% utilization regardless of actual spending.

**Recommendation:** Implement budget tracking that links expenses to budgets and updates `used` in real-time. Or, compute budget utilization dynamically by summing related expenses.

### 10.2 🟡 No Budget Approval Workflow (Church Consultant)

**Finding:** `listBudget()` reads budgets but there is no `createBudget()`, `updateBudget()`, or `deleteBudget()` function. Budgets can only exist in seed data.

**Impact:** Budgets cannot be created, modified, or approved through the UI. They are static and unmanageable.

**Recommendation:** Add full CRUD for budgets with approval workflow. Budget creation should require pastor or super_admin approval.

### 10.3 🟡 No Budget Period Enforcement (Church Consultant)

**Finding:** Budgets have a `period` field (annual/monthly/department/project) and `year`/`month` fields, but these are never validated. A budget marked as "annual" could have a month set, or vice versa.

**Recommendation:** Add validation rules: annual budgets require only year; monthly require year + month; department require year + department name; project require projectId.

---

## 11. Reconciliation

### 11.1 🟠 Reconciliation is Client-Side Only, Not Persisted (Financial Systems Architect)

**Finding:** The reconciliation page (`_app.reconciliation.tsx`) performs all calculations in the browser via `useMemo`. The reconciliation check (system balance vs. actual balance) is:

1. Purely visual — not saved to the database
2. Uses `useState` for actual cash/bank values — lost on page refresh
3. Has no concept of a "reconciled" state that prevents further changes to the period

**Impact:** This is not a reconciliation — it's a calculator. True reconciliation means:

- Comparing system records against external statements (bank statements, cash counts)
- Identifying and explaining discrepancies
- Locking the period after reconciliation
- Storing the reconciliation result as an auditable record

Without persisted reconciliation records, auditors cannot verify that reconciliations were performed or what the results were.

**Recommendation:** Implement proper reconciliation:

1. Store reconciliation records with date, period, system balance, actual balance, difference, and explanation
2. Link reconciling items to specific transactions
3. Lock reconciled periods
4. Require auditor role to sign off on reconciliations

### 11.2 🟠 Opening Balance Calculation Includes All-Time Data, Not Period-Specific (Financial Systems Architect)

**Finding:** The reconciliation page calculates opening balance as:

```typescript
const openingBalance =
  funds.reduce((s, f) => s + f.openingBalance, 0) +
  incomeBefore.reduce((s, x) => s + x.amount, 0) +
  offeringBefore.reduce((s, x) => s + x.amount, 0) -
  expenseBefore.reduce((s, x) => s + x.amount, 0);
```

This uses `all transactions before the period start` — but if a prior period was never reconciled, the opening balance could be wrong. There's no way to verify this opening balance against a previously reconciled closing balance.

**Recommendation:** Chain reconciliations: each period's opening balance must equal the previous period's reconciled closing balance. Any discrepancy must be investigated and explained.

### 11.3 🟡 Fund-Level Opening Balances in Reconciliation Don't Match (Senior DBA)

**Finding:** The "ยอดคงเหลือแยกตามกองทุน" (per-fund balance) section calculates fund balances as:

```typescript
const fundBalance =
  f.openingBalance +
  incomesList.filter((x) => x.fundId === f.id).reduce(...) +  // ALL incomes
  offeringsList.filter((x) => x.fundId === f.id).reduce(...) -  // ALL offerings
  expensesList.filter((x) => x.fundId === f.id).reduce(...);    // ALL expenses
```

But this uses **all-time** data, not period-specific data — inconsistent with the summary statement above it which is period-filtered.

**Recommendation:** Ensure per-fund breakdown is consistent with the period selection.

---

## 12. Reporting

### 12.1 🟠 No Balance Sheet, Income Statement, or Cash Flow Report (Church Consultant)

**Finding:** The reports page only provides a 6-month summary table (income/offering/expense/net). There are no formal financial statements:

- No Balance Sheet (Statement of Financial Position)
- No Income Statement (Statement of Activities)
- No Cash Flow Statement
- No Fund Balance Report
- No Budget vs. Actual Report

**Impact:** The church cannot produce the financial statements required for board meetings, annual general meetings, tax filing, or external audits.

**Recommendation:** Generate the three core financial statements using standardized report templates. Map chart of accounts to statement line items.

### 12.2 🟡 Reports Use `date.startsWith()` for Period Filtering (Senior DBA)

**Finding:** Both dashboard and reports filter transactions by month using string matching:

```typescript
const key = d.format("YYYY-MM");
const income = inc.filter((x) => x.date.startsWith(key)).reduce(...);
```

This works for the `YYYY-MM-DD` format but is fragile:

- If date format changes, all reports break silently
- No date range validation (what if a date is "2026-13-01"?)
- `startsWith` is case-sensitive on strings — unlikely to fail but not robust

**Recommendation:** Use proper date comparison (`dayjs(x.date).isSame(d, 'month')`) or date range bounds.

### 12.3 🟡 Export Functions Have No Data Validation (QA Lead)

**Finding:** The `exportCSV`, `exportExcel`, and `exportPDF` functions accept any data array and column definitions with no validation that the data matches the columns.

**Impact:** A mismatch between data and column definitions produces garbled exports with no error feedback.

**Recommendation:** Add runtime validation of column definitions against data keys. Handle empty datasets gracefully with informational messages in the export.

---

## 13. Permissions & Authorization

### 13.1 🟠 Permission Checks Are Client-Side Only (Security Engineer)

**Finding:** All permission checks use `can(perm)` which checks `MATRIX[user.role].includes(perm)` in React components:

```typescript
{can("offering.write") && <Button>...</Button>}
```

There is **zero server-side authorization**. Since the database is in localStorage, any user can open DevTools and call any `church.ts` function directly:

```javascript
// Any user can execute:
createExpense({ amount: 999999, fundId: "f1", ... }, anyUserObject)
deleteOffering("critical-id", anyUserObject)
transferFund("f1", "f2", 999999, anyUserObject)
```

The `by: User` parameter in every service function is decorative — it's only used for audit logging, not for authorization.

**Recommendation:** Move authorization to a server-side middleware layer. Each API endpoint must verify:

1. The user is authenticated
2. The user's role has the required permission
3. The user is not attempting self-approval
4. The transaction amount is within the user's limit

### 13.2 🟡 Permission Matrix Has Overlaps That Enable Fraud (Security Engineer)

**Finding:** The role matrix allows:

- `super_admin`: ALL permissions — can create, approve own transactions, transfer funds, modify settings, delete audit logs (indirectly via `resetDb`)
- `treasurer`: Can create income, expenses, offerings, AND transfer funds — but cannot approve. However, since offerings have no approval, the treasurer effectively has unchecked power over offerings.

**Actual Permissions Gap:**

```
treasurer has: income.write, expense.write, offering.write, fund.write
treasurer lacks: income.approve, expense.approve, audit.view
```

Income and Expenses created by treasurer require pastor approval (good), but **offerings and fund transfers do not** (bad). A treasurer can record arbitrary offerings and fund transfers with no approval.

**Recommendation:**

1. Add `offering.approve` and `fund.transfer` permissions
2. Give treasurer `offering.write` and `fund.transfer` but require approval for both
3. Separate `fund.transfer` from `fund.write` (fund.write should create funds; fund.transfer should move money)

### 13.3 🟡 No Role-Based UI Hiding for Sensitive Data (UX Lead)

**Finding:** The sidebar navigation shows all menu items regardless of role. The `audit` page redirects viewers, but the menu item still appears.

**Recommendation:** Filter navigation items based on user role. Users who cannot access audit logs should not see the menu item.

---

## 14. Authentication & Session Security

### 14.1 🔴 6-Digit PIN Authentication (Principal Security Engineer)

**Finding:** The entire authentication system is based on 6-digit numeric PINs:

```typescript
const login = useCallback(async (pin: string) => {
  const db = loadDb();
  const u = db.users.find((x) => x.pin === pin) ?? null;
  // ...
}, []);
```

- PINs are stored in **plaintext** in localStorage
- There are only 1,000,000 possible combinations
- No brute-force protection (no rate limiting, no account lockout)
- No MFA option
- PINs are shared knowledge — anyone who knows the treasurer's PIN is the treasurer
- No password/PIN rotation policy
- No session timeout enforcement (the `idleTimeoutMin` setting exists but is never consumed)

**Impact:** A 6-digit PIN offers approximately 20 bits of entropy. An attacker with physical access to the browser can:

1. Open DevTools → find all PINs in localStorage
2. Extract all user PINs
3. Impersonate any user

**Recommendation:**

1. Implement proper password-based authentication with bcrypt/argon2 hashing
2. Enforce minimum password complexity (12+ chars, mixed case, numbers, symbols)
3. Add rate limiting (5 failed attempts → 15-minute lockout)
4. Implement MFA for sensitive roles (super_admin, treasurer)
5. Enforce session timeout based on `idleTimeoutMin` setting
6. Add PIN/password rotation requirements (every 90 days)

### 14.2 🟠 No Session Timeout Implementation (Security Engineer)

**Finding:** The `Settings.idleTimeoutMin` field exists (default 15 minutes) but is never enforced. There is no idle detection, no automatic logout, and no session expiry.

**Impact:** A logged-in session persists indefinitely. If a treasurer leaves their computer unlocked, anyone can access the system.

**Recommendation:** Implement idle timeout:

1. Track last user interaction (mouse move, key press, click)
2. After `idleTimeoutMin` of inactivity, show a warning with 60-second countdown
3. Auto-logout if no response
4. Clear session data on logout
5. Require re-authentication for sensitive operations regardless of session age

### 14.3 🟡 session.userId Stored in Same DB as Everything Else (Security Engineer)

**Finding:** The session is stored as a field in the same JSON blob as all financial data:

```typescript
export interface DB {
  // ... all financial data
  session: { userId: string | null };
}
```

**Impact:** Anyone who can read the localStorage DB can see who's logged in and change the session. Decoupling session from data would make session hijacking slightly harder.

**Recommendation:** Store session tokens separately (httpOnly cookies with the real backend). The session should be server-validated on every request.

---

## 15. Audit Trail

### 15.1 🟠 Audit Trail is Client-Side, Mutable, and Truncated (Security Engineer)

**Finding:** The audit trail has critical weaknesses:

1. **Mutable:** Stored in the same localStorage DB as everything else — trivially deletable
2. **Truncated:** Capped at 500 entries (`if (db.audit.length > 500) db.audit.length = 500`). Oldest entries are silently discarded.
3. **Not tamper-evident:** No cryptographic hashing or chaining
4. **Incomplete:** Doesn't capture the **before** state of mutations, only the action

**Examples of missing audit data:**

- `deleteOffering("o1", user)` logs: `action:"delete", entity:"offering", entityId:"o1"` — but not the amount, date, category, or fund of the deleted offering
- `setExpenseStatus("e1", "approved", user)` logs: `action:"approved", entity:"expense", entityId:"e1"` — but not the amount or what it was approved from

**Impact:** The audit trail would fail any external audit:

- Auditors cannot reconstruct what was deleted
- The 500-entry limit means historical audits are impossible
- No cryptographic proof that entries haven't been tampered with
- A malicious super_admin can call `resetDb()` and wipe the entire audit trail

**Recommendation:**

1. Store audit logs in an append-only, immutable data store
2. Never truncate — audit trails must be complete for the entire fiscal year (minimum 7 years for Thai tax purposes)
3. Capture full before/after snapshots for every mutation
4. Implement cryptographic hash chaining (each entry includes hash of previous entry)
5. Forward audit logs to an external syslog/SIEM system for tamper resistance
6. Separate audit log access from regular data access (auditor role should be read-only for audit logs, with no write access to anything else)

### 15.2 🟡 No Audit Log Retention Policy (Church Consultant)

**Finding:** The 500-entry cap is arbitrary with no relation to any retention policy.

**Recommendation:** Implement a configurable retention policy (default: 7 years). Archive old audit logs rather than deleting them.

### 15.3 🟡 Audit Logs Don't Include IP Address or Device Info (Security Engineer)

**Finding:** The `AuditLog` type has no fields for client IP, user agent, or device fingerprint.

**Recommendation:** Add `ipAddress`, `userAgent`, and `deviceId` fields to audit logs for forensic analysis.

---

## 16. Concurrency & Race Conditions

### 16.1 🔴 No Concurrency Control (Senior DBA)

**Finding:** The entire application has zero concurrency control:

- `updateDb()` reads → mutates → writes with no locking
- No optimistic concurrency (version numbers, timestamps)
- No pessimistic concurrency (locks)
- Multiple browser tabs on the same origin share the same localStorage — simultaneous mutations from different tabs will corrupt data

**Race Condition Scenario:**

1. Tab A reads DB (balance = 1000)
2. Tab B reads DB (balance = 1000)
3. Tab A records expense of 500 (local balance = 500), saves DB
4. Tab B records expense of 700 (local balance = 300), saves DB
5. Tab A's expense is **lost** — Tab B overwrote the entire DB without incorporating Tab A's change

**Impact:** In a real multi-user scenario (or even multi-tab single-user), financial data corruption is guaranteed.

**Recommendation:** The localStorage mock DB is fundamentally incompatible with concurrent access. Migration to a real database is the only solution. At minimum, implement:

- Optimistic locking with version numbers
- Merge strategies for concurrent edits
- Single-tab enforcement (BroadcastChannel API to detect other tabs)

### 16.2 🟠 No Sequence/Gap Detection for Transaction IDs (Financial Systems Architect)

**Finding:** IDs are generated with `Math.random().toString(36).slice(2, 10)` — with no sequential numbering, transaction sequencing cannot be verified.

**Impact:** Auditors expect sequential transaction numbers. Missing numbers indicate deleted transactions — which would be undetectable with random IDs.

**Recommendation:** Implement sequential transaction numbering per type (OFF-2026-0001, EXP-2026-0001) with gap detection and explanation.

---

## 17. Data Persistence & Backup

### 17.1 🔴 No Backup Mechanism (DevOps Lead)

**Finding:** The only "backup" is the browser's localStorage, which:

- Can be cleared by the user, a browser update, or privacy settings
- Has a per-origin limit of 5-10MB
- Is not backed up to any server, cloud storage, or external drive
- Cannot be restored if the browser data is corrupted

**Impact:** Total data loss is not just possible — it's inevitable over time with localStorage.

**Recommendation:**

1. Implement automated database backups (daily full, hourly incremental)
2. Store backups in at least two geographically separated locations
3. Test restore procedures quarterly
4. Implement export-to-file as an interim measure (CSV/JSON export of all data, downloadable by the user)

### 17.2 🟠 localStorage Quota Will Be Exhausted with Attachments (Senior DBA)

**Finding:** Receipt images are stored as base64 data URLs in localStorage. A single 5MB image becomes ~6.7MB as base64. With a typical 5-10MB localStorage limit, even 2 receipts could exhaust the quota.

**Impact:** When localStorage quota is reached, `saveDb()` fails silently (`window.localStorage.setItem(KEY, JSON.stringify(cache))` throws a quota exceeded error that is not caught). All subsequent mutations are applied to the in-memory cache but never persisted — leading to silent data loss.

**Recommendation:** Store attachments externally. Never store binary data in localStorage. Catch quota errors and alert the user.

---

## 18. Fraud Vectors & Financial Controls

### 18.1 🔴 Cash Skimming via Unverified Sunday Counts (Church Consultant)

**Vector:** A single person (treasurer) can:

1. Count the Sunday cash offerings alone
2. Enter their own name as all three counters in the Sunday Count Sheet
3. Reduce the actual amounts by any amount
4. Pocket the difference
5. The validation checks pass because they compare entered amounts against entered counts — not against actual physical money

**Controls Missing:**

- Independent counter verification (counters enter their own counts)
- Physical count sheet signed by all counters and filed
- Reconciliation against deposit slip (bank deposit amount must match system amount)
- Surprise cash counts by auditor/pastor
- Video recording of counting process (common in churches)

### 18.2 🔴 Fictitious Expense Fraud (Church Consultant)

**Vector:** A finance_staff or treasurer can:

1. Create a fictitious expense (e.g., "ค่าซ่อมบำรุง" ฿5,000)
2. Attach a fake receipt (photo of unrelated bill)
3. If they also have approval rights or can collude, approve it
4. The expense reduces fund balance, and the perpetrator withdraws the cash

**Controls Missing:**

- Require original physical receipts (not just photos)
- Require vendor verification (phone call to vendor above threshold)
- Three-way match: Purchase Order → Receipt → Invoice
- Periodic surprise audits of expense receipts
- Expense report requiring detailed line items above threshold

### 18.3 🟠 Fund Transfer Fraud (Church Consultant)

**Vector:** A treasurer with `fund.write` can:

1. Transfer ฿50,000 from Building Fund to General Fund
2. Then record a ฿50,000 expense from General Fund (fake expense)
3. The Building Fund balance drops but the money doesn't actually go to a legitimate expense

**Controls Missing:**

- Fund transfer approval workflow
- Transfer purpose documentation requirement
- Board notification for transfers above threshold
- Periodic fund balance reconciliation against bank statements

### 18.4 🟡 Journal Entry Manipulation via Back-Dating (Church Consultant)

**Vector:** A user can:

1. Wait until after a period has been "reconciled" (informally)
2. Add an offering dated in the reconciled period
3. Since there's no period locking, the reconciled numbers change silently

**Controls Missing:**

- Period locking (Section 3.5)
- System-enforced cutoff dates
- Alert when transactions are dated more than N days in the past

### 18.5 🟡 Pin Sharing / Impersonation (Security Engineer)

**Vector:** PINs are shared verbally ("the treasurer PIN is 333333"). Anyone who knows a PIN can operate as that person with no additional verification.

**Controls Missing:**

- Unique per-user credentials (not shared PINs)
- MFA for sensitive operations
- Session logging with IP/device tracking
- Anomaly detection (unusual time of day, unusual amounts)

---

## 19. UX & Workflow Concerns

### 19.1 🟡 No Undo Functionality (UX Lead)

**Finding:** Deleting an offering, expense, or income is permanent with no undo. The only feedback is a toast message.

**Recommendation:** Implement soft-delete or a trash/recycle bin with a 30-day recovery window before permanent deletion.

### 19.2 🟡 No Confirmation Dialog for Deletion (UX Lead)

**Finding:** The delete button for offerings in `_app.offering.tsx` executes immediately:

```typescript
onClick={() => remove.mutate(r.id)}
```

No confirmation dialog, no "Are you sure?" prompt. One misclick deletes a financial record.

**Recommendation:** Add confirmation dialogs for all destructive actions, showing what will be deleted and its financial impact.

### 19.3 🟡 No Loading State for the Sunday Count Sheet Save (UX Lead)

**Finding:** The Sunday Count Sheet saves multiple offering records sequentially in a loop. If there are 50 member rows with 3 categories each, that's 150 individual `createOffering()` calls. If any one fails, previously created records are not rolled back.

**Recommendation:** Batch-create offerings in a single transaction. If a batch create fails, none should be persisted.

### 19.4 🟡 No Bulk Operations (UX Lead)

**Finding:** The only way to manage data is row-by-row. There is no bulk import, bulk delete, bulk status change, or bulk export.

**Recommendation:** Add bulk operations for common workflows (batch approve pending items, bulk export filtered data, import from CSV for migration).

---

## 20. DevOps & Production Readiness

### 20.1 🔴 No Production Build Configuration (DevOps Lead)

**Finding:** The project has `vite build` but no production deployment configuration:

- No environment variable management
- No production database configuration
- No CDN/static asset strategy
- No monitoring or error tracking (only `error-capture.ts` which doesn't appear to connect to any service)
- No health check endpoint
- No graceful shutdown handling

**Recommendation:** Create a production deployment checklist: environment configs, secrets management, database provisioning, CDN setup, monitoring (Sentry/Datadog), and backup scheduling.

### 20.2 🟠 No Error Boundary or Graceful Degradation (DevOps Lead)

**Finding:** If the localStorage DB is corrupted (invalid JSON), `loadDb()` catches the error and silently returns a fresh `seed()`:

```typescript
try {
  const parsed = JSON.parse(raw) as DB;
  cache = migrateDb(parsed);
  return cache;
} catch {
  /* fall through to seed */
  // ALL DATA LOST, NO USER NOTIFICATION
}
```

**Impact:** A JSON parse error silently destroys all financial data and replaces it with seed data. The user gets no warning, no error message, and no opportunity to recover.

**Recommendation:**

1. Display a prominent error when data corruption is detected
2. Offer data recovery options (export corrupted data, attempt repair)
3. Never silently replace production data with seed data
4. Implement data integrity checks (checksums, schema validation on load)

### 20.3 🟡 No Automated Testing (QA Lead)

**Finding:** There are no test files in the project. No unit tests, integration tests, or end-to-end tests. The scripts in `package.json` only include `dev`, `build`, `lint`, and `format`.

**Impact:** Every code change risks introducing financial calculation errors, permission bypasses, or data corruption with no automated detection.

**Recommendation:**

1. Unit tests for all service functions (`church.ts`)
2. Integration tests for critical workflows (create → approve → reconcile)
3. Financial calculation regression tests (known inputs → expected balances)
4. Permission matrix tests (every role × every operation)
5. Load/concurrency tests for the server-side implementation

### 20.4 🟡 No API Versioning (Architect)

**Finding:** The `services/church.ts` file exports functions that are called directly from components. There is no API versioning, no request/response schema, and no backward compatibility strategy.

**Recommendation:** When migrating to a real backend, implement API versioning (e.g., `/api/v1/...`) with OpenAPI/Swagger documentation.

---

## 21. Compliance & Audit Readiness

### 21.1 🔴 Not Ready for External Audit (ALL REVIEWERS)

The following would cause an immediate audit failure:

| Requirement                            | Status | Section |
| -------------------------------------- | ------ | ------- |
| Immutable audit trail                  | ❌     | 15.1    |
| Double-entry bookkeeping               | ❌     | 3.1     |
| Segregation of duties                  | ❌     | 5.2     |
| Period locking                         | ❌     | 3.5     |
| Server-side authorization              | ❌     | 13.1    |
| Data backup and recovery               | ❌     | 17.1    |
| Transaction sequencing                 | ❌     | 16.2    |
| Durable data storage                   | ❌     | 2.1     |
| User authentication beyond 6-digit PIN | ❌     | 14.1    |
| Independent cash count verification    | ❌     | 6.2     |

### 21.2 🟠 Thai Tax Compliance Not Addressed (Church Consultant)

**Finding:** The system has no features for:

- Tax receipt generation for donors (ใบอนุโมทนาบัตร)
- Annual donor statements for tax deduction claims
- Withholding tax tracking (ภ.ง.ด. 3, ภ.ง.ด. 53) for staff salaries
- VAT tracking if the church is VAT-registered
- Social security contribution tracking for employees

**Recommendation:** Add tax compliance features appropriate for religious organizations in Thailand:

1. Donor receipt generation with church tax ID
2. Annual giving statements per member
3. Expense categorization for tax-deductible vs. non-deductible
4. Salary disbursement records with tax withholding

### 21.3 🟡 No Data Privacy Controls (Security Engineer)

**Finding:** Member data (names, phone numbers, emails) is stored in the same localStorage blob as financial data. There is no:

- Data classification (PII vs. financial vs. public)
- Access control on member contact details
- Data anonymization for exports
- GDPR/PDPA compliance consideration (Thailand has PDPA)

**Recommendation:**

1. Classify data fields (PII, financial, operational)
2. Restrict member contact details to authorized roles only
3. Mask PII in exports and reports
4. Add data retention and deletion policies for member data
5. Add consent tracking for member data collection

---

## 22. Prioritized Remediation Roadmap

### Phase 0: Immediate Stopgap (Before Any Production Use)

| #   | Action                                                           | Severity |
| --- | ---------------------------------------------------------------- | -------- |
| 1   | Migrate from localStorage to a server-side database (PostgreSQL) | 🔴       |
| 2   | Implement server-side authentication with hashed passwords + MFA | 🔴       |
| 3   | Move all business logic and authorization to server-side         | 🔴       |
| 4   | Implement double-entry bookkeeping with chart of accounts        | 🔴       |
| 5   | Add period locking and closing procedures                        | 🔴       |
| 6   | Separate audit trail into append-only, immutable storage         | 🔴       |

### Phase 1: Financial Controls (Month 1-2)

| #   | Action                                                            | Severity |
| --- | ----------------------------------------------------------------- | -------- |
| 7   | Implement transaction approval workflow with proper state machine | 🔴       |
| 8   | Add fund balance validation on all expense/transfer operations    | 🟠       |
| 9   | Enforce segregation of duties (no self-approval)                  | 🟠       |
| 10  | Add status/approval to Offering records                           | 🟠       |
| 11  | Implement independent counter verification for Sunday counts      | 🟠       |
| 12  | Add offering ↔ member linking for giving statements               | 🟡       |
| 13  | Implement fund transfer atomicity and approval                    | 🟠       |
| 14  | Fix budget tracking (used field update or dynamic calculation)    | 🟡       |
| 15  | Add sequential transaction numbering                              | 🟠       |

### Phase 2: Reporting & Compliance (Month 3-4)

| #   | Action                                                              | Severity |
| --- | ------------------------------------------------------------------- | -------- |
| 16  | Implement proper balance sheet, income statement, cash flow reports | 🟠       |
| 17  | Add tax receipt/donor statement generation                          | 🟠       |
| 18  | Implement persisted reconciliation with period chaining             | 🟠       |
| 19  | Add PDPA compliance for member data                                 | 🟡       |
| 20  | Implement fiscal year handling in all reports                       | 🟠       |
| 21  | Add IP/device tracking to audit logs                                | 🟡       |

### Phase 3: Operations & Resilience (Month 5-6)

| #   | Action                                                              | Severity |
| --- | ------------------------------------------------------------------- | -------- |
| 22  | Implement automated database backups with restore testing           | 🔴       |
| 23  | Add comprehensive test suite (unit, integration, financial)         | 🟡       |
| 24  | Implement concurrency control and optimistic locking                | 🔴       |
| 25  | Add rate limiting and brute-force protection                        | 🟠       |
| 26  | Implement session timeout enforcement                               | 🟠       |
| 27  | Add error boundaries and graceful degradation                       | 🟠       |
| 28  | Implement proper attachment storage (server-side, not localStorage) | 🟠       |

### Phase 4: Polish & Advanced Features (Month 7+)

| #   | Action                                                  | Severity |
| --- | ------------------------------------------------------- | -------- |
| 29  | Add purchase order/commitment tracking                  | 🟡       |
| 30  | Add inter-fund loan tracking                            | 🟡       |
| 31  | Add expense report workflow with line items             | 🟡       |
| 32  | Implement budget creation/approval workflow             | 🟡       |
| 33  | Add multi-currency support                              | 🟢       |
| 34  | Add bank feed integration (auto-import bank statements) | 🟢       |
| 35  | Add mobile app for counter verification                 | 🟢       |

---

## Conclusion

Grace Ledger is a well-intentioned prototype with a solid UI foundation, but it lacks the fundamental financial controls, data integrity guarantees, and security architecture required for a production church financial system. The most critical gaps are:

1. **No server-side persistence or authorization** — all data and logic live in the browser
2. **Single-entry bookkeeping** — cannot guarantee balanced books
3. **Mutable, truncated audit trail** — cannot satisfy external auditors
4. **No concurrency control** — multi-user corruption is guaranteed
5. **Weak cash handling controls** — the single highest fraud risk for churches

**Verdict:** This application would **fail an external financial audit immediately**. It should not be used for real church finances in its current state. With the remediation roadmap above, it can be evolved into a production-grade system.

---

_Audit prepared by: Principal Software Architect, Principal Security Engineer, Senior DBA, Financial Systems Architect, Church Financial Consultant, UX Lead, QA Lead, DevOps Lead_

_This report should be reviewed by church leadership and the software development team before any production deployment._

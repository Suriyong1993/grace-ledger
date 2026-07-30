# Grace Ledger v2 — Business Rules & Constraints

**Version:** 2.0
**Date:** 22 July 2026

---

## Table of Contents

1. [Fund Accounting Rules](#1-fund-accounting-rules)
2. [Transaction Lifecycle Rules](#2-transaction-lifecycle-rules)
3. [Approval Workflow Rules](#3-approval-workflow-rules)
4. [Segregation of Duties](#4-segregation-of-duties)
5. [Offering & Collection Rules](#5-offering--collection-rules)
6. [Budget Rules](#6-budget-rules)
7. [Period Management Rules](#7-period-management-rules)
8. [Reconciliation Rules](#8-reconciliation-rules)
9. [Reporting Rules](#9-reporting-rules)
10. [Member & Data Privacy Rules](#10-member--data-privacy-rules)
11. [Tax & Compliance Rules](#11-tax--compliance-rules)
12. [System Configuration Rules](#12-system-configuration-rules)

---

## 1. Fund Accounting Rules

| Rule ID  | Rule                                                                     | Enforcement                 | Code                     |
| -------- | ------------------------------------------------------------------------ | --------------------------- | ------------------------ |
| FUND-001 | Fund balances must never go negative from a single transaction           | Server-side at posting time | `INSUFFICIENT_FUNDS`     |
| FUND-002 | A fund with insufficient balance cannot source an expense or transfer    | Pre-validation              | `INSUFFICIENT_FUNDS`     |
| FUND-003 | Fund opening balance must be ≥ 0 when creating a fund                    | Zod validation              | `VALIDATION_ERROR`       |
| FUND-004 | Fund balance is stored in `funds.current_balance` — not ad-hoc computed  | Architectural invariant     | Mismatch triggers alert  |
| FUND-005 | Fund balance recalculated and verified after every journal entry posting | Within DB transaction       | Sentry alert on mismatch |
| FUND-006 | A fund can be deactivated only if `current_balance = 0`                  | Server-side                 | `FUND_HAS_BALANCE`       |
| FUND-007 | Fund creation creates a corresponding equity COA account                 | Within transaction          | `INTERNAL_ERROR`         |
| FUND-008 | Funds track both opening_balance and live current_balance independently  | Data model                  | —                        |

## 2. Transaction Lifecycle Rules

### 2.1 State Machine

```
DRAFT ──submit──→ PENDING ──approve──→ APPROVED ──void──→ VOIDED
  │                  │                    │
  │                  └──reject──→ REJECTED ──resubmit──→ DRAFT
  │                                                  │
  └──delete──→ (soft deleted)                        │
                                                     │
REJECTED ──delete──→ (soft deleted)
```

### 2.2 Valid Transitions

| Rule ID | From       | To             | Who                       | Conditions                                    |
| ------- | ---------- | -------------- | ------------------------- | --------------------------------------------- |
| TXN-001 | `draft`    | `pending`      | Creator                   | Balanced entry; period open                   |
| TXN-002 | `pending`  | `approved`     | Approver                  | creatorId ≠ approverId; within limit          |
| TXN-003 | `pending`  | `rejected`     | Approver                  | `rejection_reason` required                   |
| TXN-004 | `rejected` | `draft`        | Creator                   | Edits before resubmit                         |
| TXN-005 | `approved` | `voided`       | User with void permission | Void reason required; creates reversing entry |
| TXN-006 | `draft`    | (soft deleted) | Creator                   | Own drafts only                               |
| TXN-007 | `rejected` | (soft deleted) | Creator                   | Own rejected entries only                     |

### 2.3 Blocked Transitions

| Rule ID | From       | To         | Reason                     |
| ------- | ---------- | ---------- | -------------------------- |
| TXN-008 | `approved` | `draft`    | Must void, not downgrade   |
| TXN-009 | `approved` | `rejected` | Must void, not reject      |
| TXN-010 | `approved` | `deleted`  | Void only — never delete   |
| TXN-011 | `draft`    | `approved` | Bypasses approval workflow |
| TXN-012 | `voided`   | any        | Terminal state             |
| TXN-013 | `pending`  | `draft`    | Must be rejected first     |

### 2.4 Void Rules

| Rule ID | Rule                                                                |
| ------- | ------------------------------------------------------------------- |
| TXN-014 | Voiding creates a reversing journal entry (`entry_type = 'void'`)   |
| TXN-015 | Void entry references original via `void_parent_id`                 |
| TXN-016 | A void entry cannot itself be voided                                |
| TXN-017 | Void reason is mandatory                                            |
| TXN-018 | Void posts in the current fiscal period (not the original's period) |

## 3. Approval Workflow Rules

### 3.1 Tiered Thresholds

| Rule ID | Amount           | Required Approver(s)        | Self-Approval? |
| ------- | ---------------- | --------------------------- | -------------- |
| APV-001 | < ฿5,000         | Treasurer or Pastor         | No             |
| APV-002 | ฿5,000 – ฿50,000 | Pastor                      | No             |
| APV-003 | > ฿50,000        | Pastor + Super Admin (dual) | No             |

### 3.2 Approval Authority

| Rule ID | Rule                                                                                               |
| ------- | -------------------------------------------------------------------------------------------------- |
| APV-004 | User with appropriate approve permission can approve any pending transaction below their threshold |
| APV-005 | `createdBy !== approvedBy` always enforced server-side                                             |
| APV-006 | Dual approval (>฿50,000) requires two different approvers                                          |
| APV-007 | Dual approval is complete when both approver IDs are recorded                                      |
| APV-008 | If either dual approver rejects, the entire entry is rejected                                      |

### 3.3 Approval Metadata

| Rule ID | Rule                                                                          |
| ------- | ----------------------------------------------------------------------------- |
| APV-009 | On approval: record `approved_by`, `approved_at`                              |
| APV-010 | On rejection: `rejection_reason` is mandatory (min 10 characters)             |
| APV-011 | All approval/rejection actions logged to audit trail with full state snapshot |

## 4. Segregation of Duties

| Rule ID | Rule                                                             | Enforcement       |
| ------- | ---------------------------------------------------------------- | ----------------- |
| SOD-001 | Creator ≠ Approver on any transaction                            | Server-side       |
| SOD-002 | Counter 1 ≠ Counter 2 on Sunday count sheet                      | DB CHECK          |
| SOD-003 | Users with `settings.write` cannot modify their own role         | Permission matrix |
| SOD-004 | Only `super_admin` can create/assign users                       | Middleware        |
| SOD-005 | Only `auditor` or `super_admin` can reopen a reconciled period   | Role check        |
| SOD-006 | `auditor` role is read-only except for audit log access          | Permission matrix |
| SOD-007 | `treasurer` has write access but cannot approve                  | Permission matrix |
| SOD-008 | Sunday cash count requires minimum 2 authenticated counters      | Validation        |
| SOD-009 | Dual approval requires 2 different users with approve permission | State machine     |
| SOD-010 | Period reopening requires auditor or super_admin                 | Role check        |
| SOD-011 | System settings changes require super_admin only                 | Permission check  |

## 5. Offering & Collection Rules

### 5.1 Sunday Count Sheet

| Rule ID | Rule                                                                   |
| ------- | ---------------------------------------------------------------------- |
| OFF-001 | Minimum 2 authenticated counters required                              |
| OFF-002 | Counter 1 and Counter 2 must be different users                        |
| OFF-003 | Counters enter amounts independently (cannot view each other's inputs) |
| OFF-004 | If Counter 1 and Counter 2 differ by >฿100, recount required           |
| OFF-005 | Counter 3 is optional but must be distinct from Counters 1 and 2       |
| OFF-006 | Reconciled amount = agreed amount after all counters reconcile         |
| OFF-007 | States: `counting` → `in_review` → `reconciled` → `locked`             |
| OFF-008 | Locking the count sheet generates journal entries for each offering    |
| OFF-009 | Locking requires pastor or super_admin approval                        |

### 5.2 Offering Records

| Rule ID | Rule                                                                   |
| ------- | ---------------------------------------------------------------------- |
| OFF-010 | Each offering → Journal Entry: Debit Cash/Bank, Credit Income Account  |
| OFF-011 | Amount must be > 0                                                     |
| OFF-012 | Fund selection is mandatory (no hardcoded defaults)                    |
| OFF-013 | Payment channel is mandatory (cash, bank, QR)                          |
| OFF-014 | Offerings go through approval workflow (same as income)                |
| OFF-015 | Optional member linkage for giving statements                          |
| OFF-016 | Corrections create new record with audit trail — never modify original |

## 6. Budget Rules

### 6.1 Budget Creation

| Rule ID | Rule                                                                                               |
| ------- | -------------------------------------------------------------------------------------------------- |
| BUD-001 | Annual budget: `fiscal_year` required; `fiscal_period`, `department_id`, `project_id` must be NULL |
| BUD-002 | Monthly budget: `fiscal_year` + `fiscal_period` required                                           |
| BUD-003 | Department budget: `department_id` required                                                        |
| BUD-004 | Project budget: `project_id` required                                                              |
| BUD-005 | Budgeted amount must be ≥ 0                                                                        |
| BUD-006 | Budgets go through approval: draft → pending → approved/rejected                                   |
| BUD-007 | Only approved budgets used in vs-actual comparisons                                                |

### 6.2 Budget Utilization

| Rule ID | Rule                                                                            |
| ------- | ------------------------------------------------------------------------------- |
| BUD-008 | Budget utilization is computed dynamically from GL — no stored `used` field     |
| BUD-009 | Actual spend = SUM of debit entries on budgeted account for the budget period   |
| BUD-010 | Over-budget detection is advisory (warns but does not block, unless configured) |

## 7. Period Management Rules

| Rule ID | Rule                                                                |
| ------- | ------------------------------------------------------------------- |
| PRD-001 | Periods auto-created on first transaction of a month                |
| PRD-002 | Statuses: `open` → `closed` → `reconciled`                          |
| PRD-003 | New transactions only in open periods                               |
| PRD-004 | Closing requires: no pending transactions, all entries approved     |
| PRD-005 | Prior period must be reconciled before current period can be closed |
| PRD-006 | Reopening closed period: auditor or super_admin only                |
| PRD-007 | Reopening RECONCILED period is forbidden (requires DB admin)        |
| PRD-008 | Period closing snapshots fund balances                              |
| PRD-009 | All period status changes are audited                               |
| PRD-010 | Fiscal year start month is configurable                             |
| PRD-011 | Transactions cannot be dated > 30 days in the past (configurable)   |
| PRD-012 | Transactions cannot be dated in the future                          |

## 8. Reconciliation Rules

| Rule ID | Rule                                                                 |
| ------- | -------------------------------------------------------------------- |
| REC-001 | Period must be `closed` before reconciliation                        |
| REC-002 | Reconciliation is per-fund, per-period                               |
| REC-003 | System balance = opening balance + income - expenses for the period  |
| REC-004 | Variance = system balance - actual balance                           |
| REC-005 | Variance > ฿100 requires written explanation (min 20 chars)          |
| REC-006 | Each reconciliation chains to the previous for the same fund         |
| REC-007 | Opening balance must equal previous reconciliation's closing balance |
| REC-008 | Reconciliation records are immutable once created                    |
| REC-009 | All funds reconciled → period status becomes `reconciled`            |

## 9. Reporting Rules

| Rule ID | Rule                                                                     |
| ------- | ------------------------------------------------------------------------ |
| RPT-001 | Balance Sheet: Assets = Liabilities + Equity                             |
| RPT-002 | Income Statement: Income - Expenses = Net Income                         |
| RPT-003 | Net Income flows to Equity on Balance Sheet                              |
| RPT-004 | Reports generated server-side only                                       |
| RPT-005 | All amounts use exact Money type (no floating point)                     |
| RPT-006 | Annual giving statement: all approved offerings linked to member         |
| RPT-007 | Statement includes: member name, church tax ID, total, monthly breakdown |
| RPT-008 | Only members with `consent_given = true` get statements                  |
| RPT-009 | Statements generated server-side as PDF                                  |

## 10. Member & Data Privacy Rules

| Rule ID  | Rule                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------- |
| MEM-001  | Member PII (phone, email, address) visible only to: super_admin, pastor, treasurer, finance_staff |
| MEM-002  | Auditor and viewer see anonymized member data only                                                |
| MEM-003  | Member consent required before data used for statements                                           |
| MEM-004  | Consent date recorded on consent                                                                  |
| MEM-005  | Members with transaction history cannot be deleted — only deactivated                             |
| MEM-006  | Exporting member data requires explicit confirmation                                              |
| PDPA-001 | Consent tracking is mandatory                                                                     |
| PDPA-002 | Data retention policy documented and enforced                                                     |
| PDPA-003 | Members can request their data export                                                             |
| PDPA-004 | Members can request PII deletion (anonymization)                                                  |
| PDPA-005 | All data access logged in audit trail                                                             |

## 11. Tax & Compliance Rules

| Rule ID | Rule                                                                            |
| ------- | ------------------------------------------------------------------------------- |
| TAX-001 | Tax receipts (ใบอนุโมทนาบัตร) for approved offerings only                       |
| TAX-002 | Receipt includes: church name, tax ID, donor name, amount, date, receipt number |
| TAX-003 | Receipt numbers sequential: `RCPT-{YEAR}-{SEQ}`                                 |
| TAX-004 | Generated receipts are immutable records                                        |
| TAX-005 | Staff salary payments track withholding tax (ภ.ง.ด. 3 / ภ.ง.ด. 53)              |
| TAX-006 | Salary journals: Debit Salary Expense, Credit Cash + Credit WHT Payable         |
| TAX-007 | SSO contributions: Debit SSO Expense, Credit SSO Payable                        |
| TAX-008 | All financial records retained minimum 7 years                                  |
| TAX-009 | Audit trail exportable for external auditor                                     |
| TAX-010 | System supports configurable fiscal year                                        |

## 12. System Configuration Rules

| Rule ID | Rule                                                  |
| ------- | ----------------------------------------------------- |
| SYS-001 | Church name is mandatory                              |
| SYS-002 | Tax ID (if provided) must be 13 digits                |
| SYS-003 | `fiscal_year_start`: 1-12                             |
| SYS-004 | `idle_timeout_min`: ≥ 1                               |
| SYS-005 | `session_max_hours`: ≥ 1                              |
| SYS-006 | Currency fixed as THB for v2                          |
| SYS-007 | Settings changes require super_admin                  |
| SYS-008 | Settings changes fully audited (before/after)         |
| SYS-009 | User creation requires super_admin                    |
| SYS-010 | Active user names must be unique                      |
| SYS-011 | Passwords: min 12 chars, mixed case, numbers, symbols |
| SYS-012 | Password change required every 90 days                |
| SYS-013 | 5 failed login attempts → 15-minute lockout           |
| SYS-014 | MFA required for super_admin and treasurer            |
| SYS-015 | User deactivation only — records never deleted        |
| SYS-016 | Attachments: max 10MB per file                        |
| SYS-017 | Allowed attachment types: PDF, JPG, PNG               |
| SYS-018 | Attachments stored in Supabase Storage — never in DB  |

---

_Every business rule in this document maps to one or more findings from the BUSINESS_DOMAIN_AUDIT.md. Rules are enforced at the server layer — never trusted to the client._

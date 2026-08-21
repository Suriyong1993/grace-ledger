# M4 Implementation Plan & Architecture Spec

## Management, Approvals & Confidential Giving

**Grace Ledger: Church Financial Management System**  
**Date:** 2026-08-19  
**Status:** 📋 **IMPLEMENTATION PLAN & ARCHITECTURE SPEC (AWAITING PRODUCT OWNER APPROVAL)**

---

## 1. Executive Summary

Milestone 4 delivers the **management, governance, and reporting layer** of Grace Ledger. Building on the verified M1–M3 foundation (RBAC, financial core, Sunday offering & dual-control cash counting), M4 completes the remaining 6 mockup screens (10, 11, 12, 15, 16, 17) across 4 modules:

```text
       M3: Sunday Offering (✅ Complete)
                      │
                      ▼
       M4: Management, Approvals & Confidential Giving
┌─────────────────────────────────────────────────────────────┐
│ 1. Approvals Workflow (Screens 11 & 12)                     │
│    - Multi-tier thresholds, Decision sheet, Rationale check │
│ 2. Annual Budget & Velocity Tracking (Screen 10)            │
│    - Fund budget vs actual spent, Velocity alert engine    │
│ 3. Confidential Member Giving & Tax Receipts (Screens 15-16)│
│    - Pastor/Admin-only access RPC, Giving Certificates      │
│ 4. Reports Hub & Period Closing (Screen 17)                 │
│    - Monthly income/expense summary, Fund balance sheets    │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **Multi-Tier Approval Thresholds** — Extends the existing M2 approval workflow with configurable threshold tiers (≤฿10,000 Treasurer-only, >฿10,000 Pastor+Treasurer dual, >฿50,000 Board resolution reference).
2. **Budget & Velocity Engine** — New `budgets` and `budget_categories` tables with a pure TypeScript velocity calculator that compares actual spend against calendar-projected allocation.
3. **Confidential Giving via RPC-Only Access** — `member_giving_records` remains locked down at the RLS level; all reads flow through `get_member_giving_history()` which enforces role checks and writes `ACCESS` audit logs.
4. **Reports Hub with Period Closing** — New `monthly_summaries` table with atomic period-close RPC that snapshots fund balances and income/expense totals.

---

## 2. Existing Schema Impact & Safe Evolution Strategy

| Existing Table/Entity | Current Live Status | Safe Evolution & Additive Strategy |
| :--- | :--- | :--- |
| `transactions` & `transaction_splits` | ✅ Production-Ready (Migrations 001, 005, 006) | 🔄 Reused: Approval workflow already operates on these. M4 adds **threshold configuration** and **approval chain tracking**. |
| `approval_requests` | ❌ Does not exist as standalone table | 🆕 New Table: Tracks multi-tier approval chains, required approver roles, and resolution references. |
| `budgets` | ❌ Does not exist | 🆕 New Table: Annual budget allocation per fund with `year`, `allocated_amount`, `spent_amount`. |
| `budget_categories` | ❌ Does not exist | 🆕 New Table: Budget breakdown by category with `allocated_amount`, `spent_amount`. |
| `members` | ✅ Exists in Migration 001 | 🔄 Reused: Member directory already present. M4 adds **household grouping** and **member search RPC**. |
| `member_giving_records` | ✅ Exists in Migration 001 | 🔄 Reused: Table exists but is **RLS-locked**. M4 adds secure RPC access path with audit logging. |
| `tax_certificates` | ❌ Does not exist | 🆕 New Table: Generated giving certificates with certificate number, period, and PDF metadata. |
| `monthly_summaries` | ❌ Does not exist | 🆕 New Table: Period-closed snapshots of fund balances and income/expense totals. |
| `audit_logs` | ✅ Production-Ready (M003) | 🔄 Reused: All M4 actions (approvals, budget changes, giving access, period close) append audit entries. |
| `offering_sessions` | ✅ Production-Ready (M3) | 🔄 Reused: Member giving records link to offering sessions for reconciliation. |

---

## 3. Module 1: Multi-Tier Approvals Workflow (Screens 11 & 12)

### 3.1 Domain Model

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        APPROVAL CHAIN AGGREGATE                        │
├────────────────────────────────────────────────────────────────────────┤
│ ApprovalRequest                                                         │
│   ├── id: UUID                                                          │
│   ├── church_id: UUID                                                   │
│   ├── entity_type: 'transaction' | 'fund_transfer' | 'offering_variance'│
│   ├── entity_id: UUID                                                   │
│   ├── amount: Money (for threshold evaluation)                          │
│   ├── current_tier: ApprovalTier ('treasurer' | 'pastor' | 'board')     │
│   ├── status: ApprovalStatus ('pending' | 'approved' | 'rejected' |     │
│   │                        'revision_requested' | 'cancelled')          │
│   ├── requested_by: UUID                                                │
│   ├── requested_at: string                                              │
│   ├── required_approvers: UUID[] (ordered chain)                        │
│   ├── completed_approvals: ApprovalStep[]                               │
│   │     ├── approver_id: UUID                                           │
│   │     ├── decision: 'approved' | 'rejected' | 'revision_requested'    │
│   │     ├── note: string (mandatory for reject/revision)                │
│   │     └── decided_at: string                                          │
│   ├── board_resolution_ref: string | null (required for >฿50,000)       │
│   └── created_at: string                                                │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Multi-Tier Threshold Configuration

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    APPROVAL THRESHOLD MATRIX (DEFAULT)                  │
├──────────────────────────┬──────────────────────────────────────────────┤
│ Amount Range             │ Required Approval Chain                      │
├──────────────────────────┼──────────────────────────────────────────────┤
│ ฿0.00 – ฿10,000.00      │ Treasurer only (single approver)             │
│ ฿10,000.01 – ฿50,000.00 │ Pastor + Treasurer (dual approval)           │
│ > ฿50,000.00            │ Pastor + Treasurer + Board Resolution Ref     │
└──────────────────────────┴──────────────────────────────────────────────┘
```

### 3.3 State Machine

```text
                    ┌──────────────┐
                    │   PENDING    │
                    └──────┬───────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
      ┌──────────────┐          ┌──────────────┐
      │  APPROVED    │          │  REJECTED    │ (Terminal)
      └──────┬───────┘          └──────────────┘
             │
             │ (If multi-tier, next approver in chain)
             ▼
      ┌──────────────┐
      │  COMPLETED   │ → Transaction proceeds to post
      └──────────────┘
```

### 3.4 Database Invariants

1. **Self-Approval Prohibition:** `requested_by <> auth.uid()` enforced in all approval RPCs.
2. **Tier Progression:** Approval steps must execute in order (Treasurer → Pastor → Board).
3. **Mandatory Rationale:** Rejections and revision requests require `note >= 5` characters.
4. **Board Resolution Reference:** Transactions > ฿50,000 require `board_resolution_ref` before final approval.
5. **Idempotent Approval:** A completed approval step cannot be re-executed.

### 3.5 New RPCs

| RPC | Purpose | Key Guards |
| :--- | :--- | :--- |
| `create_approval_request(p_entity_type, p_entity_id, p_amount)` | Creates approval chain based on amount threshold | Validates entity exists, computes required tiers |
| `execute_approval_step(p_request_id, p_decision, p_note, p_board_resolution_ref)` | Executes next approval step | Role check, tier order, self-approval check, rationale validation |
| `get_pending_approvals(p_church_id)` | Lists approval queue for current user | Role-based filtering |
| `get_approval_detail(p_request_id)` | Full approval chain with history | Role check |

---

## 4. Module 2: Annual Budget & Velocity Tracking (Screen 10)

### 4.1 Domain Model

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          BUDGET AGGREGATE                            │
├────────────────────────────────────────────────────────────────────────┤
│ Budget                                                                  │
│   ├── id: UUID                                                          │
│   ├── church_id: UUID                                                   │
│   ├── year: integer (e.g. 2026)                                         │
│   ├── fund_id: UUID (General, Building, Mission, Youth)                 │
│   ├── allocated_amount: Money (annual total)                            │
│   ├── spent_amount: Money (actual posted expenses)                      │
│   ├── is_active: boolean                                                │
│   ├── created_by: UUID                                                  │
│   └── created_at: string                                                │
│                                                                          │
│ BudgetCategory (per budget)                                              │
│   ├── id: UUID                                                          │
│   ├── budget_id: UUID                                                   │
│   ├── category_id: UUID (links to categories table)                     │
│   ├── allocated_amount: Money                                           │
│   └── spent_amount: Money                                               │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Velocity Calculation Engine

The **Budget Velocity Engine** is a pure TypeScript module that computes:

$$\text{Velocity Ratio} = \frac{\text{Actual Spent}}{\text{Calendar-Proportional Allocation}}$$

$$\text{Calendar-Proportional Allocation} = \text{Annual Allocation} \times \frac{\text{Days Elapsed in Year}}{\text{Days in Year}}$$

**Alert Levels:**

| Velocity Ratio | Alert Level | UI Treatment |
| :--- | :--- | :--- |
| `< 0.80` | On Track | ✅ Emerald status badge |
| `0.80 – 1.00` | Watch | ⚠️ Amber status badge |
| `> 1.00` | Over Budget | 🔴 Red status badge + alert banner |

**Example:** Building Fund allocated ฿120,000/year. By August 19 (231 days elapsed), proportional allocation = ฿120,000 × (231/365) = ฿75,945. If actual spent = ฿98,000, velocity ratio = 1.29 → **Over Budget** alert: *"หมวดอาคารใช้เร็วกว่าแผน — เหลือ ฿22,000.00 สำหรับ 4 เดือน"*.

### 4.3 New RPCs

| RPC | Purpose | Key Guards |
| :--- | :--- | :--- |
| `get_annual_budget(p_year)` | Returns budget with category breakdown and velocity metrics | Treasurer/Pastor/Admin role |
| `upsert_budget(p_year, p_fund_id, p_allocated_amount, p_categories)` | Creates or updates annual budget | Treasurer/Admin role, validates category sums = total |
| `get_budget_velocity(p_year, p_fund_id)` | Computes velocity ratio and alert level | Treasurer/Pastor/Admin role |

### 4.4 Budget Invariants

1. **Category Sum Parity:** `SUM(budget_categories.allocated_amount) = budgets.allocated_amount`.
2. **Year Uniqueness:** One active budget per `(church_id, year, fund_id)`.
3. **No Negative Allocation:** `allocated_amount >= 0` for all budget records.
4. **Spent Amount Derived:** `spent_amount` is computed from posted transactions, never manually edited.

---

## 5. Module 3: Confidential Member Giving & Tax Receipts (Screens 15 & 16)

### 5.1 Security Architecture (RPC-Only Access Path)

Per the M1 architecture correction (Section 15.1 of PRODUCTION_AUDIT.md), direct table access to `member_giving_records` is **strictly denied** via RLS. All reads flow through secure RPCs:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONFIDENTIAL GIVING ACCESS PATH                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Client (Pastor/Admin/Head Treasurer)                                   │
│    │                                                                    │
│    ▼                                                                    │
│  search_member_giving(p_query, p_reason)                                │
│    │                                                                    │
│    ├─ 1. Verify caller role: pastor | treasurer | admin                 │
│    ├─ 2. INSERT INTO audit_logs (category='ACCESS', action=             │
│    │       'MEMBER_GIVING_SEARCH', metadata={reason, query})            │
│    ├─ 3. Return matching members (name, code, household)                │
│    │     WITHOUT giving amounts                                         │
│    │                                                                    │
│    ▼                                                                    │
│  get_member_giving_history(p_member_id, p_reason)                       │
│    │                                                                    │
│    ├─ 1. Verify caller role: pastor | treasurer | admin                 │
│    ├─ 2. INSERT INTO audit_logs (category='ACCESS', action=             │
│    │       'MEMBER_GIVING_VIEW', entity_id=p_member_id,                 │
│    │       metadata={reason})                                           │
│    ├─ 3. Return member giving records with amounts                      │
│    │                                                                    │
│    ▼                                                                    │
│  generate_tax_certificate(p_member_id, p_year, p_reason)                │
│    │                                                                    │
│    ├─ 1. Verify caller role: pastor | treasurer | admin                 │
│    ├─ 2. INSERT INTO audit_logs (category='ACCESS', action=             │
│    │       'TAX_CERTIFICATE_GENERATED', entity_id=p_member_id,          │
│    │       metadata={year, reason})                                     │
│    ├─ 3. Create tax_certificates record with certificate number         │
│    └─ 4. Return certificate data for PDF rendering                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Domain Model

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        MEMBER GIVING AGGREGATE                         │
├────────────────────────────────────────────────────────────────────────┤
│ Member                                                                    │
│   ├── id: UUID                                                          │
│   ├── church_id: UUID                                                   │
│   ├── full_name: string                                                 │
│   ├── member_code: string | null                                        │
│   ├── household_name: string | null                                     │
│   ├── joined_date: date | null                                          │
│   └── is_active: boolean                                                │
│                                                                          │
│ MemberGivingRecord (RLS-Locked)                                          │
│   ├── id: UUID                                                          │
│   ├── member_id: UUID                                                   │
│   ├── offering_session_id: UUID | null                                  │
│   ├── amount: Money                                                     │
│   ├── giving_type: 'tithe' | 'general' | 'mission' | 'building' |       │
│   │                 'special'                                            │
│   ├── payment_method: 'bank_transfer' | 'cash' | 'qr_promptpay'         │
│   ├── given_at: date                                                    │
│   └── confidential_note: string | null                                  │
│                                                                          │
│ TaxCertificate                                                           │
│   ├── id: UUID                                                          │
│   ├── church_id: UUID                                                   │
│   ├── member_id: UUID                                                   │
│   ├── certificate_number: string (e.g. "GL-2026-0001")                  │
│   ├── tax_year: integer                                                 │
│   ├── total_amount: Money                                               │
│   ├── generated_by: UUID                                                │
│   ├── generated_at: string                                              │
│   └── pdf_url: string | null (Supabase Storage signed URL)              │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Tax Certificate Format

The certificate (หนังสือรับรองการถวาย) includes:

- Church name, address, and tax ID
- Certificate number and tax year
- Member full name and member code
- Total giving amount (฿X,XXX.XX) broken down by giving type
- Generated date and authorized signature line
- QR code linking to verification endpoint

### 5.4 RLS Policies

```sql
-- Deny ALL direct SELECT on member_giving_records
DROP POLICY IF EXISTS p_giving_select ON member_giving_records;
CREATE POLICY p_giving_select ON member_giving_records
  FOR SELECT TO authenticated
  USING (false);  -- All access via RPC only

-- Deny ALL direct SELECT on tax_certificates
DROP POLICY IF EXISTS p_certificates_select ON tax_certificates;
CREATE POLICY p_certificates_select ON tax_certificates
  FOR SELECT TO authenticated
  USING (false);  -- All access via RPC only
```

---

## 6. Module 4: Reports Hub & Period Closing (Screen 17)

### 6.1 Domain Model

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        REPORTS & PERIOD CLOSING                        │
├────────────────────────────────────────────────────────────────────────┤
│ MonthlySummary                                                          │
│   ├── id: UUID                                                          │
│   ├── church_id: UUID                                                   │
│   ├── period_month: integer (1-12)                                      │
│   ├── period_year: integer                                              │
│   ├── total_income: Money                                               │
│   ├── total_expense: Money                                              │
│   ├── net_change: Money (income - expense)                              │
│   ├── fund_balances: JSONB (snapshot of all fund balances)              │
│   ├── account_balances: JSONB (snapshot of all account balances)        │
│   ├── offering_total: Money                                             │
│   ├── is_closed: boolean                                                │
│   ├── closed_by: UUID | null                                            │
│   ├── closed_at: string | null                                          │
│   └── created_at: string                                                │
│                                                                          │
│ ReportCatalog (computed, not stored)                                     │
│   ├── monthly_income_expense: MonthlySummary[]                          │
│   ├── fund_balance_sheet: FundBalanceRow[]                              │
│   │     ├── fund_id, fund_name, opening_balance,                        │
│   │     ├── income, expense, closing_balance                            │
│   ├── offering_report: OfferingSummaryRow[]                             │
│   │     ├── service_date, expected, counted, variance, status           │
│   └── approval_report: ApprovalSummaryRow[]                             │
│         ├── period, total_requests, approved, rejected, avg_time        │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Period Closing RPC

`close_monthly_period(p_month, p_year)` executes atomically:

1. **Verify no existing closed period** for `(church_id, month, year)`.
2. **Compute totals** from posted transactions in the period.
3. **Snapshot fund balances** into `fund_balances` JSONB.
4. **Snapshot account balances** into `account_balances` JSONB.
5. **Mark period as closed** with `closed_by` and `closed_at`.
6. **Append `FINANCIAL` audit log** with `PERIOD_CLOSED` action.

**Post-Close Protection:** Once a period is closed, new transactions cannot be posted with `posted_at` falling within that period. This enforces period integrity.

### 6.3 New RPCs

| RPC | Purpose | Key Guards |
| :--- | :--- | :--- |
| `get_report_catalog(p_year)` | Returns all report types for a year | Viewer/Treasurer/Admin role |
| `get_monthly_summary(p_month, p_year)` | Returns monthly income/expense summary | Viewer/Treasurer/Admin role |
| `get_fund_balance_sheet(p_year)` | Returns fund balance sheet with opening/closing | Viewer/Treasurer/Admin role |
| `get_offering_report(p_month, p_year)` | Returns offering summary for period | Viewer/Treasurer/Admin role |
| `close_monthly_period(p_month, p_year)` | Closes period with snapshots | Treasurer/Admin role, no existing closed period |

---

## 7. M4 Role & Permission Matrix

| Action / Operation | Super Admin | Treasurer | Finance Staff | Pastor | Approver | Counter |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Approvals** | | | | | | |
| View Approval Queue | ✅ Full | ✅ Full | ❌ No | ✅ Full | ✅ Full | ❌ No |
| Execute Approval Step | ✅ Full | ✅ ≤฿10K | ❌ No | ✅ >฿10K | ✅ ≤฿10K | ❌ No |
| Request Revision | ✅ Full | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes | ❌ No |
| Terminal Reject | ✅ Full | ✅ Yes | ❌ No | ✅ Yes | ✅ Yes | ❌ No |
| **Budget** | | | | | | |
| View Budget & Velocity | ✅ Full | ✅ Full | ✅ View | ✅ View | ❌ No | ❌ No |
| Create/Update Budget | ✅ Full | ✅ Yes | ❌ No | ❌ No [PDR4] | ❌ No | ❌ No |
| **Member Giving** | | | | | | |
| Search Members | ✅ Full | ✅ Full | ❌ No | ✅ Full | ❌ No | ❌ No |
| View Giving History | ✅ Full | ✅ Full | ❌ No | ✅ Full | ❌ No | ❌ No |
| Generate Tax Certificate | ✅ Full | ✅ Full | ❌ No | ✅ Full | ❌ No | ❌ No |
| **Reports** | | | | | | |
| View Reports | ✅ Full | ✅ Full | ✅ View | ✅ View | ❌ No | ❌ No |
| Close Monthly Period | ✅ Full | ✅ Yes | ❌ No | ❌ No [PDR5] | ❌ No | ❌ No |

### Explicit Product Decisions Required [PDR]

- `[PDR4]`: Can a Pastor create or update annual budgets? **Default: No** (Treasurer/Admin only — Pastor has view access for oversight).
- `[PDR5]`: Can a Pastor close a monthly period? **Default: No** (Treasurer/Admin only — Pastor has view access for oversight).

---

## 8. Frontend UI Integration

### 8.1 New Routes

```text
AppShell (src/components/layout/AppShell.ts)
  │
  ├── Route: "/approvals" ──► ApprovalsPage (Screen 11 — Enhanced)
  │     └── Multi-tier badge, threshold indicator, chain progress
  │
  ├── Route: "/approvals/:id" ──► ApprovalDecisionSheet (Screen 12 — Enhanced)
  │     └── Tier chain visualization, board resolution ref field
  │
  ├── Route: "/budget" ──► BudgetPage (Screen 10)
  │     └── Annual budget table, velocity alerts, category breakdown
  │
  ├── Route: "/members/giving" ──► MemberGivingSearchPage (Screen 15)
  │     └── Confidential search, reason-required access modal
  │
  ├── Route: "/members/:id" ──► MemberGivingDetailPage (Screen 16)
  │     └── Giving history, tax certificate generation
  │
  └── Route: "/reports" ──► ReportsHubPage (Screen 17)
        └── Monthly summaries, fund balance sheet, period close
```

### 8.2 New Components

| Component | Purpose | Design Tokens |
| :--- | :--- | :--- |
| `ApprovalChainView` | Visual tier chain with completed/pending steps | `--gl-card`, `--gl-border`, `--gl-ink` |
| `ThresholdBadge` | Shows amount tier (Treasurer/Pastor/Board) | `--gl-orange-600`, `--gl-ink` |
| `BudgetVelocityCard` | Fund budget with velocity ratio and alert | `--income`, `--expense`, `--pending` |
| `BudgetCategoryTable` | Category-level allocation vs spent | `.num-display`, `--gl-card` |
| `MemberSearchBar` | Confidential member search with reason modal | `--gl-card`, `--gl-border` |
| `GivingHistoryTimeline` | Chronological giving records | `--gl-card`, `--gl-border` |
| `TaxCertificateCard` | Certificate preview and download | `--gl-card`, `--gl-border` |
| `ReportSummaryCard` | Monthly income/expense summary | `--income`, `--expense` |
| `FundBalanceSheet` | Fund opening/closing balance table | `.num-display`, `--gl-card` |
| `PeriodCloseModal` | Period closing confirmation with summary | `--gl-card`, `--gl-border` |

### 8.3 New Service Modules

```text
src/lib/
├── approvals/
│   ├── types.ts                    # Approval chain, tier, step DTOs
│   ├── threshold-engine.ts         # Pure threshold calculation
│   ├── approval-service.ts         # RPC client with error mapping
│   └── index.ts
├── budget/
│   ├── types.ts                    # Budget, category, velocity DTOs
│   ├── velocity-engine.ts          # Pure velocity ratio calculation
│   ├── budget-service.ts           # RPC client with error mapping
│   └── index.ts
├── member-giving/
│   ├── types.ts                    # Member, giving record, certificate DTOs
│   ├── giving-service.ts           # RPC client with ACCESS audit
│   └── index.ts
└── reports/
    ├── types.ts                    # Monthly summary, balance sheet DTOs
    ├── report-service.ts           # RPC client with period close
    └── index.ts
```

---

## 9. Implementation Phases

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            M4 IMPLEMENTATION PHASES                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ Phase 1: Database & RPCs (PostgreSQL 17 / Supabase)                         │
│   - Migration 013: Approval chains, budgets, tax certificates,              │
│                    monthly summaries schema                                 │
│   - Migration 014: 12+ Business RPCs & Invariant Triggers                   │
│   - Migration 015: RLS Policies (member giving locked, reports scoped)      │
├─────────────────────────────────────────────────────────────────────────────┤
│ Phase 2: Domain Engines & Service Layer (TypeScript)                        │
│   - Pure Threshold Engine (`threshold-engine.ts`)                           │
│   - Pure Velocity Engine (`velocity-engine.ts`)                             │
│   - ApprovalService, BudgetService, GivingService, ReportService            │
├─────────────────────────────────────────────────────────────────────────────┤
│ Phase 3: React UI Integration (Screens 10, 11, 12, 15, 16, 17)              │
│   - BudgetPage, MemberGivingSearchPage, MemberGivingDetailPage,             │
│     ReportsHubPage                                                          │
│   - Enhanced ApprovalsPage & ApprovalDecisionSheet with multi-tier          │
├─────────────────────────────────────────────────────────────────────────────┤
│ Phase 4: Real PostgreSQL 17 Integration Verification                        │
│   - `scripts/m4_integration_test.mjs` (All RPCs & Constraints)              │
├─────────────────────────────────────────────────────────────────────────────┤
│ Phase 5: Chromium Browser E2E & UX Verification                             │
│   - `scripts/m4_browser_e2e.mjs` (Screens 10→11→12→15→16→17)               │
│   - Mobile viewport check (390px) + Secret scan                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Definition of Done (24-Point Checklist)

### Module 1: Approvals (Screens 11 & 12)

- [ ] **1. Multi-Tier Thresholds:** Approval chain automatically determined by amount (≤฿10K Treasurer, >฿10K Pastor+Treasurer, >฿50K + Board resolution).
- [ ] **2. Approval Chain Table:** `approval_requests` and `approval_steps` tables created with ordered chain.
- [ ] **3. Self-Approval Prohibition:** `requested_by <> auth.uid()` enforced in all approval RPCs.
- [ ] **4. Tier Progression:** Approval steps execute in order; cannot skip tiers.
- [ ] **5. Mandatory Rationale:** Rejections and revision requests require `note >= 5` characters.
- [ ] **6. Board Resolution Reference:** Transactions > ฿50,000 require `board_resolution_ref` before final approval.
- [ ] **7. Idempotent Approval:** Completed approval steps cannot be re-executed.
- [ ] **8. Enhanced UI:** ApprovalDecisionSheet shows tier chain, threshold badge, and board resolution field.

### Module 2: Budget & Velocity (Screen 10)

- [ ] **9. Budget Tables:** `budgets` and `budget_categories` created with year/fund uniqueness.
- [ ] **10. Category Sum Parity:** `SUM(budget_categories.allocated_amount) = budgets.allocated_amount` enforced.
- [ ] **11. Velocity Engine:** Pure TypeScript calculator with calendar-proportional allocation.
- [ ] **12. Alert Levels:** On Track (< 0.80), Watch (0.80–1.00), Over Budget (> 1.00) with UI treatments.
- [ ] **13. Budget UI:** BudgetPage with fund cards, category table, and velocity alerts.

### Module 3: Confidential Giving (Screens 15 & 16)

- [ ] **14. RPC-Only Access:** `member_giving_records` RLS denies all direct SELECT; access via RPC only.
- [ ] **15. ACCESS Audit Logging:** Every member giving search/view/certificate generation writes `ACCESS` audit log with reason.
- [ ] **16. Member Search:** `search_member_giving` returns members without amounts; amounts only via detail RPC.
- [ ] **17. Tax Certificates:** `tax_certificates` table with unique certificate numbers.
- [ ] **18. Certificate Generation:** `generate_tax_certificate` RPC creates certificate with year totals.
- [ ] **19. Member Giving UI:** Search page with reason modal, detail page with history timeline and certificate card.

### Module 4: Reports & Period Closing (Screen 17)

- [ ] **20. Monthly Summaries:** `monthly_summaries` table with fund/account balance snapshots.
- [ ] **21. Period Close RPC:** `close_monthly_period` atomically computes totals and snapshots balances.
- [ ] **22. Post-Close Protection:** New transactions cannot be posted into a closed period.
- [ ] **23. Reports UI:** ReportsHubPage with monthly summary, fund balance sheet, offering report, and period close.
- [ ] **24. Real PostgreSQL 17 Tests:** All RPCs, constraints, and edge cases pass on live PostgreSQL.

---

## 11. Test Strategy

### Unit Tests (Vitest)

```text
tests/unit/
├── approval-threshold.test.ts      # Threshold tier calculation (6 tests)
├── approval-chain.test.ts          # Chain progression & self-approval (8 tests)
├── budget-velocity.test.ts         # Velocity ratio & alert levels (6 tests)
├── budget-parity.test.ts           # Category sum parity validation (4 tests)
├── giving-access.test.ts           # RPC access path & audit logging (6 tests)
├── tax-certificate.test.ts         # Certificate number & year totals (4 tests)
└── report-period.test.ts           # Period close & post-close protection (5 tests)
```

### Integration Tests (Real PostgreSQL 17)

```text
scripts/m4_integration_test.mjs
├── M4-REAL-01: Multi-tier approval chain (≤฿10K → Treasurer only)
├── M4-REAL-02: Multi-tier approval chain (>฿10K → Pastor + Treasurer)
├── M4-REAL-03: Multi-tier approval chain (>฿50K → Board resolution required)
├── M4-REAL-04: Self-approval blocked
├── M4-REAL-05: Tier progression enforced (cannot skip)
├── M4-REAL-06: Budget category sum parity enforced
├── M4-REAL-07: Budget year/fund uniqueness enforced
├── M4-REAL-08: Member giving RLS denies direct SELECT
├── M4-REAL-09: Member giving RPC access with ACCESS audit log
├── M4-REAL-10: Tax certificate generation with unique number
├── M4-REAL-11: Period close with balance snapshots
├── M4-REAL-12: Post-close transaction posting blocked
└── M4-REAL-13: Report catalog returns all report types
```

### Browser E2E (Playwright, 390px viewport)

```text
scripts/m4_browser_e2e.mjs
├── Slice 1: Budget page (Screen 10) — velocity alerts, category table
├── Slice 2: Approvals queue & decision (Screens 11 & 12) — multi-tier chain
├── Slice 3: Member giving search & detail (Screens 15 & 16) — reason modal, certificate
└── Slice 4: Reports hub & period close (Screen 17) — summary cards, close modal
```

---

## 12. Risk Assessment

| Risk | Severity | Mitigation |
| :--- | :--- | :--- |
| Member giving data leakage | **Critical** | RLS denies all direct SELECT; RPC-only access with mandatory reason and ACCESS audit logging |
| Approval chain bypass | **High** | DB-level tier progression enforcement; self-approval prohibition in all RPCs |
| Budget overspend without alert | **High** | Velocity engine with calendar-proportional allocation; alert levels trigger UI banners |
| Period close integrity violation | **High** | Post-close protection blocks new transactions in closed periods; atomic snapshot RPC |
| Tax certificate fraud | **Medium** | Unique certificate numbers, generated_by tracking, ACCESS audit logging |
| Threshold misconfiguration | **Medium** | Default thresholds in DB; configurable via church settings with audit trail |

---

## 13. Next Steps

1. **Review and approve this M4 Implementation Plan & Architecture Spec.**
2. **Confirm Product Decisions [PDR4] and [PDR5].**
3. **Select implementation order** — recommended: Module 1 (Approvals) → Module 2 (Budget) → Module 3 (Giving) → Module 4 (Reports).
4. **Begin Phase 1:** Database migrations for approval chains, budgets, tax certificates, and monthly summaries.

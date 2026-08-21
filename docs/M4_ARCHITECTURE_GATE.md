# M4 Architecture Gate

## Management, Approvals & Confidential Giving — Architecture Specification

**Grace Ledger: Church Financial Management System**  
**Date:** 2026-08-19  
**Status:** ✅ **ARCHITECTURE GATE — APPROVED WITH LOCKED PRODUCT DECISIONS**  
**Scope:** Domain model, state machines, role matrix, policy model, data ownership, security boundaries, financial invariants, concurrency, audit events, dependencies, risks, Definition of Done.  
**Explicitly Excluded:** SQL DDL, application code, dependency installation.  
**Implementation Status:** ⏸️ **NOT IMPLEMENTED — M3 Slice 4 must be completed and verified before M4 implementation begins.**

---

## 1. Architecture Principles

### 1.1 Separation of Governance from Execution

**Approval is governance. Posting is financial execution.** These are two distinct domains that must never be conflated:

| Concern | Governance (Approval) | Execution (Posting) |
| :--- | :--- | :--- |
| **Purpose** | Decide whether an action is authorized | Execute the authorized action on the ledger |
| **State** | `approval_requests` lifecycle | `transactions` lifecycle |
| **Actor** | Approver (Pastor, Treasurer, Board) | Treasurer / Admin |
| **Effect** | Changes approval state only | Mutates account & fund balances |
| **Audit** | `APPROVAL` category | `FINANCIAL` category |
| **Invariant** | Approval completion does NOT auto-post | Posting requires prior approval (or direct treasurer authority per policy) |

**Rule:** A multi-tier approval chain reaching `COMPLETED` transitions the approval request to a terminal state. It does **not** implicitly call `post_transaction`. The posting step remains a separate, explicit, role-gated action.

### 1.2 Ledger as Source of Truth

`monthly_summaries`, `budget.spent_amount`, and all report aggregates are **derived/cache data**. The `transactions` + `transaction_splits` tables are the **canonical ledger**. Any derived table can be rebuilt from the ledger; the ledger can never be rebuilt from a derived table.

**Rule:** Derived tables are write-once snapshots or recomputable caches. They are never the authority for a financial fact.

### 1.3 Policy Over Code

Monetary thresholds, approval chains, and velocity alert levels are **policy**, not code. Policies are stored, versioned, and effective-dated. Code reads policy; code never hardcodes policy.

---

## 2. Domain Model

### 2.1 Approval Domain

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                            APPROVAL DOMAIN                                 │
├────────────────────────────────────────────────────────────────────────────┤
│ ApprovalPolicy                                                              │
│   ├── id: UUID                                                              │
│   ├── church_id: UUID                                                       │
│   ├── version: integer (monotonic per church)                               │
│   ├── effective_from: date                                                  │
│   ├── effective_to: date | null (null = current)                            │
│   ├── tiers: ApprovalTier[]                                                 │
│   │     ├── tier_name: 'treasurer' | 'pastor' | 'board'                    │
│   │     ├── min_amount: Money | null (null = unbounded below)               │
│   │     ├── max_amount: Money | null (null = unbounded above)               │
│   │     ├── required_roles: user_role_enum[]                               │
│   │     └── requires_board_resolution: boolean                              │
│   ├── created_by: UUID                                                      │
│   ├── created_at: timestamp                                                 │
│   └── superseded_by: UUID | null                                            │
│                                                                            │
│ ApprovalRequest                                                             │
│   ├── id: UUID                                                              │
│   ├── church_id: UUID                                                       │
│   ├── entity_type: 'transaction' | 'fund_transfer' | 'offering_variance'   │
│   ├── entity_id: UUID                                                       │
│   ├── amount: Money                                                         │
│   ├── policy_version: integer (snapshot of policy used at creation)         │
│   ├── status: 'pending' | 'in_review' | 'approved' | 'rejected' |           │
│   │           'revision_requested' | 'cancelled'                            │
│   ├── requested_by: UUID                                                    │
│   ├── requested_at: timestamp                                               │
│   ├── current_step_index: integer                                           │
│   └── steps: ApprovalStep[]                                                 │
│         ├── step_index: integer (1-based, ordered)                          │
│         ├── tier_name: 'treasurer' | 'pastor' | 'board'                    │
│         ├── required_role: user_role_enum                                   │
│         ├── status: 'pending' | 'approved' | 'rejected' |                   │
│         │           'revision_requested' | 'skipped'                        │
│         ├── approver_id: UUID | null                                        │
│         ├── note: text | null (mandatory for reject/revision)               │
│         ├── board_resolution_ref: text | null                               │
│         └── decided_at: timestamp | null                                    │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Budget Domain

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                            BUDGET DOMAIN                                   │
├────────────────────────────────────────────────────────────────────────────┤
│ Budget                                                                      │
│   ├── id: UUID                                                              │
│   ├── church_id: UUID                                                       │
│   ├── year: integer                                                         │
│   ├── fund_id: UUID                                                         │
│   ├── allocated_amount: Money                                               │
│   ├── status: 'draft' | 'proposed' | 'approved' | 'superseded'            │
│   ├── is_active: boolean                                                    │
│   ├── created_by: UUID                                                      │
│   ├── created_at: timestamp                                                 │
│   ├── approved_by: UUID | null                                              │
│   ├── approved_at: timestamp | null                                         │
│   ├── superseded_by: UUID | null (link to new revision)                    │
│   └── categories: BudgetCategory[]                                          │
│         ├── id: UUID                                                        │
│         ├── budget_id: UUID                                                 │
│         ├── category_id: UUID (links to categories table)                   │
│         ├── allocated_amount: Money                                         │
│         └── spent_amount: Money (derived from posted ledger)                │
│                                                                            │
│ BudgetVelocitySnapshot (computed, not stored)                               │
│   ├── budget_id: UUID                                                       │
│   ├── as_of_date: date                                                      │
│   ├── calendar_policy: 'day_based' | 'month_based'                         │
│   ├── calendar_policy_version: integer (policy version used)               │
│   ├── proportional_allocation: Money                                        │
│   ├── actual_spent: Money (from posted ledger)                              │
│   ├── velocity_ratio: decimal                                               │
│   └── alert_level: 'on_track' | 'watch' | 'over_budget'                    │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Confidential Giving Domain

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                        CONFIDENTIAL GIVING DOMAIN                           │
├────────────────────────────────────────────────────────────────────────────┤
│ Member                                                                      │
│   ├── id: UUID                                                              │
│   ├── church_id: UUID                                                       │
│   ├── full_name: string                                                     │
│   ├── member_code: string | null                                            │
│   ├── household_name: string | null                                         │
│   ├── joined_date: date | null                                              │
│   └── is_active: boolean                                                    │
│                                                                            │
│ MemberGivingRecord (RLS-Locked, RPC-Only Access)                            │
│   ├── id: UUID                                                              │
│   ├── member_id: UUID                                                       │
│   ├── offering_session_id: UUID | null                                      │
│   ├── amount: Money                                                         │
│   ├── giving_type: 'tithe' | 'general' | 'mission' | 'building' |           │
│   │                 'special'                                                │
│   ├── payment_method: 'bank_transfer' | 'cash' | 'qr_promptpay'            │
│   ├── given_at: date                                                        │
│   └── confidential_note: text | null                                        │
│                                                                            │
│ TaxCertificate                                                              │
│   ├── id: UUID                                                              │
│   ├── church_id: UUID                                                       │
│   ├── member_id: UUID                                                       │
│   ├── certificate_number: string (immutable, never reused)                  │
│   ├── tax_year: integer                                                     │
│   ├── total_amount: Money (from posted giving only)                         │
│   ├── status: 'issued' | 'cancelled' | 'reissued'                          │
│   ├── issued_by: UUID                                                       │
│   ├── issued_at: timestamp                                                  │
│   ├── cancelled_by: UUID | null                                             │
│   ├── cancelled_at: timestamp | null                                        │
│   ├── cancellation_reason: text | null                                      │
│   ├── reissued_from: UUID | null (link to original certificate)             │
│   └── pdf_url: string | null                                                │
└────────────────────────────────────────────────────────────────────────────┘
```

### 2.4 Reports & Period Closing Domain

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                        REPORTS & PERIOD CLOSING DOMAIN                      │
├────────────────────────────────────────────────────────────────────────────┤
│ MonthlySummary (DERIVED / CACHE — never source of truth)                    │
│   ├── id: UUID                                                              │
│   ├── church_id: UUID                                                       │
│   ├── period_month: integer                                                 │
│   ├── period_year: integer                                                  │
│   ├── total_income: Money (derived from posted ledger)                      │
│   ├── total_expense: Money (derived from posted ledger)                     │
│   ├── net_change: Money (derived)                                           │
│   ├── fund_balances: JSONB (snapshot at close time)                         │
│   ├── account_balances: JSONB (snapshot at close time)                      │
│   ├── offering_total: Money (derived)                                       │
│   ├── period_state: 'open' | 'closing' | 'closed'                          │
│   ├── initiated_by: UUID | null                                             │
│   ├── initiated_at: timestamp | null                                        │
│   ├── confirmed_by: UUID | null                                             │
│   ├── confirmed_at: timestamp | null                                        │
│   └── created_at: timestamp                                                 │
│                                                                            │
│ PeriodState (per church, per month/year)                                    │
│   ├── open:    Normal operation. Transactions can be created, approved,     │
│   │            posted, voided, reversed.                                    │
│   ├── closing: Initiated by treasurer. New posts are blocked. Existing      │
│   │            pending items must be resolved (approved/rejected/voided)    │
│   │            before close completes.                                      │
│   └── closed:  Period is frozen. No new transactions, no edits, no posts,   │
│                no voids, no reversals. Reports and audit remain read-only.  │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. State Machines

### 3.1 Approval Request State Machine

```text
                    ┌──────────────┐
                    │   PENDING    │  ← Created, awaiting first approver
                    └──────┬───────┘
                           │ first step executed
                           ▼
                    ┌──────────────┐
                    │  IN_REVIEW   │  ← At least one step decided
                    └──────┬───────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
      ┌──────────────┐          ┌──────────────┐
      │  APPROVED    │          │  REJECTED    │  (Terminal)
      └──────┬───────┘          └──────────────┘
             │
             │ all steps approved
             ▼
      ┌──────────────┐
      │  COMPLETED   │  (Terminal — governance complete)
      └──────────────┘
              │
              │  NOTE: COMPLETED does NOT post to ledger.
              │  Posting is a separate, explicit action.
              ▼
      (Posting is handled by transactions domain)
```

**Additional transitions:**

- `PENDING` / `IN_REVIEW` → `REVISION_REQUESTED`: Any approver requests revision. Returns entity to draft state for correction.
- `PENDING` / `IN_REVIEW` → `CANCELLED`: Requester withdraws the request before completion.

### 3.2 Approval Step State Machine

```text
┌──────────┐     execute     ┌────────────┐
│  PENDING │ ──────────────► │  APPROVED  │
└──────────┘                 └────────────┘
     │                            │
     │ execute (reject)           │
     ▼                            ▼
┌──────────────┐          ┌──────────────┐
│  REJECTED    │          │  SKIPPED     │  (Tier not required for this amount)
└──────────────┘          └──────────────┘
     │
     ▼
┌──────────────────┐
│ REVISION_REQUESTED│
└──────────────────┘
```

**Invariants:**

- Steps execute in `step_index` order. Step N+1 cannot be decided until step N is `APPROVED` or `SKIPPED`.
- A `REJECTED` or `REVISION_REQUESTED` step terminates the entire approval request.
- `SKIPPED` steps occur when a tier is not required for the amount (per policy).

### 3.3 Period State Machine **[PDR5 — LOCKED]**

```text
┌──────────┐   initiate_close()   ┌────────────┐   confirm_close()   ┌──────────┐
│  OPEN    │ ───────────────────► │  CLOSING   │ ───────────────────► │  CLOSED  │
└──────────┘                      └────────────┘                      └──────────┘
     ▲                                 │
     │                                 │ cancel_close()
     │                                 ▼
     └─────────────────────────────────┘
```

**Transition Guards (Two-Person Governance):**

| Transition | Guard | Effect |
| :--- | :--- | :--- |
| `OPEN → CLOSING` | **Treasurer** or admin initiates | New posts blocked; pending items flagged for resolution |
| `CLOSING → CLOSED` | **Pastor/Approver confirms** (different person from initiator); no pending unposted transactions; no unresolved approval requests | Snapshots taken; period frozen |
| `CLOSING → OPEN` | **Treasurer** or admin cancels | Close cancelled; normal operation resumes |
| `CLOSED → *` | **FORBIDDEN** | Period is immutable |

**Closed Period Rules (Locked):**

- **No create** — new transactions cannot be created in a closed period.
- **No edit** — existing transactions cannot be edited.
- **No approve** — approval requests cannot be approved for a closed period.
- **No post** — transactions cannot be posted into a closed period.
- **No direct void** — transactions cannot be voided directly in a closed period.
- **No direct reversal** — reversals cannot be created directly in a closed period.

**Corrections After Close (Locked):**

- The **original transaction remains immutable**.
- Corrections must be an **adjustment/reversal in a new open period**.
- **Do not reopen historical periods by default.**

### 3.4 Tax Certificate State Machine

```text
┌──────────┐   generate()   ┌──────────┐   cancel()   ┌────────────┐
│  DRAFT   │ ─────────────► │  ISSUED  │ ───────────► │  CANCELLED │
└──────────┘                └──────────┘              └────────────┘
                                 │
                                 │ reissue()
                                 ▼
                            ┌──────────┐
                            │ REISSUED │  (new certificate number issued;
                            └──────────┘   original marked CANCELLED,
                                           reissued_from links to original)
```

**Invariants:**

- Certificate numbers are **immutable** and **never reused**.
- A `CANCELLED` certificate retains its number permanently.
- A `REISSUED` certificate has a new number and links back to the original via `reissued_from`.
- Only **posted** giving records contribute to certificate totals.

### 3.5 Budget State Machine **[PDR4 — LOCKED]**

```text
┌──────────┐   propose()   ┌────────────┐   approve()   ┌────────────┐
│  DRAFT   │ ────────────► │  PROPOSED  │ ────────────► │  APPROVED  │
└──────────┘               └────────────┘               └────────────┘
     ▲                          │                            │
     │                          │ revise()                   │
     │                          ▼                            │
     │                     ┌────────────┐                    │
     └─────────────────────│  DRAFT     │                    │
                           └────────────┘                    │
                                                             │
                              change required                │
                                                             ▼
                                                        ┌────────────┐
                                                        │ SUPERSEDED │
                                                        └────────────┘
```

**PDR4 Rules (Locked):**

1. **Treasurer** creates and edits draft budgets.
2. **Pastor** reviews and proposes changes to draft budgets.
3. **Approver/Board** approves the annual budget.
4. **Finance Staff** has view-only access.
5. **Member** has no access.
6. **Approved budgets are immutable** — no edits, no deletions.
7. **Changes require a new budget revision/version** — a new version is created, not an edit of the approved one.

---

## 4. Role Matrix

### 4.1 Approval Permissions

| Action | Super Admin | Treasurer | Finance Staff | Pastor | Approver | Counter | Member |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| View approval policy | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Create/update approval policy | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create approval request | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Execute approval step (≤฿10K tier) | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Execute approval step (>฿10K tier) | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Execute approval step (board tier) | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Request revision | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Terminal reject | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Cancel own request | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View approval queue | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| View approval detail | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |

### 4.2 Budget Permissions **[PDR4 — LOCKED]**

| Action | Super Admin | Treasurer | Finance Staff | Pastor | Approver | Counter | Member |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| View budget & velocity | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Create/edit draft budget** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Review/propose budget** | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Approve annual budget** | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| View budget audit history | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |

**PDR4 Rules (Locked):**

1. **Treasurer** creates and edits draft budgets.
2. **Pastor** reviews and proposes changes to draft budgets.
3. **Approver/Board** approves the annual budget.
4. **Finance Staff** has view-only access.
5. **Member** has no access.
6. **Approved budgets are immutable** — no edits, no deletions.
7. **Changes require a new budget revision/version** — a new version is created, not an edit of the approved one.

### 4.3 Confidential Giving Permissions (Separated) **[LOCKED]**

| Action | Super Admin | Treasurer | Finance Staff | Pastor | Approver | Counter | Member |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Search** members (name/code only, no amounts) | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **View** giving history (amounts) | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Export** giving data (CSV/PDF) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Issue** tax certificate | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Cancel** tax certificate | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Reissue** tax certificate | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |

**Key Distinction (Locked):**

- `search` returns member identity only (name, code, household).
- `view` returns giving amounts.
- `export` produces data files — **stricter than view**: Finance Staff can view but **cannot export**.
- `tax certificate issuance` creates legal documents.
- Each is a separate RPC with separate role checks and separate audit events.
- **Every access and export requires audit logging** — no exceptions.

### 4.4 Reports & Period Closing Permissions **[PDR5 — LOCKED]**

| Action | Super Admin | Treasurer | Finance Staff | Pastor | Approver | Counter | Member |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| View reports | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Initiate** period close | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Confirm** period close | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ |
| Cancel period close | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View closed period reports | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Audit closed period | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

**PDR5 Rules (Locked):**

1. **Treasurer initiates** the period close.
2. **Pastor/Approver confirms** the period close — **two-person governance required**.
3. State machine: `open → closing → closed`.
4. **Closed period rules — no create, no edit, no approve, no post, no direct void, no direct reversal.**
5. **Corrections after close:** The original remains immutable. Corrections must be an **adjustment/reversal in a new open period**.
6. **Do not reopen historical periods by default.**

---

## 5. Policy Model

### 5.1 Approval Policy

**Design:** Approval thresholds are **policy data**, not code.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        APPROVAL POLICY MODEL                           │
├────────────────────────────────────────────────────────────────────────┤
│ ApprovalPolicy                                                          │
│   ├── id: UUID                                                          │
│   ├── church_id: UUID                                                   │
│   ├── version: integer (1, 2, 3, ... per church)                        │
│   ├── effective_from: date (when this version becomes active)           │
│   ├── effective_to: date | null (null = currently active)               │
│   ├── tiers: JSONB (ordered array of tier definitions)                  │
│   │     [                                                                 │
│   │       { tier: 'treasurer', min: 0, max: 10000,                       │
│   │         roles: ['treasurer', 'approver'] },                          │
│   │       { tier: 'pastor', min: 10000.01, max: 50000,                   │
│   │         roles: ['pastor', 'approver'] },                             │
│   │       { tier: 'board', min: 50000.01, max: null,                     │
│   │         roles: ['pastor'], requires_board_resolution: true }         │
│   │     ]                                                                 │
│   ├── created_by: UUID                                                   │
│   ├── created_at: timestamp                                              │
│   └── superseded_by: UUID | null                                         │
└────────────────────────────────────────────────────────────────────────┘
```

**Rules:**

1. **Versioning:** Each policy change creates a new version. Old versions remain readable for audit.
2. **Effective Dating:** A policy version is active only between `effective_from` and `effective_to`. Only one version is active at any time.
3. **Snapshot on Use:** When an `ApprovalRequest` is created, the system records `policy_version` — the exact policy version used to determine the approval chain. This survives later policy changes.
4. **No Hardcoding:** TypeScript code reads the active policy from the database. It never contains monetary thresholds.

### 5.2 Budget Velocity Calendar Policy **[LOCKED]**

| Policy | Formula | Pros | Cons |
| :--- | :--- | :--- | :--- |
| **Day-based** | `Annual × (Days Elapsed / Days in Year)` | Precise, continuous | Slight daily drift; more complex |
| **Month-based** | `Annual × (Months Elapsed / 12)` | Simple, aligns with monthly reporting | Coarse; early-month spikes look over-budget |

**Locked Decision:**

1. **Month-based is the default policy.**
2. **Day-based remains configurable** for future policies.
3. **Policy/version used for a report must be reconstructable** — every velocity report records the calendar policy and version used at computation time.
4. The calendar policy is stored in configuration (church settings or dedicated `budget_policy` table), not hardcoded.
5. The velocity engine reads the policy; it does not hardcode it.

### 5.3 Tax Certificate Policy

**Source of Truth:** Only **posted** giving records contribute to certificate totals. Draft, pending, or voided giving records are excluded.

**Certificate Numbering:** `GL-{year}-{sequential}` where sequential is per-church, per-year, monotonic, and **never reused** even after cancellation.

---

## 6. Data Ownership

| Data | Owner | Source of Truth | Derived/Cache | Rebuildable |
| :--- | :--- | :--- | :--- | :--- |
| `transactions` | Ledger | ✅ Canonical | ❌ | ❌ |
| `transaction_splits` | Ledger | ✅ Canonical | ❌ | ❌ |
| `funds.current_balance` | Ledger | ❌ | ✅ Derived | ✅ From posted transactions |
| `accounts.current_balance` | Ledger | ❌ | ✅ Derived | ✅ From posted transactions |
| `approval_policies` | Governance | ✅ Canonical | ❌ | ❌ |
| `approval_requests` | Governance | ✅ Canonical | ❌ | ❌ |
| `approval_steps` | Governance | ✅ Canonical | ❌ | ❌ |
| `budgets` | Planning | ✅ Canonical (allocation) | ❌ | ❌ |
| `budget_categories` | Planning | ✅ Canonical (allocation) | ❌ | ❌ |
| `budget.spent_amount` | Planning | ❌ | ✅ Derived | ✅ From posted ledger |
| `members` | Directory | ✅ Canonical | ❌ | ❌ |
| `member_giving_records` | Confidential | ✅ Canonical | ❌ | ❌ |
| `tax_certificates` | Confidential | ✅ Canonical | ❌ | ❌ |
| `monthly_summaries` | Reporting | ❌ | ✅ Derived/Cache | ✅ From posted ledger |
| `audit_logs` | Audit | ✅ Canonical (append-only) | ❌ | ❌ |

**Key Rule:** `monthly_summaries` is a **cache**. It can be deleted and rebuilt from the ledger. The ledger is the authority. If a discrepancy exists between `monthly_summaries` and the ledger, the ledger wins.

---

## 7. Security Boundaries

### 7.1 Confidential Giving Access Boundary

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    SECURITY BOUNDARY: MEMBER GIVING                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    PUBLIC / AUTHENTICATED BOUNDARY               │    │
│  │                                                                  │    │
│  │  • members table (name, code, household) — RLS: church-scoped   │    │
│  │  • No giving amounts visible                                     │    │
│  └───────────────────────────────┬─────────────────────────────────┘    │
│                                  │                                      │
│                                  │ RPC boundary (SECURITY DEFINER)      │
│                                  ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                  CONFIDENTIAL BOUNDARY (RPC-ONLY)                │    │
│  │                                                                  │    │
│  │  • member_giving_records — RLS: DENY ALL direct SELECT           │    │
│  │  • tax_certificates — RLS: DENY ALL direct SELECT                │    │
│  │  • Access only via:                                              │    │
│  │      search_member_giving(p_query, p_reason)                     │    │
│  │      get_member_giving_history(p_member_id, p_reason)            │    │
│  │      export_member_giving(p_member_id, p_reason)                 │    │
│  │      generate_tax_certificate(p_member_id, p_year, p_reason)     │    │
│  │      cancel_tax_certificate(p_cert_id, p_reason)                 │    │
│  │      reissue_tax_certificate(p_cert_id, p_reason)                │    │
│  │                                                                  │    │
│  │  • Every RPC:                                                    │    │
│  │      1. Verifies role (pastor | treasurer | admin)               │    │
│  │      2. Writes ACCESS audit log with reason                      │    │
│  │      3. Returns data                                             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Approval Boundary

- Approval RPCs are `SECURITY DEFINER` with explicit role checks.
- Approval requests are church-scoped; cross-church access is impossible.
- Self-approval is blocked at the RPC level (`requested_by <> auth.uid()`).
- Approval policy changes are themselves audited (`SECURITY` category).

### 7.3 Period Closing Boundary

- Period close RPCs are `SECURITY DEFINER` with `treasurer`/`admin` role checks.
- Once `CLOSED`, the period state is immutable. No RPC can reopen it.
- Post-close protection is enforced at the transaction posting RPC level: posting a transaction with `posted_at` in a closed period is rejected.

---

## 8. Financial Invariants

### 8.1 Approval Invariants

1. **Self-Approval Prohibition:** `requested_by <> auth.uid()` for every approval step.
2. **Tier Ordering:** Steps execute in `step_index` order. No skipping forward.
3. **Policy Snapshot:** Every approval request records the `policy_version` used at creation.
4. **Governance ≠ Execution:** `COMPLETED` approval does not post to ledger.
5. **Mandatory Rationale:** Rejections and revision requests require `note >= 5` characters.
6. **Board Resolution:** If policy requires `board_resolution_ref`, the final approval step cannot complete without it.
7. **Idempotency:** A decided step cannot be re-decided.

### 8.2 Budget Invariants

1. **Category Sum Parity:** `SUM(budget_categories.allocated_amount) = budgets.allocated_amount`.
2. **Year/Fund Uniqueness:** One active budget per `(church_id, year, fund_id)`.
3. **Non-Negative Allocation:** `allocated_amount >= 0` for all budget records.
4. **Spent is Derived:** `spent_amount` is computed from posted ledger transactions, never manually edited.
5. **Policy-Driven Velocity:** Calendar policy (day/month) is read from configuration, not hardcoded.
6. **Approved Budgets Immutable:** `APPROVED` budgets cannot be edited or deleted. Changes require a new revision/version.

### 8.3 Confidential Giving Invariants

1. **RLS Lock:** Direct `SELECT` on `member_giving_records` and `tax_certificates` returns zero rows for all roles.
2. **RPC-Only Access:** All reads flow through role-checked, audit-logged RPCs.
3. **ACCESS Audit:** Every search, view, export, and certificate action writes an `ACCESS` audit log with reason.
4. **Posted-Only Certificates:** Certificate totals include only posted giving records.
5. **Immutable Certificate Numbers:** Never reused, even after cancellation.
6. **Cancellation/Reissue Semantics:** A cancelled certificate retains its number; a reissued certificate gets a new number and links back via `reissued_from`.
7. **Export Stricter Than View:** Export requires a higher permission level than view.

### 8.4 Period Closing Invariants

1. **Ledger is Source of Truth:** `monthly_summaries` is derived/cache; ledger wins on discrepancy.
2. **Period State Machine:** `open → closing → closed` with no reverse from `closed`.
3. **Post-Close Protection:** No new transactions can be posted into a closed period.
4. **Snapshot Integrity:** Fund/account balance snapshots are taken at close time and never mutated.
5. **Close Completeness:** A period cannot reach `closed` while pending unposted transactions or unresolved approval requests exist.
6. **Two-Person Governance:** The person who initiates the close cannot be the person who confirms it.

### 8.5 Cross-Cutting Invariants

1. **Money Precision:** All financial values use `NUMERIC(14,2)` in DB and integer Satang / Decimal.js in application.
2. **Audit Append-Only:** `audit_logs` is strictly append-only. `UPDATE` and `DELETE` are revoked.
3. **Church Isolation:** All queries and RPCs are church-scoped. Cross-church access is impossible.

---

## 9. Concurrency

### 9.1 Approval Concurrency

| Scenario | Mechanism | Result |
| :--- | :--- | :--- |
| Two approvers execute the same step simultaneously | `SELECT ... FOR UPDATE` on approval step row | Second caller receives `STEP_ALREADY_DECIDED` error |
| Approver executes step N+1 before step N | Step N status check in RPC | `TIER_ORDER_VIOLATION` error |
| Policy changes while request is in-flight | Request stores `policy_version` snapshot | Request continues under original policy |
| Requester cancels while approver is deciding | Row lock on approval request | Cancel fails if step is already decided |

### 9.2 Period Closing Concurrency

| Scenario | Mechanism | Result |
| :--- | :--- | :--- |
| Two treasurers initiate close simultaneously | `SELECT ... FOR UPDATE` on period state row | Second caller receives `PERIOD_ALREADY_CLOSING` error |
| Transaction posts while period is closing | Posting RPC checks period state | `PERIOD_CLOSING` error — post rejected |
| Transaction posts while period is closed | Posting RPC checks period state | `PERIOD_CLOSED` error — post rejected |
| Report reads while close is in progress | Report RPC reads committed snapshots | Consistent read; no partial close visible |
| Initiator also tries to confirm close | Two-person governance check | `SELF_CONFIRMATION_FORBIDDEN` error |

### 9.3 Tax Certificate Concurrency

| Scenario | Mechanism | Result |
| :--- | :--- | :--- |
| Two users generate certificates for same member/year simultaneously | Unique constraint on `(church_id, member_id, tax_year, status='issued')` | Second caller receives `CERTIFICATE_ALREADY_ISSUED` error |
| Certificate cancelled while PDF is being generated | Row lock on certificate | Generation fails; user must reissue |

---

## 10. Audit Events

### 10.1 Approval Audit Events

| Action | Category | Entity | Metadata |
| :--- | :--- | :--- | :--- |
| `APPROVAL_POLICY_CREATED` | `SECURITY` | `approval_policies` | version, tiers, effective_from |
| `APPROVAL_POLICY_SUPERSEDED` | `SECURITY` | `approval_policies` | old_version, new_version |
| `APPROVAL_REQUEST_CREATED` | `APPROVAL` | `approval_requests` | entity_type, entity_id, amount, policy_version |
| `APPROVAL_STEP_APPROVED` | `APPROVAL` | `approval_requests` | step_index, tier, approver_id, note |
| `APPROVAL_STEP_REJECTED` | `APPROVAL` | `approval_requests` | step_index, tier, approver_id, reason |
| `APPROVAL_STEP_REVISION_REQUESTED` | `APPROVAL` | `approval_requests` | step_index, tier, approver_id, reason |
| `APPROVAL_REQUEST_CANCELLED` | `APPROVAL` | `approval_requests` | cancelled_by, reason |
| `APPROVAL_REQUEST_COMPLETED` | `APPROVAL` | `approval_requests` | completed_at, final_step_index |

### 10.2 Budget Audit Events

| Action | Category | Entity | Metadata |
| :--- | :--- | :--- | :--- |
| `BUDGET_DRAFT_CREATED` | `DATA_CHANGE` | `budgets` | year, fund_id, allocated_amount |
| `BUDGET_PROPOSED` | `DATA_CHANGE` | `budgets` | proposed_by, proposed_at |
| `BUDGET_APPROVED` | `APPROVAL` | `budgets` | approved_by, approved_at |
| `BUDGET_REVISION_CREATED` | `DATA_CHANGE` | `budgets` | superseded_id, new_version |
| `BUDGET_CATEGORY_UPDATED` | `DATA_CHANGE` | `budget_categories` | before/after allocated_amount |
| `BUDGET_VELOCITY_ALERT` | `DATA_CHANGE` | `budgets` | alert_level, velocity_ratio, as_of_date, calendar_policy_version |

### 10.3 Confidential Giving Audit Events

| Action | Category | Entity | Metadata |
| :--- | :--- | :--- | :--- |
| `MEMBER_GIVING_SEARCH` | `ACCESS` | `members` | query, reason |
| `MEMBER_GIVING_VIEW` | `ACCESS` | `member_giving_records` | member_id, reason |
| `MEMBER_GIVING_EXPORT` | `ACCESS` | `member_giving_records` | member_id, format, reason |
| `TAX_CERTIFICATE_ISSUED` | `ACCESS` | `tax_certificates` | member_id, year, certificate_number, reason |
| `TAX_CERTIFICATE_CANCELLED` | `ACCESS` | `tax_certificates` | certificate_number, reason |
| `TAX_CERTIFICATE_REISSUED` | `ACCESS` | `tax_certificates` | original_number, new_number, reason |

### 10.4 Period Closing Audit Events

| Action | Category | Entity | Metadata |
| :--- | :--- | :--- | :--- |
| `PERIOD_CLOSE_INITIATED` | `FINANCIAL` | `monthly_summaries` | month, year, initiated_by |
| `PERIOD_CLOSE_CONFIRMED` | `FINANCIAL` | `monthly_summaries` | month, year, total_income, total_expense, confirmed_by |
| `PERIOD_CLOSE_CANCELLED` | `FINANCIAL` | `monthly_summaries` | month, year, cancelled_by, reason |
| `PERIOD_POST_BLOCKED` | `FINANCIAL` | `transactions` | transaction_id, period, reason |

---

## 11. Dependencies

### 11.1 Module Dependencies

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        M4 MODULE DEPENDENCIES                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  M1 (Foundation) ──► M2 (Financial Core) ──► M3 (Offering)              │
│       │                    │                      │                      │
│       │                    ▼                      ▼                      │
│       │              ┌─────────────┐      ┌─────────────┐               │
│       │              │ transactions │      │ offering_   │               │
│       │              │ & splits     │      │ sessions    │               │
│       │              └──────┬──────┘      └──────┬──────┘               │
│       │                     │                    │                      │
│       ▼                     ▼                    ▼                      │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │                        M4 MODULES                            │        │
│  ├─────────────────────────────────────────────────────────────┤        │
│  │  Module 1: Approvals                                        │        │
│  │    Depends on: M2 transactions, M1 RBAC, M1 audit_logs      │        │
│  │                                                             │        │
│  │  Module 2: Budget & Velocity                                │        │
│  │    Depends on: M2 transactions (posted), M1 funds,          │        │
│  │                M1 categories                                │        │
│  │                                                             │        │
│  │  Module 3: Confidential Giving                              │        │
│  │    Depends on: M1 members, M1 member_giving_records,        │        │
│  │                M3 offering_sessions, M1 audit_logs          │        │
│  │                                                             │        │
│  │  Module 4: Reports & Period Closing                         │        │
│  │    Depends on: M2 transactions (posted), M1 funds,          │        │
│  │                M1 accounts, M3 offering_sessions,           │        │
│  │                Module 1 (approval stats)                    │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 11.2 External Dependencies

| Dependency | Purpose | Risk |
| :--- | :--- | :--- |
| Supabase PostgreSQL 17 | Database, RLS, RPCs | None (already in use) |
| Supabase Auth | Authentication, JWT | None (already in use) |
| Supabase Storage | Tax certificate PDF storage | Requires private bucket + signed URLs |
| Decimal.js | Money precision in application | None (already in use) |
| PDF generation library | Tax certificate PDF rendering | New dependency — evaluate `pdf-lib` or server-side generation |

---

## 12. Risks

| Risk | Severity | Mitigation |
| :--- | :--- | :--- |
| **Member giving data leakage** | **Critical** | RLS denies all direct SELECT; RPC-only access with mandatory reason and ACCESS audit logging; separate permissions for search/view/export/issue |
| **Approval chain bypass** | **High** | DB-level tier ordering; self-approval prohibition; policy snapshot on request; idempotent steps |
| **Policy drift** (thresholds change mid-request) | **High** | Policy versioning with effective dates; request records `policy_version` at creation |
| **Approval implicitly posting** | **High** | Governance/execution separation; `COMPLETED` approval never calls posting RPC |
| **Period close integrity violation** | **High** | Period state machine (open/closing/closed); post-close protection at posting RPC; atomic snapshot; two-person governance |
| **Tax certificate fraud** | **Medium** | Immutable certificate numbers; posted-only totals; cancellation/reissue semantics; ACCESS audit |
| **Budget overspend without alert** | **Medium** | Velocity engine with configurable calendar policy; alert levels trigger UI banners |
| **Approved budget mutation** | **Medium** | Approved budgets immutable; changes require new revision/version |
| **Snapshot drift** (monthly_summaries vs ledger) | **Medium** | Ledger is source of truth; summaries are rebuildable cache; reconciliation check on report generation |
| **PDF generation dependency** | **Low** | Evaluate library before implementation; fallback to HTML print view |
| **Policy misconfiguration** | **Low** | Policy changes require treasurer/admin role; audited as `SECURITY` events |

---

## 13. Definition of Done

### Module 1: Approvals

- [ ] **1. Policy Storage:** `approval_policies` table with versioning, effective dates, and tier definitions.
- [ ] **2. No Hardcoded Thresholds:** TypeScript code reads policy from DB; zero monetary thresholds in code.
- [ ] **3. Policy Snapshot:** Every `approval_requests` records `policy_version` at creation.
- [ ] **4. Approval Chain:** `approval_requests` + `approval_steps` with ordered `step_index`.
- [ ] **5. Self-Approval Prohibition:** `requested_by <> auth.uid()` enforced in all approval RPCs.
- [ ] **6. Tier Ordering:** Steps execute in order; cannot skip forward.
- [ ] **7. Mandatory Rationale:** Rejections and revisions require `note >= 5` characters.
- [ ] **8. Board Resolution:** Policy-required `board_resolution_ref` enforced before final approval.
- [ ] **9. Idempotent Steps:** Decided steps cannot be re-decided.
- [ ] **10. Governance ≠ Execution:** `COMPLETED` approval does not post to ledger.
- [ ] **11. Approval Audit:** All policy changes, request creations, and step decisions write audit events.

### Module 2: Budget & Velocity

- [ ] **12. Budget Tables:** `budgets` and `budget_categories` with year/fund uniqueness.
- [ ] **13. Budget State Machine:** `draft → proposed → approved` with `superseded` for revisions.
- [ ] **14. PDR4 Permissions:** Treasurer create/edit draft · Pastor review/propose · Approver/Board approve · Finance Staff view · Member no access.
- [ ] **15. Approved Budgets Immutable:** `APPROVED` budgets cannot be edited or deleted; changes require new revision/version.
- [ ] **16. Category Sum Parity:** `SUM(budget_categories.allocated_amount) = budgets.allocated_amount` enforced.
- [ ] **17. Spent is Derived:** `spent_amount` computed from posted ledger, never manually edited.
- [ ] **18. Velocity Engine:** Pure TypeScript calculator reading calendar policy from configuration.
- [ ] **19. Calendar Policy:** Month-based default; day-based configurable; policy/version recorded per report.
- [ ] **20. Alert Levels:** On Track (< 0.80), Watch (0.80–1.00), Over Budget (> 1.00) with UI treatments.
- [ ] **21. Budget Audit:** Budget draft/propose/approve/revision events write audit logs.

### Module 3: Confidential Giving

- [ ] **22. RLS Lock:** Direct `SELECT` on `member_giving_records` and `tax_certificates` returns zero rows for all roles.
- [ ] **23. RPC-Only Access:** All reads flow through role-checked, audit-logged RPCs.
- [ ] **24. Separated Permissions:** Distinct RPCs and role checks for search, view, export, and certificate issuance.
- [ ] **25. Export Stricter Than View:** Finance Staff can view but cannot export.
- [ ] **26. ACCESS Audit:** Every search, view, export, and certificate action writes `ACCESS` audit log with reason.
- [ ] **27. Posted-Only Certificates:** Certificate totals include only posted giving records.
- [ ] **28. Immutable Certificate Numbers:** Never reused, even after cancellation.
- [ ] **29. Cancellation/Reissue:** `CANCELLED` retains number; `REISSUED` gets new number with `reissued_from` link.

### Module 4: Reports & Period Closing

- [ ] **30. Period State Machine:** `open → closing → closed` with no reverse from `closed`.
- [ ] **31. Two-Person Governance:** Treasurer initiates; Pastor/Approver confirms; initiator cannot confirm own close.
- [ ] **32. Post-Close Protection:** No create, edit, approve, post, void, or reversal in a closed period.
- [ ] **33. Corrections After Close:** Original remains immutable; corrections via adjustment/reversal in new open period; no reopening historical periods.
- [ ] **34. Snapshot Integrity:** `monthly_summaries` is derived/cache; ledger is source of truth.
- [ ] **35. Close Completeness:** Period cannot reach `closed` with pending unposted transactions or unresolved approvals.
- [ ] **36. Report Catalog:** Monthly summary, fund balance sheet, offering report, approval report all available.
- [ ] **37. Period Audit:** Initiate/confirm/cancel close events write `FINANCIAL` audit logs.

### Cross-Cutting

- [ ] **38. Real PostgreSQL 17 Tests:** All RPCs, constraints, and edge cases pass on live PostgreSQL.
- [ ] **39. Browser E2E:** All 6 screens (10, 11, 12, 15, 16, 17) verified on 390px mobile viewport.
- [ ] **40. TypeScript Typecheck:** 0 errors.
- [ ] **41. Production Build:** 0 errors.

---

## 14. Product Decisions — Locked

| # | Decision | Locked Value | Status |
| :--- | :--- | :--- | :--- |
| 1 | **PDR4 — Budget Permissions** | Treasurer: create/edit draft · Pastor: review/propose · Approver/Board: approve · Finance Staff: view · Member: no access · Approved budgets immutable · Changes require new revision/version | ✅ **LOCKED** |
| 2 | **PDR5 — Monthly Close** | Treasurer initiates · Pastor/Approver confirms (two-person governance) · `open → closing → closed` · Closed: no create/edit/approve/post/void/reversal · Corrections via adjustment in new open period · No reopening historical periods | ✅ **LOCKED** |
| 3 | **Confidential Giving Permissions** | Search / View / Export / Tax Certificate are separate permissions · Export stricter than View (Finance Staff: view yes, export no) · Every access/export requires audit logging | ✅ **LOCKED** |
| 4 | **Budget Velocity Calendar** | Month-based is default · Day-based remains configurable for future policies · Policy/version used for a report must be reconstructable | ✅ **LOCKED** |
| 5 | **PDF generation approach** | Client-side (pdf-lib) / Server-side | ⏳ Evaluate during implementation |
| 6 | **Approval policy storage** | Dedicated table (versioning, effective dates) | ✅ Recommended |
| 7 | **Certificate numbering format** | `GL-{year}-{seq}` (per-church, per-year) | ✅ Recommended |
| 8 | **Period close granularity** | Monthly (matches mockup Screen 17) | ✅ Recommended |

---

## 15. Next Steps

1. ✅ **Architecture Gate approved with locked product decisions.**
2. ⏸️ **M3 Slice 4 must be completed and verified before M4 implementation begins.**
3. ⏸️ **Upon M3 Slice 4 completion and explicit approval, proceed to implementation** — starting with Phase 1 (Database migrations) per the M4 Implementation Plan.
4. **STOP.** No SQL, no application code, no dependency installation until M3 Slice 4 is verified and M4 implementation is explicitly approved.

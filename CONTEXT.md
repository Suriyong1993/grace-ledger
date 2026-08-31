# Grace Ledger — Core Ledger

The accounting core: transaction lifecycle, fund balances, and money math. Excludes RBAC/permissions, RLS/tenant isolation, and offering-entry UI — those are adjacent concerns with their own vocabulary.

## Language

**Transaction**:
A record of a single financial event moving through a fixed lifecycle (`draft` → `pending_approval` → `approved` → `posted`, with `rejected`/`voided` as terminal exits). Carries a `Direction` and an `Amount`.
_Avoid_: Entry, record

**Direction**:
Whether a Transaction is `income`, `expense`, or `transfer`. Determines sign in balance calculations; the Transaction's `Amount` itself is always a positive magnitude.
_Avoid_: Type, kind

**Amount**:
The Money value of a Transaction, always stored as a positive magnitude. Sign is derived from Direction, not carried on Amount itself.

**Approval**:
The `pending_approval → approved` transition. Requires a role at `approver` tier or above, and is subject to the Two-Person Rule.
_Avoid_: Sign-off, review

**Two-Person Rule**:
The invariant that the creator of a Transaction cannot also Approve it (Segregation of Duties). Enforced inside the same transition check as the role requirement — not a separately auditable seam in code today.
_Avoid_: Segregation of duties (use as a synonym only, prefer this term), four-eyes

**Posting**:
The `approved → posted` transition, requiring treasurer-tier role. Distinct from Approval — a Transaction can be approved without being posted. A `draft → posted` direct path also exists for treasurers, bypassing Approval entirely — but subject to the Two-Person Rule: the draft's creator cannot direct-post their own draft, and the post is flagged `DIRECT_POST_BY_TREASURER` in the audit trail.
_Avoid_: Committing, finalizing

**Split**:
Dividing a single Transaction's Amount across multiple Funds. Governed by Split Parity.
_Avoid_: Allocation, distribution

**Split Parity**:
The invariant that `SUM(splits) === transaction.amount` exactly, with no rounding drift. Satang-level remainder distribution guarantees this holds even when dividing evenly or by percentage.

**Fund**:
A named pool of money with a `current_balance` stored as a column (not computed at read time in the funds-service layer — whether it's trigger-maintained or app-write-maintained is still open, see Not yet specified on the map).
_Avoid_: Account, bucket

**Projected Balance**:
A Fund's `current_balance` plus the net effect of Transactions that are approved-but-not-yet-posted, plus a hypothetical Transaction being evaluated. Used to preview whether an action would cause a deficit before committing it. Distinct from `current_balance`, which reflects only posted Transactions.
_Avoid_: Available balance, pending balance

**Deficit**:
The state where a Projected Balance would go negative. Detection (`isDeficit`/`deficitAmount`) exists to block an action before it posts, not just report the result.

**Satang**:
The smallest Thai currency subunit (1 Baht = 100 Satang). Used as the integer basis for exact remainder distribution in Split calculations.

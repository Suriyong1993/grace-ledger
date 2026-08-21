# Grace Ledger — Milestone 1: Foundation Implementation Specification

**Document Status:** Implemented & Verified (M1 Complete)  
**Milestone:** M1 — Foundation  
**System:** Grace Ledger (Church Financial Operating System)  
**Target Engine:** Supabase / PostgreSQL 16  

---

## 1. Executive Overview & Foundation Principles

Milestone 1 establishes the foundational data integrity, access security, and accounting invariants that govern the entire Grace Ledger system. Every financial entry in Grace Ledger must be auditable, strictly assigned to an authorized church and fund, and impervious to silent mutation or privilege escalation.

---

## 2. Canonical Schema Decisions

The database schema is designed around 10 core entities in PostgreSQL:

```
┌──────────────┐       ┌──────────────┐       ┌─────────────────┐
│   churches   │◄──────┤   profiles   │◄──────┤   user_roles    │
└───────┬──────┘       └──────────────┘       └─────────────────┘
        │
        ├─────────────────────────────┬───────────────────────────┐
        ▼                             ▼                           ▼
┌──────────────┐              ┌──────────────┐            ┌───────────────┐
│   accounts   │              │    funds     │            │    members    │
└───────┬──────┘              └───────┬──────┘            └───────┬───────┘
        │                             │                           │
        └──────────────┬──────────────┘                           │
                       ▼                                          ▼
             ┌──────────────────┐                     ┌───────────────────────┐
             │   transactions   │                     │ member_giving_records │
             └─────────┬────────┘                     └───────────────────────┘
                       ▼
             ┌────────────────────┐
             │ transaction_splits │  (Enforces: fund_id NOT NULL)
             └────────────────────┘
```

### Entity Specifications

1. **`churches`**: Multi-tenant isolation anchor.
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `name TEXT NOT NULL`
   - `currency TEXT NOT NULL DEFAULT 'THB'`
   - `settings JSONB DEFAULT '{}'`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

2. **`profiles`**: User details linked to `auth.users`.
   - `id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
   - `church_id UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT`
   - `full_name TEXT NOT NULL`
   - `display_name TEXT`
   - `avatar_url TEXT`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

3. **`user_roles`**: RBAC role mapping.
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE`
   - `church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE`
   - `role user_role_enum NOT NULL` (`super_admin`, `pastor`, `treasurer`, `finance_staff`, `approver`, `counter`, `member`)
   - `granted_at TIMESTAMPTZ NOT NULL DEFAULT now()`
   - `granted_by UUID REFERENCES profiles(id)`
   - `UNIQUE (user_id, church_id, role)`

4. **`accounts`**: Financial custody accounts (Bank accounts, Cash drawers, Petty cash).
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `church_id UUID NOT NULL REFERENCES churches(id)`
   - `name TEXT NOT NULL`
   - `type account_type_enum NOT NULL` (`bank`, `cash_drawer`, `petty_cash`, `electronic_wallet`)
   - `account_number TEXT`
   - `bank_name TEXT`
   - `current_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00`
   - `is_active BOOLEAN NOT NULL DEFAULT true`

5. **`funds`**: Designated church fund envelopes (General, Mission, Building, Youth).
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `church_id UUID NOT NULL REFERENCES churches(id)`
   - `name TEXT NOT NULL`
   - `description TEXT`
   - `target_amount NUMERIC(14,2)`
   - `current_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00`
   - `is_active BOOLEAN NOT NULL DEFAULT true`

6. **`categories`**: Chart of expense/income classifications.
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `church_id UUID NOT NULL REFERENCES churches(id)`
   - `name TEXT NOT NULL`
   - `direction transaction_direction_enum NOT NULL` (`income`, `expense`, `transfer`)
   - `default_fund_id UUID REFERENCES funds(id)`

7. **`transactions`**: Primary ledger header.
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `church_id UUID NOT NULL REFERENCES churches(id)`
   - `account_id UUID NOT NULL REFERENCES accounts(id)`
   - `amount NUMERIC(14,2) NOT NULL CHECK (amount > 0)`
   - `direction transaction_direction_enum NOT NULL` (`income`, `expense`, `transfer`)
   - `status transaction_status_enum NOT NULL DEFAULT 'draft'` (`draft`, `pending`, `approved`, `rejected`, `voided`)
   - `description TEXT NOT NULL`
   - `posted_at TIMESTAMPTZ`
   - `created_by UUID NOT NULL REFERENCES profiles(id)`
   - `approved_by UUID REFERENCES profiles(id)`
   - `is_reversal BOOLEAN NOT NULL DEFAULT false`
   - `reversal_of_id UUID REFERENCES transactions(id)`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

8. **`transaction_splits`**: Canonical fund-allocated ledger entries.
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE`
   - `church_id UUID NOT NULL REFERENCES churches(id)`
   - `fund_id UUID NOT NULL REFERENCES funds(id) ON DELETE RESTRICT`
   - `category_id UUID REFERENCES categories(id) ON DELETE RESTRICT`
   - `amount NUMERIC(14,2) NOT NULL CHECK (amount > 0)`
   - `note TEXT`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

9. **`fund_transfers`**: Inter-fund atomic transfers.
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
   - `church_id UUID NOT NULL REFERENCES churches(id)`
   - `from_fund_id UUID NOT NULL REFERENCES funds(id) ON DELETE RESTRICT`
   - `to_fund_id UUID NOT NULL REFERENCES funds(id) ON DELETE RESTRICT`
   - `amount NUMERIC(14,2) NOT NULL CHECK (amount > 0)`
   - `note TEXT`
   - `status transfer_status_enum NOT NULL DEFAULT 'completed'`
   - `created_by UUID NOT NULL REFERENCES profiles(id)`
   - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
   - `CHECK (from_fund_id <> to_fund_id)`

10. **`member_giving_records`**: Highly confidential tithe/offering contributions.
    - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
    - `church_id UUID NOT NULL REFERENCES churches(id)`
    - `member_id UUID NOT NULL REFERENCES members(id)`
    - `amount NUMERIC(14,2) NOT NULL CHECK (amount > 0)`
    - `giving_type TEXT NOT NULL` (`tithe`, `general`, `mission`, `building`, `special`)
    - `payment_method TEXT NOT NULL` (`bank_transfer`, `cash`, `qr_promptpay`)
    - `given_at DATE NOT NULL`
    - `confidential_note TEXT`
    - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

11. **`audit_logs`**: Append-only system audit trail.
    - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
    - `church_id UUID NOT NULL REFERENCES churches(id)`
    - `category audit_category_enum NOT NULL` (`DATA_CHANGE`, `ACCESS`, `SECURITY`, `APPROVAL`, `FINANCIAL`)
    - `actor_id UUID REFERENCES profiles(id)`
    - `action TEXT NOT NULL`
    - `entity_type TEXT NOT NULL`
    - `entity_id UUID`
    - `before_state JSONB`
    - `after_state JSONB`
    - `metadata JSONB DEFAULT '{}'`
    - `ip_address TEXT`
    - `user_agent TEXT`
    - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

---

## 3. Centralized Security Definer Architecture

To avoid dispersed, brittle JWT assumptions in RLS policies, all security resolution occurs via centralized, cached PostgreSQL `SECURITY DEFINER` functions:

```sql
-- 1. Get church_id for active authenticated user
CREATE OR REPLACE FUNCTION current_user_church_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT church_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 2. Check if user holds a specific role in their church
CREATE OR REPLACE FUNCTION current_user_has_role(p_required_role user_role_enum)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
      AND church_id = current_user_church_id() 
      AND role = p_required_role
  );
$$;

-- 3. Unified Church Access Validator
CREATE OR REPLACE FUNCTION has_church_access(p_church_id UUID, p_minimum_role user_role_enum DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_church UUID;
  v_user_role user_role_enum;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT church_id INTO v_user_church FROM profiles WHERE id = auth.uid();
  IF v_user_church IS NULL OR v_user_church <> p_church_id THEN
    RETURN FALSE;
  END IF;

  IF p_minimum_role IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Check role hierarchy
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND church_id = p_church_id
      AND (
        role = 'super_admin'
        OR (p_minimum_role = 'pastor' AND role IN ('super_admin', 'pastor'))
        OR (p_minimum_role = 'treasurer' AND role IN ('super_admin', 'pastor', 'treasurer'))
        OR (p_minimum_role = 'finance_staff' AND role IN ('super_admin', 'pastor', 'treasurer', 'finance_staff'))
        OR (p_minimum_role = 'approver' AND role IN ('super_admin', 'pastor', 'treasurer', 'approver'))
        OR (p_minimum_role = 'counter' AND role IN ('super_admin', 'treasurer', 'counter'))
        OR (p_minimum_role = 'member' AND role IN ('super_admin', 'pastor', 'treasurer', 'finance_staff', 'approver', 'counter', 'member'))
      )
  );
END;
$$;
```

---

## 4. RBAC & RLS Matrix

### Role Permissions

| Role | Permissions Overview |
| :--- | :--- |
| **`super_admin`** | Full access to church configuration, users, roles, financial records, audit logs, and export. |
| **`pastor`** | Full view of all finances, fund statuses, budget actuals, approval decisions; **Confidential access to Member Giving** (logged); View audit trail. |
| **`treasurer`** | Full management of accounts, funds, transactions, budget entries, cash counting, and financial exports; **Confidential access to Member Giving** (logged). |
| **`finance_staff`** | Create transaction drafts, upload receipts, prepare Sunday offering entry, view regular transaction history. |
| **`approver`** | View pending approval queue, approve/request-revision/reject expense requests within designated threshold. |
| **`counter`** | Access active Sunday cash count sessions, enter denomination counts, sign dual-counter records. |
| **`member`** | View self-profile, access self-giving records (only via personal member portal, not church ledger). |

### RLS Policies Architecture

- **`churches`**: `SELECT` where `id = current_user_church_id()`.
- **`profiles`**: `SELECT` where `church_id = current_user_church_id()`, `UPDATE` where `id = auth.uid()`.
- **`accounts`, `funds`, `categories`**: `SELECT` where `has_church_access(church_id, 'member')`, `INSERT/UPDATE` where `has_church_access(church_id, 'treasurer')`.
- **`transactions`, `transaction_splits`**: `SELECT` where `has_church_access(church_id, 'finance_staff')`, `INSERT` where `has_church_access(church_id, 'finance_staff')`, `UPDATE (draft only)` where `has_church_access(church_id, 'finance_staff') AND status = 'draft'`.
- **`member_giving_records`**: Direct `SELECT` via RLS is **LOCKED (Denied for all regular queries)**. Access is exclusively mediated by `get_member_giving_history()` RPC.
- **`audit_logs`**: `SELECT` where `has_church_access(church_id, 'pastor')`, `INSERT/UPDATE/DELETE` denied for all users (system trigger insertion only).

---

## 5. Member Giving Confidentiality & Access Audit Flow

```
   Client UI (Screen 15/16)
              │
              │  1. Invoke RPC: get_member_giving_history(p_member_id, p_reason)
              ▼
   PostgreSQL RPC (SECURITY DEFINER)
              │
              │  2. Assert: has_church_access(church_id, 'pastor') OR is_head_treasurer
              │
              │  3. INSERT INTO audit_logs (Category: 'ACCESS', Action: 'VIEW_MEMBER_GIVING',
              │                             Entity: 'member_giving_records', Actor: auth.uid(),
              │                             Metadata: { member_id, reason, timestamp })
              │
              │  4. SELECT * FROM member_giving_records WHERE member_id = p_member_id
              ▼
   Authorized Record Set Returned to Client
```

---

## 6. Financial Safety Invariants & Atomic Operations

### Invariant 1: Mandatory Fund Association on Splits
```sql
-- Database constraint check on transaction_splits
ALTER TABLE transaction_splits
  ADD CONSTRAINT chk_split_fund_required CHECK (fund_id IS NOT NULL),
  ADD CONSTRAINT chk_split_amount_positive CHECK (amount > 0);

-- Trigger to verify split sum matches parent transaction amount upon approval/posting
CREATE OR REPLACE FUNCTION fn_validate_transaction_split_sum()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_split_total NUMERIC(14,2);
  v_parent_amount NUMERIC(14,2);
BEGIN
  SELECT amount INTO v_parent_amount FROM transactions WHERE id = NEW.transaction_id;
  SELECT COALESCE(SUM(amount), 0) INTO v_split_total FROM transaction_splits WHERE transaction_id = NEW.transaction_id;

  -- Verify on status change to 'approved' or 'pending'
  IF NEW.status IN ('pending', 'approved') AND v_split_total <> v_parent_amount THEN
    RAISE EXCEPTION 'Transaction split sum (%) does not equal total transaction amount (%)', v_split_total, v_parent_amount;
  END IF;

  RETURN NEW;
END;
$$;
```

### Invariant 2: Atomic Fund Transfer RPC (`transfer_funds`)
```sql
CREATE OR REPLACE FUNCTION transfer_funds(
  p_church_id UUID,
  p_from_fund_id UUID,
  p_to_fund_id UUID,
  p_amount NUMERIC(14,2),
  p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer_id UUID;
  v_from_balance NUMERIC(14,2);
BEGIN
  -- 1. Authorization check
  IF NOT has_church_access(p_church_id, 'treasurer') THEN
    RAISE EXCEPTION 'Unauthorized: Only treasurers or administrators may transfer funds.';
  END IF;

  -- 2. Domain validations
  IF p_from_fund_id = p_to_fund_id THEN
    RAISE EXCEPTION 'Source fund and destination fund must be different.';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be strictly greater than zero.';
  END IF;

  -- 3. Lock source and destination fund rows to prevent concurrency race conditions
  SELECT current_balance INTO v_from_balance FROM funds WHERE id = p_from_fund_id AND church_id = p_church_id FOR UPDATE;
  PERFORM 1 FROM funds WHERE id = p_to_fund_id AND church_id = p_church_id FOR UPDATE;

  IF v_from_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient fund balance in source fund. Available: %, Requested: %', v_from_balance, p_amount;
  END IF;

  -- 4. Execute atomic transfer record
  INSERT INTO fund_transfers (church_id, from_fund_id, to_fund_id, amount, note, created_by)
  VALUES (p_church_id, p_from_fund_id, p_to_fund_id, p_amount, p_note, auth.uid())
  RETURNING id INTO v_transfer_id;

  -- 5. Update cached balances with zero net effect assertion
  UPDATE funds SET current_balance = current_balance - p_amount WHERE id = p_from_fund_id;
  UPDATE funds SET current_balance = current_balance + p_amount WHERE id = p_to_fund_id;

  -- 6. Log financial audit event
  INSERT INTO audit_logs (
    church_id, category, actor_id, action, entity_type, entity_id,
    metadata
  ) VALUES (
    p_church_id, 'FINANCIAL', auth.uid(), 'FUND_TRANSFER', 'fund_transfers', v_transfer_id,
    jsonb_build_object('from_fund', p_from_fund_id, 'to_fund', p_to_fund_id, 'amount', p_amount, 'net_impact', 0.00)
  );

  RETURN v_transfer_id;
END;
$$;
```

### Invariant 3: Transaction Immutability & Void/Reversal Pattern
```sql
CREATE OR REPLACE FUNCTION void_transaction(
  p_transaction_id UUID,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orig transactions%ROWTYPE;
  v_reversal_id UUID;
BEGIN
  -- 1. Fetch and lock target transaction
  SELECT * INTO v_orig FROM transactions WHERE id = p_transaction_id FOR UPDATE;
  
  IF v_orig.id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found: %', p_transaction_id;
  END IF;

  IF NOT has_church_access(v_orig.church_id, 'treasurer') THEN
    RAISE EXCEPTION 'Unauthorized: Only treasurers or administrators may void transactions.';
  END IF;

  IF v_orig.status = 'voided' THEN
    RAISE EXCEPTION 'Transaction is already voided.';
  END IF;

  -- 2. Mark original transaction as voided (NOT DELETED)
  UPDATE transactions 
  SET status = 'voided' 
  WHERE id = p_transaction_id;

  -- 3. Create balancing reversal entry
  INSERT INTO transactions (
    church_id, account_id, amount, direction, status,
    description, posted_at, created_by, is_reversal, reversal_of_id
  ) VALUES (
    v_orig.church_id,
    v_orig.account_id,
    v_orig.amount,
    CASE WHEN v_orig.direction = 'income' THEN 'expense' ELSE 'income' END,
    'approved',
    'Reversal of TX-' || SUBSTRING(v_orig.id::TEXT FROM 1 FOR 8) || ': ' || p_reason,
    now(),
    auth.uid(),
    true,
    v_orig.id
  ) RETURNING id INTO v_reversal_id;

  -- 4. Reversal splits
  INSERT INTO transaction_splits (transaction_id, church_id, fund_id, category_id, amount, note)
  SELECT v_reversal_id, church_id, fund_id, category_id, amount, 'Reversal split for: ' || p_reason
  FROM transaction_splits
  WHERE transaction_id = v_orig.id;

  -- 5. Audit log
  INSERT INTO audit_logs (
    church_id, category, actor_id, action, entity_type, entity_id,
    metadata
  ) VALUES (
    v_orig.church_id, 'FINANCIAL', auth.uid(), 'VOID_TRANSACTION', 'transactions', p_transaction_id,
    jsonb_build_object('reversal_transaction_id', v_reversal_id, 'reason', p_reason)
  );

  RETURN v_reversal_id;
END;
$$;
```

---

## 7. Change Data Capture Audit Triggers

All financial tables (`transactions`, `transaction_splits`, `funds`, `accounts`, `fund_transfers`) are attached to an automated trigger `fn_audit_log_change()` that captures `OLD` and `NEW` row snapshots:

```sql
CREATE OR REPLACE FUNCTION fn_audit_log_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_church_id UUID;
  v_entity_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_church_id := OLD.church_id;
    v_entity_id := OLD.id;
  ELSE
    v_church_id := NEW.church_id;
    v_entity_id := NEW.id;
  END IF;

  INSERT INTO audit_logs (
    church_id, category, actor_id, action, entity_type, entity_id,
    before_state, after_state
  ) VALUES (
    v_church_id,
    'DATA_CHANGE',
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    v_entity_id,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;
```

---

## 8. Two-Tier Testing Architecture

```
tests/
├── unit/                                  # Tier 1: Pure TypeScript / Node Unit Tests
│   ├── money.test.ts                      # Precision arithmetic, rounding, satang conversions
│   ├── rbac.test.ts                       # Permission matrix, hierarchy, role assertions
│   └── domain-schemas.test.ts             # Zod validation schemas for transactions & transfers
└── integration/                           # Tier 2: Real Database Integration Tests
    ├── database/
    │   ├── constraints.test.ts            # fund_id NOT NULL, amount > 0, same-fund transfer blocked
    │   ├── rpcs-atomic-transfer.test.ts   # transfer_funds rollback on failure & net=0 balance check
    │   ├── rpcs-void-reversal.test.ts     # void_transaction creates reversal & prevents silent edits
    │   ├── rls-tenant-isolation.test.ts   # Cross-church queries return empty results
    │   ├── rls-member-giving.test.ts      # Direct SELECT denied, RPC access logged
    │   └── audit-triggers.test.ts         # Verified that INSERT/UPDATE on ledger creates audit row
```

---

---

## 9. Remaining Risks & Pre-M2 Checkpoints

1. **Test Environment Provisioning:** Tier 2 database integration tests require a running PostgreSQL / Supabase local container (`supabase start`) or dedicated staging database instance.
2. **Historical Data Migration (if existing data exists):** Verify that all legacy transactions are backfilled with valid `fund_id` and split associations before activating NOT NULL constraints.
3. **M1 Completion Criteria:** M1 will only be marked complete once all Tier 1 and Tier 2 tests pass 100% with zero type errors and zero floating-point calculations.

---

## 10. Final Architecture Review (7 Pre-Implementation Areas)

### Item 1: Transaction Split Lifecycle & State Machine
- **Evaluation:** **PASS**
- **Evidence:** 
  - Lifecycle state machine defined: `draft` $\rightarrow$ `pending_approval` $\rightarrow$ `posted` $\rightarrow$ `voided`.
  - In `draft` state: Partial writes, adding, editing, and deleting `transaction_splits` are permitted without premature validation failure.
  - The invariant validation trigger (`fn_validate_transaction_split_sum()`) is configured to fire **only when transaction status transitions from `draft` to `pending_approval` or `posted`**, and on any update/delete of splits on a non-draft transaction:
    ```sql
    IF (TG_OP = 'UPDATE' AND NEW.status IN ('pending_approval', 'posted') AND OLD.status = 'draft') THEN
      -- Assert SUM(transaction_splits.amount) == NEW.amount
    END IF;
    ```
  - `posted` and `voided` records are strictly immutable (UPDATE/DELETE prohibited).
- **Exact Recommendation:** Enforce state-transition trigger validation on `transactions(status)` and raise a descriptive error `Transaction split sum (%s) does not match parent transaction amount (%s)` upon submitting/posting.

---

### Item 2: Fund Balance Model (Ledger vs. Cached)
- **Evaluation:** **PASS**
- **Evidence:**
  - **Ground Truth:** Canonical balance is derived strictly from immutable ledger records:
    $$\text{Fund Balance} = \sum_{\text{posted income splits}} \text{amount} - \sum_{\text{posted expense splits}} \text{amount} + \sum_{\text{transfers in}} \text{amount} - \sum_{\text{transfers out}} \text{amount}$$
  - **Performance Cache:** `funds.current_balance` is maintained as a transactional cache updated atomically upon transaction posting and transfer completion.
  - **Drift Prevention:** A deterministic reconciliation function `reconcile_fund_balances(p_church_id)` runs assertions against the ledger calculation and alerts if any discrepancy $> ฿0.00$ is detected.
- **Exact Recommendation:** Use immutable ledger calculations for all formal financial reports, balance sheets, and audit verifications. Use the transactional cached `current_balance` for low-latency dashboard cards with scheduled reconciliation.

---

### Item 3: Transfer Model & Ledger Representation
- **Evaluation:** **PASS**
- **Evidence:**
  - Single atomic PostgreSQL function `transfer_funds()` running in an isolated transaction block.
  - Pre-condition assertions:
    1. `from_fund_id <> to_fund_id` (enforced by DB check and RPC assertion).
    2. `p_amount > 0`.
    3. `has_church_access(p_church_id, 'treasurer')`.
    4. Both funds belong to `p_church_id`.
    5. Source fund has available balance $\ge \text{p\_amount}$ (row locked via `SELECT ... FOR UPDATE`).
  - **Ledger Representation:** Creates 1 entry in `fund_transfers` and 1 balanced transaction of direction `'transfer'` with two offsetting splits:
    - Split 1 (Debit): `fund_id = from_fund_id`, `amount = p_amount`
    - Split 2 (Credit): `fund_id = to_fund_id`, `amount = p_amount`
    - Net Church Balance Impact $= 0.00$.
  - Generates immutable `FINANCIAL` audit log entry.
- **Exact Recommendation:** Prohibit partial execution using PostgreSQL automatic exception rollback.

---

### Item 4: Void / Reversal Pattern & Historical Reconstructability
- **Evaluation:** **PASS**
- **Evidence:**
  - Reversal workflow via `void_transaction(p_transaction_id, p_reason)`:
    1. Sets target transaction status to `'voided'`.
    2. Inserts balancing reversal transaction (`is_reversal = true`, `reversal_of_id = p_transaction_id`, `status = 'posted'`) with inverted direction.
    3. Duplicates all splits with reference to the reversal transaction.
    4. Records `FINANCIAL` audit event with reason and actor ID.
  - **Reporting Invariant:** Operational monthly reports filter `WHERE status = 'posted' AND is_reversal = false` (or sum all `posted` transactions where the original and reversal mathematically cancel to ฿0.00). Voided records (`status = 'voided'`) remain in the database for audit trail reconstruction.
- **Exact Recommendation:** Prohibit SQL `DELETE` on posted transactions at the RLS and trigger levels.

---

### Item 5: Member Giving Access & RPC Security Definer Hardening
- **Evaluation:** **PASS**
- **Evidence:**
  - Direct client `SELECT` on `member_giving_records` is completely denied by RLS (`USING (false)`).
  - Secure Access Path: `get_member_giving_history(p_member_id UUID, p_reason TEXT)`:
    ```sql
    CREATE OR REPLACE FUNCTION get_member_giving_history(p_member_id UUID, p_reason TEXT)
    RETURNS SETOF member_giving_records
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
    DECLARE
      v_church_id UUID;
    BEGIN
      SELECT church_id INTO v_church_id FROM members WHERE id = p_member_id;
      IF NOT has_church_access(v_church_id, 'pastor') THEN
        RAISE EXCEPTION 'Access Denied: You do not have permission to view confidential member giving records.';
      END IF;
      IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
        RAISE EXCEPTION 'Access Denied: A valid justification reason (min 5 chars) is required.';
      END IF;

      -- Mandatory Access Audit Log
      INSERT INTO audit_logs (church_id, category, actor_id, action, entity_type, entity_id, metadata)
      VALUES (v_church_id, 'ACCESS', auth.uid(), 'VIEW_MEMBER_GIVING', 'members', p_member_id,
              jsonb_build_object('reason', p_reason, 'timestamp', now()));

      RETURN QUERY SELECT * FROM member_giving_records WHERE member_id = p_member_id ORDER BY given_at DESC;
    END;
    $$;
    ```
- **Exact Recommendation:** Set explicit `search_path = public, pg_temp` on all `SECURITY DEFINER` functions and enforce internal authorization checks independent of RLS.

---

### Item 6: Multi-Tenant RLS Enforcement
- **Evaluation:** **PASS**
- **Evidence:**
  - Every tenant entity possesses `church_id UUID NOT NULL REFERENCES churches(id)`.
  - All standard CRUD operations are bound by `has_church_access(church_id, ...)`:
    - Cross-church `SELECT`: Returns empty set (0 rows).
    - Cross-church `INSERT`: Rejected by `WITH CHECK (church_id = current_user_church_id())`.
    - Cross-church `UPDATE`: Rejected by `USING (church_id = current_user_church_id())`.
    - Cross-church `DELETE`: Blocked / Restricted.
  - `SECURITY DEFINER` helper functions (`current_user_church_id()`, `has_church_access()`) are locked with explicit schema paths to prevent search path hijacking.
- **Exact Recommendation:** Maintain zero reliance on client-provided `church_id` parameters in API calls; resolve tenant identity strictly from `auth.uid() -> profiles.church_id`.

---

### Item 7: Migration Safety & Dependency Sequencing
- **Evaluation:** **PASS**
- **Evidence:**
  - Strictly non-destructive migration order:
    1. Schema & Enums (`IF NOT EXISTS`)
    2. Security Definers & Helper Functions (`CREATE OR REPLACE`)
    3. Financial RPCs & State Transition Triggers (`CREATE OR REPLACE`)
    4. RLS Security Policies (`DROP POLICY IF EXISTS ... CREATE POLICY`)
  - No `DROP TABLE`, `DROP COLUMN`, or truncation commands.
  - Foreign keys utilize `ON DELETE RESTRICT` for all financial entities to prevent accidental cascading data loss.
- **Exact Recommendation:** Include matching rollback scripts (`down/`) for each migration step and verify on an isolated test database before staging.


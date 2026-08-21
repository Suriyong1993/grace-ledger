-- ==============================================================================
-- Grace Ledger — Migration 005: Transaction Core & Explicit Approval Workflow
-- Author: Principal Engineer
-- Target: PostgreSQL 17 / Supabase
-- Invariants Enforced:
--   1. Explicit Transaction State Machine: draft -> pending_approval -> approved -> posted -> voided
--   2. Segregation of Duties: created_by <> approved_by (Two-Person Rule)
--   3. Split Sum Parity: SUM(splits) = transaction.amount on submit/approve/post
--   4. Immutable Ledger: Posted records cannot be altered, only balanced via void/reversal
--   5. Mandatory Rejection Reason (>= 5 chars) on workflow rejection
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ENUMS & TABLE MODIFICATIONS
-- ------------------------------------------------------------------------------

-- Add 'approved' status to transaction_status_enum if not present
DO $$
BEGIN
  ALTER TYPE transaction_status_enum ADD VALUE IF NOT EXISTS 'approved' BEFORE 'posted';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add tracking columns for approval and rejection workflows
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES profiles(id) ON DELETE RESTRICT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ------------------------------------------------------------------------------
-- 2. STATE TRANSITION & SPLIT VALIDATION TRIGGER UPDATE
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_validate_transaction_split_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_split_total NUMERIC(14,2);
  v_split_count INTEGER;
BEGIN
  -- 1. Validate split sum parity on transition from draft to any advanced state
  IF (TG_OP = 'UPDATE' AND NEW.status IN ('pending_approval', 'approved', 'posted') AND OLD.status = 'draft') THEN
    SELECT COALESCE(SUM(amount), 0), COUNT(*) 
    INTO v_split_total, v_split_count
    FROM transaction_splits 
    WHERE transaction_id = NEW.id;

    IF v_split_count = 0 THEN
      RAISE EXCEPTION 'Transaction split validation failed: Transaction must have at least one split.';
    END IF;

    IF v_split_total <> NEW.amount THEN
      RAISE EXCEPTION 'Transaction split validation failed: Sum of splits (฿%) does not match transaction amount (฿%).', v_split_total, NEW.amount;
    END IF;
  END IF;

  -- 2. Protect non-draft transactions from direct modification of core financial fields
  IF (TG_OP = 'UPDATE' AND OLD.status IN ('pending_approval', 'approved', 'posted', 'voided')) THEN
    -- Allow rejection (pending_approval -> draft)
    IF NOT (OLD.status = 'pending_approval' AND NEW.status = 'draft') THEN
      IF (NEW.amount <> OLD.amount OR NEW.account_id <> OLD.account_id OR NEW.direction <> OLD.direction) THEN
        RAISE EXCEPTION 'Immutable Ledger: Financial attributes of % transactions cannot be modified directly.', OLD.status;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. RPC: SUBMIT TRANSACTION FOR APPROVAL
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION submit_transaction(p_transaction_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_txn transactions%ROWTYPE;
  v_split_sum NUMERIC(14,2);
  v_split_count INTEGER;
  v_invalid_split_count INTEGER;
BEGIN
  -- 1. Fetch and lock transaction
  SELECT * INTO v_txn FROM transactions WHERE id = p_transaction_id FOR UPDATE;

  IF v_txn.id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found: %', p_transaction_id;
  END IF;

  -- 2. Authorize caller (Finance Staff or Creator belonging to the church)
  IF NOT (has_church_access(v_txn.church_id, 'finance_staff') OR v_txn.created_by = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: Caller does not have authority to submit this transaction.';
  END IF;

  -- 3. Validate current state is draft
  IF v_txn.status <> 'draft' THEN
    RAISE EXCEPTION 'Invalid State Transition: Only draft transactions can be submitted (current status: %).', v_txn.status;
  END IF;

  -- 4. Check split constraints
  SELECT 
    COALESCE(SUM(amount), 0),
    COUNT(*),
    COUNT(*) FILTER (WHERE fund_id IS NULL OR amount <= 0)
  INTO v_split_sum, v_split_count, v_invalid_split_count
  FROM transaction_splits
  WHERE transaction_id = p_transaction_id;

  IF v_split_count = 0 THEN
    RAISE EXCEPTION 'Invalid Submission: Transaction must have at least one split.';
  END IF;

  IF v_invalid_split_count > 0 THEN
    RAISE EXCEPTION 'Invalid Submission: All splits must have a designated fund and positive amount.';
  END IF;

  IF v_split_sum <> v_txn.amount THEN
    RAISE EXCEPTION 'Invalid Submission: Split sum (฿%) must equal transaction amount (฿%).', v_split_sum, v_txn.amount;
  END IF;

  -- 5. Transition status to pending_approval
  UPDATE transactions
  SET status = 'pending_approval', updated_at = now()
  WHERE id = p_transaction_id;

  -- 6. Record APPROVAL audit log
  INSERT INTO audit_logs (
    church_id, category, actor_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_txn.church_id, 'APPROVAL', auth.uid(), 'SUBMIT_FOR_APPROVAL', 'transactions', p_transaction_id,
    jsonb_build_object(
      'amount', v_txn.amount,
      'split_count', v_split_count,
      'submitted_at', now()
    )
  );

  RETURN p_transaction_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. RPC: APPROVE TRANSACTION (TWO-PERSON RULE)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION approve_transaction(
  p_transaction_id UUID,
  p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_txn transactions%ROWTYPE;
  v_split_sum NUMERIC(14,2);
BEGIN
  -- 1. Fetch and lock transaction
  SELECT * INTO v_txn FROM transactions WHERE id = p_transaction_id FOR UPDATE;

  IF v_txn.id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found: %', p_transaction_id;
  END IF;

  -- 2. Authorize caller (Must have approver role)
  IF NOT has_church_access(v_txn.church_id, 'approver') THEN
    RAISE EXCEPTION 'Unauthorized: Only designated approvers or pastors may approve transactions.';
  END IF;

  -- 3. Verify state
  IF v_txn.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Invalid State Transition: Transaction is not pending approval (current status: %).', v_txn.status;
  END IF;

  -- 4. Enforce Two-Person Rule (Segregation of Duties)
  IF auth.uid() = v_txn.created_by THEN
    RAISE EXCEPTION 'Segregation of Duties Violation: Creator cannot approve their own transaction (user: %).', auth.uid();
  END IF;

  -- 5. Verify split sum parity
  SELECT COALESCE(SUM(amount), 0) INTO v_split_sum
  FROM transaction_splits
  WHERE transaction_id = p_transaction_id;

  IF v_split_sum <> v_txn.amount THEN
    RAISE EXCEPTION 'Integrity Error: Split sum (฿%) does not match transaction amount (฿%).', v_split_sum, v_txn.amount;
  END IF;

  -- 6. Transition to approved
  UPDATE transactions
  SET 
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = now(),
    updated_at = now()
  WHERE id = p_transaction_id;

  -- 7. Record APPROVAL audit log
  INSERT INTO audit_logs (
    church_id, category, actor_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_txn.church_id, 'APPROVAL', auth.uid(), 'APPROVE_TRANSACTION', 'transactions', p_transaction_id,
    jsonb_build_object(
      'amount', v_txn.amount,
      'approved_by', auth.uid(),
      'created_by', v_txn.created_by,
      'note', p_note,
      'approved_at', now()
    )
  );

  RETURN p_transaction_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. RPC: REJECT TRANSACTION
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION reject_transaction(
  p_transaction_id UUID,
  p_rejection_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_txn transactions%ROWTYPE;
BEGIN
  -- 1. Fetch and lock transaction
  SELECT * INTO v_txn FROM transactions WHERE id = p_transaction_id FOR UPDATE;

  IF v_txn.id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found: %', p_transaction_id;
  END IF;

  -- 2. Authorize caller (Must have approver role)
  IF NOT has_church_access(v_txn.church_id, 'approver') THEN
    RAISE EXCEPTION 'Unauthorized: Only designated approvers may reject transactions.';
  END IF;

  -- 3. Verify state
  IF v_txn.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Invalid State Transition: Transaction is not pending approval (current status: %).', v_txn.status;
  END IF;

  -- 4. Validate rejection reason
  IF p_rejection_reason IS NULL OR length(trim(p_rejection_reason)) < 5 THEN
    RAISE EXCEPTION 'Invalid Rejection: A specific rejection reason (minimum 5 characters) is mandatory.';
  END IF;

  -- 5. Revert status to draft with rejection details
  UPDATE transactions
  SET 
    status = 'draft',
    rejected_by = auth.uid(),
    rejected_at = now(),
    rejection_reason = trim(p_rejection_reason),
    updated_at = now()
  WHERE id = p_transaction_id;

  -- 6. Record APPROVAL audit log
  INSERT INTO audit_logs (
    church_id, category, actor_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_txn.church_id, 'APPROVAL', auth.uid(), 'REJECT_TRANSACTION', 'transactions', p_transaction_id,
    jsonb_build_object(
      'rejection_reason', trim(p_rejection_reason),
      'rejected_by', auth.uid(),
      'rejected_at', now()
    )
  );

  RETURN p_transaction_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. RPC: POST TRANSACTION TO IMMUTABLE LEDGER
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION post_transaction(p_transaction_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_txn transactions%ROWTYPE;
  v_split_sum NUMERIC(14,2);
  v_account accounts%ROWTYPE;
BEGIN
  -- 1. Fetch and lock transaction
  SELECT * INTO v_txn FROM transactions WHERE id = p_transaction_id FOR UPDATE;

  IF v_txn.id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found: %', p_transaction_id;
  END IF;

  -- 2. Authorize caller (Treasurer or Admin only)
  IF NOT has_church_access(v_txn.church_id, 'treasurer') THEN
    RAISE EXCEPTION 'Unauthorized: Only treasurers or administrators may post transactions to the ledger.';
  END IF;

  -- 3. Verify status (Must be approved, or draft if direct posting by treasurer with valid splits)
  IF v_txn.status NOT IN ('approved', 'draft') THEN
    RAISE EXCEPTION 'Invalid State Transition: Only approved transactions (or draft by treasurer) can be posted (current status: %).', v_txn.status;
  END IF;

  -- 4. Verify split sum matches amount
  SELECT COALESCE(SUM(amount), 0) INTO v_split_sum
  FROM transaction_splits
  WHERE transaction_id = p_transaction_id;

  IF v_split_sum <> v_txn.amount THEN
    RAISE EXCEPTION 'Integrity Error: Split sum (฿%) does not match transaction amount (฿%).', v_split_sum, v_txn.amount;
  END IF;

  -- 5. Lock account
  SELECT * INTO v_account FROM accounts WHERE id = v_txn.account_id FOR UPDATE;
  IF v_account.id IS NULL OR v_account.church_id <> v_txn.church_id THEN
    RAISE EXCEPTION 'Invalid Account: Transaction account does not belong to church.';
  END IF;

  -- 6. Lock and mutate fund balances & account balance
  IF v_txn.direction = 'income' THEN
    -- Credit Account
    UPDATE accounts 
    SET current_balance = current_balance + v_txn.amount, updated_at = now()
    WHERE id = v_txn.account_id;

    -- Credit Funds
    UPDATE funds f
    SET current_balance = f.current_balance + s.split_sum, updated_at = now()
    FROM (
      SELECT fund_id, SUM(amount) AS split_sum 
      FROM transaction_splits 
      WHERE transaction_id = p_transaction_id 
      GROUP BY fund_id
    ) s
    WHERE f.id = s.fund_id;

  ELSIF v_txn.direction = 'expense' THEN
    -- Debit Account
    UPDATE accounts 
    SET current_balance = current_balance - v_txn.amount, updated_at = now()
    WHERE id = v_txn.account_id;

    -- Debit Funds
    UPDATE funds f
    SET current_balance = f.current_balance - s.split_sum, updated_at = now()
    FROM (
      SELECT fund_id, SUM(amount) AS split_sum 
      FROM transaction_splits 
      WHERE transaction_id = p_transaction_id 
      GROUP BY fund_id
    ) s
    WHERE f.id = s.fund_id;
  END IF;

  -- 7. Update transaction status to posted
  UPDATE transactions
  SET 
    status = 'posted',
    posted_at = now(),
    updated_at = now()
  WHERE id = p_transaction_id;

  -- 8. Record FINANCIAL audit log
  INSERT INTO audit_logs (
    church_id, category, actor_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_txn.church_id, 'FINANCIAL', auth.uid(), 'POST_TRANSACTION', 'transactions', p_transaction_id,
    jsonb_build_object(
      'amount', v_txn.amount,
      'direction', v_txn.direction,
      'account_id', v_txn.account_id,
      'posted_at', now()
    )
  );

  RETURN p_transaction_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. RPC: VOID TRANSACTION & REVERSAL UPDATE
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION void_transaction(
  p_transaction_id UUID,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_orig transactions%ROWTYPE;
  v_reversal_id UUID;
BEGIN
  -- 1. Fetch and lock original transaction
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

  IF p_reason IS NULL OR length(trim(p_reason)) < 5 THEN
    RAISE EXCEPTION 'Invalid Void: A specific justification reason (minimum 5 characters) is required.';
  END IF;

  -- 2. Mark original transaction as voided (NEVER DELETED)
  UPDATE transactions 
  SET status = 'voided', updated_at = now() 
  WHERE id = p_transaction_id;

  -- 3. Create balancing reversal entry with status 'posted'
  INSERT INTO transactions (
    church_id, account_id, amount, direction, status,
    description, reference_number, posted_at, created_by, approved_by,
    is_reversal, reversal_of_id, metadata
  ) VALUES (
    v_orig.church_id,
    v_orig.account_id,
    v_orig.amount,
    CASE WHEN v_orig.direction = 'income' THEN 'expense'::transaction_direction_enum ELSE 'income'::transaction_direction_enum END,
    'posted',
    'Reversal of TX-' || SUBSTRING(v_orig.id::TEXT FROM 1 FOR 8) || ': ' || trim(p_reason),
    'REV-' || COALESCE(v_orig.reference_number, SUBSTRING(v_orig.id::TEXT FROM 1 FOR 8)),
    now(),
    auth.uid(),
    auth.uid(),
    true,
    v_orig.id,
    jsonb_build_object('void_reason', trim(p_reason), 'voided_by', auth.uid())
  ) RETURNING id INTO v_reversal_id;

  -- 4. Copy splits to reversal entry
  INSERT INTO transaction_splits (
    transaction_id, church_id, fund_id, category_id, amount, note
  )
  SELECT 
    v_reversal_id, church_id, fund_id, category_id, amount, 
    'Reversal split for TX-' || SUBSTRING(v_orig.id::TEXT FROM 1 FOR 8)
  FROM transaction_splits
  WHERE transaction_id = v_orig.id;

  -- 5. Rebalance Accounts and Funds for the reversal
  IF v_orig.direction = 'income' THEN
    -- Original was income (+), Reversal is expense (-): Deduct from Account & Funds
    UPDATE accounts SET current_balance = current_balance - v_orig.amount, updated_at = now() WHERE id = v_orig.account_id;
    UPDATE funds f
    SET current_balance = f.current_balance - s.split_sum, updated_at = now()
    FROM (
      SELECT fund_id, SUM(amount) AS split_sum 
      FROM transaction_splits 
      WHERE transaction_id = v_orig.id 
      GROUP BY fund_id
    ) s
    WHERE f.id = s.fund_id;
  ELSIF v_orig.direction = 'expense' THEN
    -- Original was expense (-), Reversal is income (+): Add to Account & Funds
    UPDATE accounts SET current_balance = current_balance + v_orig.amount, updated_at = now() WHERE id = v_orig.account_id;
    UPDATE funds f
    SET current_balance = f.current_balance + s.split_sum, updated_at = now()
    FROM (
      SELECT fund_id, SUM(amount) AS split_sum 
      FROM transaction_splits 
      WHERE transaction_id = v_orig.id 
      GROUP BY fund_id
    ) s
    WHERE f.id = s.fund_id;
  END IF;

  -- 6. Record FINANCIAL audit log
  INSERT INTO audit_logs (
    church_id, category, actor_id, action, entity_type, entity_id, metadata
  ) VALUES (
    v_orig.church_id, 'FINANCIAL', auth.uid(), 'VOID_TRANSACTION', 'transactions', p_transaction_id,
    jsonb_build_object(
      'reversal_transaction_id', v_reversal_id,
      'original_amount', v_orig.amount,
      'original_direction', v_orig.direction,
      'reason', trim(p_reason)
    )
  );

  RETURN v_reversal_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. RLS POLICY ENHANCEMENTS FOR APPROVER ROLE
-- ------------------------------------------------------------------------------

-- Allow approvers to view transactions and splits in their church
DROP POLICY IF EXISTS p_transactions_select ON transactions;
CREATE POLICY p_transactions_select ON transactions
  FOR SELECT TO authenticated
  USING (
    has_church_access(church_id, 'finance_staff') 
    OR has_church_access(church_id, 'approver')
  );

DROP POLICY IF EXISTS p_splits_select ON transaction_splits;
CREATE POLICY p_splits_select ON transaction_splits
  FOR SELECT TO authenticated
  USING (
    has_church_access(church_id, 'finance_staff') 
    OR has_church_access(church_id, 'approver')
  );
